const { Resend } = require("resend");
const nodemailer = require("nodemailer");

class EmailConfigurationError extends Error {}
class EmailDeliveryError extends Error {}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function parseSender(value) {
  const sender = String(value || "").trim();
  const namedSender = sender.match(/^(.+?)\s*<([^<>]+)>$/);
  if (!namedSender) return { email: sender };
  return {
    name: namedSender[1].trim(),
    email: namedSender[2].trim(),
  };
}

function createEmailService(options = {}) {
  const environment = options.environment || process.env;
  const sendGridApiKey = String(environment.SENDGRID_API_KEY || "").trim();
  const sendGridFetch = options.sendGridFetch || globalThis.fetch;
  const gmailUser = String(environment.GMAIL_USER || "").trim();
  const gmailAppPassword = String(environment.GMAIL_APP_PASSWORD || "")
    .replace(/\s/g, "");
  const transporter = options.transporter || (
    !sendGridApiKey && gmailUser && gmailAppPassword
      ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailAppPassword },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        dnsTimeout: 10000,
      })
      : null
  );
  const client = options.client || (!sendGridApiKey && !transporter && environment.RESEND_API_KEY
    ? new Resend(environment.RESEND_API_KEY)
    : null);
  const from = options.from ?? environment.EMAIL_FROM ?? (
    gmailUser ? `TableForAll <${gmailUser}>` : null
  );
  const appBaseUrl = options.appBaseUrl ?? environment.APP_BASE_URL;
  const shouldLogCodes = environment.NODE_ENV !== "production" &&
    environment.DEV_LOG_VERIFICATION_CODES === "true";

  async function sendVerificationCode({ email, code, expiresAt }) {
    if ((!sendGridApiKey && !transporter && !client) || !from) {
      throw new EmailConfigurationError(
        "Email verification is not configured. Add SendGrid, Gmail SMTP, or Resend credentials."
      );
    }
    const expiration = expiresAt.toISOString();
    const siteLine = appBaseUrl ? `Open TableForAll: ${appBaseUrl}` : "";
    const text = [
      "TableForAll email verification",
      "",
      `Your six-digit verification code is: ${code}`,
      `This code expires at ${expiration}.`,
      "If you did not request this code, you can ignore this email.",
      siteLine,
    ].filter(Boolean).join("\n");
    const safeCode = escapeHtml(code);
    const safeExpiration = escapeHtml(expiration);
    const safeUrl = appBaseUrl ? escapeHtml(appBaseUrl) : "";
    const html = `<!doctype html><html><body style="margin:0;background:#f7f3ea;color:#172a3a;font-family:Arial,sans-serif"><div style="max-width:560px;margin:32px auto;padding:32px;background:#fffcf6;border:2px solid #c9bda9;border-radius:14px"><h1 style="font-family:Georgia,serif">TableForAll</h1><p>Your six-digit verification code is:</p><p style="font-size:32px;font-weight:bold;letter-spacing:0.18em">${safeCode}</p><p>This code expires at <strong>${safeExpiration}</strong>.</p><p>If you did not request this code, you can ignore this email.</p>${safeUrl ? `<p><a href="${safeUrl}">Open TableForAll</a></p>` : ""}</div></body></html>`;

    const message = {
      from,
      to: email,
      subject: "Your TableForAll verification code",
      text,
      html,
    };

    let id = null;
    try {
      if (sendGridApiKey) {
        if (typeof sendGridFetch !== "function") {
          throw new Error("HTTPS requests are unavailable.");
        }
        const response = await sendGridFetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sendGridApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email }] }],
            from: parseSender(from),
            subject: message.subject,
            content: [
              { type: "text/plain", value: text },
              { type: "text/html", value: html },
            ],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) {
          throw new Error("SendGrid rejected the request.");
        }
        id = response.headers?.get?.("x-message-id") || null;
      } else if (transporter) {
        const result = await transporter.sendMail(message);
        id = result?.messageId || null;
      } else {
        const result = await client.emails.send(message);
        if (result?.error) {
          throw new EmailDeliveryError("The email provider rejected the verification email.");
        }
        id = result?.data?.id || null;
      }
    } catch {
      throw new EmailDeliveryError("The email provider could not deliver the verification email.");
    }
    if (shouldLogCodes) {
      console.log(`Development verification code: ${code}`);
    }
    return { id };
  }

  return { sendVerificationCode };
}

module.exports = {
  EmailConfigurationError,
  EmailDeliveryError,
  createEmailService,
};
