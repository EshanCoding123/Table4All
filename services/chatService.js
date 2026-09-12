const User = require("../models/User");
const Event = require("../models/Event");
const Message = require("../models/Message");
const { normalizeEventCode } = require("../middleware/auth");

const MESSAGE_LIMIT = 1000;
const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX_MESSAGES = 5;

function serializeMessage(message) {
  return {
    id: String(message._id),
    senderId: String(message.sender),
    senderName: message.senderDisplayName,
    body: message.body,
    createdAt: message.createdAt,
  };
}

function findMembership(event, userId) {
  return event?.members?.find(
    (member) => member.user.toString() === userId.toString()
  );
}

function createChatService(io, options = {}) {
  const UserModel = options.UserModel || User;
  const EventModel = options.EventModel || Event;
  const MessageModel = options.MessageModel || Message;
  const now = options.now || (() => Date.now());
  const rateEntries = new Map();

  function acknowledge(callback, payload) {
    if (typeof callback === "function") callback(payload);
  }

  function consumeRateLimit(userId, eventId) {
    const key = `${userId}:${eventId}`;
    const cutoff = now() - RATE_WINDOW_MS;
    const recent = (rateEntries.get(key) || []).filter((time) => time > cutoff);
    if (recent.length >= RATE_MAX_MESSAGES) {
      rateEntries.set(key, recent);
      return false;
    }
    recent.push(now());
    rateEntries.set(key, recent);
    return true;
  }

  io.use(async (socket, next) => {
    try {
      const userId = socket.request.session?.userId;
      if (!userId) return next(new Error("Please confirm your email before opening room chat."));
      const user = await UserModel.findById(userId);
      if (!user?.emailVerified) return next(new Error("Your verified session is no longer valid."));
      socket.data.userId = String(user._id);
      next();
    } catch {
      next(new Error("Room chat authentication could not be completed."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:join", async (payload, callback) => {
      try {
        const code = normalizeEventCode(payload?.code);
        if (!/^[A-Z0-9]{6}$/.test(code)) {
          return acknowledge(callback, { ok: false, message: "A valid event code is required." });
        }
        const event = await EventModel.findOne({ code });
        const membership = findMembership(event, socket.data.userId);
        if (!event || !membership) {
          return acknowledge(callback, { ok: false, message: "You do not have access to this event chat." });
        }
        if (socket.data.roomName) await socket.leave(socket.data.roomName);
        const roomName = `event:${event._id}`;
        await socket.join(roomName);
        socket.data.eventId = String(event._id);
        socket.data.eventCode = event.code;
        socket.data.roomName = roomName;
        socket.data.role = membership.role;
        socket.data.displayName = membership.displayName;

        const recent = await MessageModel.find({ event: event._id, deleted: false })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
        acknowledge(callback, {
          ok: true,
          currentUserId: socket.data.userId,
          role: membership.role,
          messages: recent.reverse().map(serializeMessage),
        });
      } catch {
        acknowledge(callback, { ok: false, message: "Recent messages could not be loaded." });
      }
    });

    socket.on("message:send", async (payload, callback) => {
      try {
        if (!socket.data.eventId) {
          return acknowledge(callback, { ok: false, message: "Open an event chat before sending a message." });
        }
        const body = typeof payload?.body === "string" ? payload.body.trim() : "";
        if (!body) return acknowledge(callback, { ok: false, message: "Enter a message first." });
        if (body.length > MESSAGE_LIMIT) {
          return acknowledge(callback, { ok: false, message: "Keep messages within 1,000 characters." });
        }
        const event = await EventModel.findById(socket.data.eventId);
        const membership = findMembership(event, socket.data.userId);
        if (!membership) {
          return acknowledge(callback, { ok: false, message: "You no longer have access to this event chat." });
        }
        if (!consumeRateLimit(socket.data.userId, socket.data.eventId)) {
          return acknowledge(callback, { ok: false, message: "You are sending messages too quickly. Wait a few seconds." });
        }
        const message = await MessageModel.create({
          event: event._id,
          sender: socket.data.userId,
          senderDisplayName: membership.displayName,
          body,
        });
        const publicMessage = serializeMessage(message);
        io.to(socket.data.roomName).emit("message:new", publicMessage);
        acknowledge(callback, { ok: true, message: publicMessage });
      } catch {
        acknowledge(callback, { ok: false, message: "Your message could not be sent." });
      }
    });

    socket.on("message:delete", async (payload, callback) => {
      try {
        if (!socket.data.eventId || typeof payload?.messageId !== "string") {
          return acknowledge(callback, { ok: false, message: "That message could not be found." });
        }
        const [event, message] = await Promise.all([
          EventModel.findById(socket.data.eventId),
          MessageModel.findById(payload.messageId),
        ]);
        const membership = findMembership(event, socket.data.userId);
        if (!membership || !message || message.deleted ||
            String(message.event) !== String(event._id)) {
          return acknowledge(callback, { ok: false, message: "That message could not be deleted." });
        }
        const mayDelete = String(event.host) === socket.data.userId ||
          String(message.sender) === socket.data.userId;
        if (!mayDelete) {
          return acknowledge(callback, { ok: false, message: "You may delete only your own messages." });
        }
        message.deleted = true;
        message.deletedAt = new Date(now());
        message.deletedBy = socket.data.userId;
        await message.save();
        io.to(socket.data.roomName).emit("message:deleted", { id: String(message._id) });
        acknowledge(callback, { ok: true });
      } catch {
        acknowledge(callback, { ok: false, message: "That message could not be deleted." });
      }
    });
  });

  return { consumeRateLimit };
}

module.exports = {
  MESSAGE_LIMIT,
  RATE_WINDOW_MS,
  RATE_MAX_MESSAGES,
  serializeMessage,
  createChatService,
};
