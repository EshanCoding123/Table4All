const express = require("express");
const AssistantThread = require("../models/AssistantThread");
const { requireUser, loadVerifiedEventMember } = require("../middleware/auth");
const {
  AssistantConfigurationError,
  AssistantResponseError,
  createAssistantService,
} = require("../services/assistantService");

const QUESTION_LIMIT = 500;
const ASSISTANT_RATE_WINDOW_MS = 60 * 1000;
const ASSISTANT_RATE_MAX = 5;
const MAX_HISTORY_MESSAGES = 10;

function serializeHistory(thread) {
  return (thread?.messages || []).map((message) => ({
    role: message.role,
    text: message.text,
    createdAt: message.createdAt,
  }));
}

function createAssistantRouter(options = {}) {
  const router = express.Router();
  const service = options.service || createAssistantService();
  const ThreadModel = options.ThreadModel || AssistantThread;
  const now = options.now || (() => Date.now());
  const rateEntries = new Map();

  function memberOnly(req, res, next) {
    if (req.currentMembership.role !== "member") {
      return res.status(403).json({ message: "Ask TableForAll is available to event members." });
    }
    next();
  }

  function consumeRateLimit(userId, eventId) {
    const key = `${userId}:${eventId}`;
    const cutoff = now() - ASSISTANT_RATE_WINDOW_MS;
    const recent = (rateEntries.get(key) || []).filter((time) => time > cutoff);
    if (recent.length >= ASSISTANT_RATE_MAX) {
      rateEntries.set(key, recent);
      return false;
    }
    recent.push(now());
    rateEntries.set(key, recent);
    return true;
  }

  router.get("/:code/assistant", requireUser, loadVerifiedEventMember, memberOnly, async (req, res) => {
    try {
      const thread = await ThreadModel.findOne({
        event: req.currentEvent._id,
        user: req.authenticatedUser._id,
      }).lean();
      res.set("Cache-Control", "no-store");
      res.json({
        configured: service.isConfigured(),
        message: service.isConfigured()
          ? "Ask TableForAll is ready."
          : "Ask TableForAll has not been configured by the site owner.",
        history: serializeHistory(thread),
      });
    } catch (error) {
      console.error("Load assistant history error:", error.name);
      res.status(500).json({ message: "Assistant history could not be loaded." });
    }
  });

  router.post("/:code/assistant", requireUser, loadVerifiedEventMember, memberOnly, async (req, res) => {
    try {
      const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
      if (!question) return res.status(400).json({ message: "Enter a question for the assistant." });
      if (question.length > QUESTION_LIMIT) {
        return res.status(400).json({ message: "Keep assistant questions within 500 characters." });
      }
      if (!service.isConfigured()) {
        return res.status(503).json({ message: "Ask TableForAll has not been configured by the site owner." });
      }
      if (!consumeRateLimit(req.authenticatedUser._id, req.currentEvent._id)) {
        res.set("Retry-After", "60");
        return res.status(429).json({ message: "You have asked several questions. Wait a minute before asking another." });
      }
      let thread = await ThreadModel.findOne({
        event: req.currentEvent._id,
        user: req.authenticatedUser._id,
      });
      const history = serializeHistory(thread);
      const answer = await service.ask({
        question,
        event: req.currentEvent,
        membership: req.currentMembership,
        history,
      });
      if (!thread) {
        thread = new ThreadModel({
          event: req.currentEvent._id,
          user: req.authenticatedUser._id,
          messages: [],
        });
      }
      thread.messages.push(
        { role: "user", text: question, createdAt: new Date(now()) },
        { role: "assistant", text: answer, createdAt: new Date(now()) }
      );
      if (thread.messages.length > MAX_HISTORY_MESSAGES) {
        thread.messages.splice(0, thread.messages.length - MAX_HISTORY_MESSAGES);
      }
      await thread.save();
      res.json({ answer, history: serializeHistory(thread) });
    } catch (error) {
      if (error instanceof AssistantConfigurationError) {
        return res.status(503).json({ message: error.message });
      }
      if (error instanceof AssistantResponseError) {
        return res.status(502).json({ message: error.message });
      }
      console.error("Assistant request error:", error.name);
      res.status(500).json({ message: "The assistant could not answer right now." });
    }
  });

  router.consumeRateLimit = consumeRateLimit;
  return router;
}

const router = createAssistantRouter();
module.exports = router;
module.exports.createAssistantRouter = createAssistantRouter;
module.exports.constants = {
  QUESTION_LIMIT,
  ASSISTANT_RATE_WINDOW_MS,
  ASSISTANT_RATE_MAX,
  MAX_HISTORY_MESSAGES,
};
