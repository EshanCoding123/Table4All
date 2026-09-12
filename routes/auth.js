const crypto = require("crypto");
const express = require("express");

const User = require("../models/User");
const Event = require("../models/Event");
const VerificationCode = require("../models/VerificationCode");
const {
  EmailConfigurationError,
  EmailDeliveryError,
  createEmailService,
} = require("../services/emailService");

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const AUTH_INTENTS = ["host", "join", "signup", "login"];

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeEventCode(code) {
  return String(code || "").trim().toUpperCase();
}

function generateVerificationCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashVerificationCode(email, code, secret = process.env.SESSION_SECRET) {
  return crypto.createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

function createAuthRouter(options = {}) {
  const router = express.Router();
  const emailService = options.emailService || createEmailService();
  const UserModel = options.UserModel || User;
  const EventModel = options.EventModel || Event;
  const VerificationCodeModel = options.VerificationCodeModel || VerificationCode;
  const now = options.now || (() => new Date());
  const sessionSecret = options.sessionSecret || process.env.SESSION_SECRET;

  router.post("/request-code", async (req, res) => {
    let verification;
    try {
      let name = String(req.body.name || "").trim().slice(0, 50);
      const email = normalizeEmail(req.body.email);
      const intent = req.body.intent;
      const eventCode = normalizeEventCode(req.body.eventCode);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "A valid email address is required." });
      }
      if (!AUTH_INTENTS.includes(intent)) {
        return res.status(400).json({ message: "Please choose a valid sign-in action." });
      }
      if (intent !== "login" && !name) {
        return res.status(400).json({ message: "A valid name and email are required." });
      }

      if (intent === "login") {
        const existingUser = await UserModel.findOne({ email });
        if (!existingUser?.emailVerified) {
          return res.status(404).json({ message: "No verified account was found for that email. Choose Create account first." });
        }
        name = existingUser.name;
      }

      if (intent === "signup") {
        const existingUser = await UserModel.findOne({ email });
        if (existingUser?.emailVerified) {
          return res.status(409).json({ message: "An account already exists for that email. Choose Log in instead." });
        }
      }
      if (intent === "join") {
        if (!/^[A-Z0-9]{6}$/.test(eventCode)) {
          return res.status(400).json({ message: "A valid six-character event code is required." });
        }
        const event = await EventModel.findOne({ code: eventCode });
        if (!event) return res.status(404).json({ message: "No event was found with that code." });
        if (event.status !== "open") {
          return res.status(403).json({ message: "This event is not currently accepting members." });
        }
        if ((event.blockedEmails || []).some(
          (blockedEmail) => normalizeEmail(blockedEmail) === email
        )) {
          return res.status(403).json({ message: "This email cannot join this event." });
        }
      }

      const currentTime = now();
      const recentCode = await VerificationCodeModel.findOne({
        email,
        intent,
        createdAt: { $gt: new Date(currentTime.getTime() - RESEND_COOLDOWN_MS) },
      });
      if (recentCode) {
        const elapsed = currentTime.getTime() - new Date(recentCode.createdAt).getTime();
        const retryAfterSeconds = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
        res.set("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({
          message: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
          retryAfterSeconds,
        });
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(currentTime.getTime() + CODE_LIFETIME_MS);
      await VerificationCodeModel.deleteMany({ email, intent });
      verification = await VerificationCodeModel.create({
        name,
        email,
        intent,
        eventCode: intent === "join" ? eventCode : null,
        codeHash: hashVerificationCode(email, code, sessionSecret),
        attempts: 0,
        expiresAt,
      });
      await emailService.sendVerificationCode({ email, code, expiresAt });
      return res.status(201).json({
        message: "A verification code was sent to your email. It expires in 10 minutes.",
        deliveryMethod: "email",
        cooldownSeconds: RESEND_COOLDOWN_MS / 1000,
      });
    } catch (error) {
      if (verification?._id) {
        await VerificationCodeModel.findByIdAndDelete(verification._id).catch(() => {});
      }
      if (error instanceof EmailConfigurationError) {
        return res.status(503).json({ message: error.message });
      }
      if (error instanceof EmailDeliveryError) {
        return res.status(502).json({
          message: "The verification email could not be delivered. Check the address and try again.",
        });
      }
      if (error?.code === 11000) {
        return res.status(429).json({
          message: "Please wait one minute before requesting another code.",
          retryAfterSeconds: 60,
        });
      }
      console.error("Request code error:", error.name);
      return res.status(500).json({ message: "The verification code could not be sent." });
    }
  });

  router.post("/verify-code", async (req, res) => {
    try {
      const email = normalizeEmail(req.body.email);
      const code = String(req.body.code || "").trim();
      const intent = req.body.intent;
      const eventCode = normalizeEventCode(req.body.eventCode);
      if (!email || !/^\d{6}$/.test(code) || !AUTH_INTENTS.includes(intent)) {
        return res.status(400).json({ message: "Enter the six-digit verification code." });
      }
      const verification = await VerificationCodeModel.findOne({
        email,
        intent,
        eventCode: intent === "join" ? eventCode : null,
      }).sort({ createdAt: -1 });
      if (!verification || new Date(verification.expiresAt) <= now()) {
        if (verification?._id) await VerificationCodeModel.findByIdAndDelete(verification._id);
        return res.status(400).json({ message: "That code is invalid or has expired." });
      }
      if (verification.attempts >= MAX_ATTEMPTS) {
        await VerificationCodeModel.findByIdAndDelete(verification._id);
        return res.status(429).json({ message: "Too many attempts. Request a new code." });
      }
      const submittedHash = hashVerificationCode(email, code, sessionSecret);
      const codeMatches = crypto.timingSafeEqual(
        Buffer.from(submittedHash, "hex"),
        Buffer.from(verification.codeHash, "hex")
      );
      if (!codeMatches) {
        verification.attempts += 1;
        if (verification.attempts >= MAX_ATTEMPTS) {
          await VerificationCodeModel.findByIdAndDelete(verification._id);
          return res.status(429).json({ message: "Too many attempts. Request a new code." });
        }
        await verification.save();
        return res.status(400).json({
          message: `That verification code is incorrect. ${MAX_ATTEMPTS - verification.attempts} attempts remain.`,
        });
      }

      const user = intent === "login"
        ? await UserModel.findOne({ email })
        : await UserModel.findOneAndUpdate(
          { email },
          { $set: { name: verification.name, emailVerified: true, verifiedAt: now() } },
          { returnDocument: "after", upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

      if (intent === "login" && !user?.emailVerified) {
        await VerificationCodeModel.findByIdAndDelete(verification._id);
        return res.status(400).json({ message: "That account is no longer available. Create an account again." });
      }
      await VerificationCodeModel.findByIdAndDelete(verification._id);
      await new Promise((resolve, reject) => {
        req.session.regenerate((error) => error ? reject(error) : resolve());
      });
      req.session.userId = user._id.toString();
      req.session.email = user.email;
      await new Promise((resolve, reject) => {
        req.session.save((error) => error ? reject(error) : resolve());
      });
      return res.json({
        message: "Email verified.",
        user: { id: user._id, name: user.name, email: user.email },
        intent,
        eventCode: intent === "join" ? eventCode : null,
      });
    } catch (error) {
      console.error("Verify code error:", error.name);
      return res.status(500).json({ message: "The verification code could not be confirmed." });
    }
  });

  router.get("/me", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "You are not signed in." });
    const user = await UserModel.findById(req.session.userId);
    if (!user?.emailVerified) return res.status(401).json({ message: "Your session is no longer valid." });
    return res.json({ user: { id: user._id, name: user.name, email: user.email } });
  });

  router.post("/logout", (req, res) => {
    req.session.destroy((error) => {
      if (error) return res.status(500).json({ message: "You could not be signed out." });
      res.clearCookie("tableforall.sid");
      return res.json({ message: "You have signed out." });
    });
  });

  return router;
}

const router = createAuthRouter();
module.exports = router;
module.exports.createAuthRouter = createAuthRouter;
module.exports.hashVerificationCode = hashVerificationCode;
module.exports.normalizeEmail = normalizeEmail;
module.exports.constants = { CODE_LIFETIME_MS, RESEND_COOLDOWN_MS, MAX_ATTEMPTS };
