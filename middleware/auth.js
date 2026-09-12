const User = require("../models/User");
const Event = require("../models/Event");

function normalizeEventCode(value) {
  return String(value || "").trim().toUpperCase();
}

function requireUser(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({
      message: "Please confirm your email first.",
    });
  }
  next();
}

async function loadVerifiedEventMember(req, res, next) {
  try {
    const code = normalizeEventCode(req.params.code);
    const [user, event] = await Promise.all([
      User.findById(req.session.userId),
      Event.findOne({ code }),
    ]);
    if (!user?.emailVerified) {
      return res.status(401).json({ message: "Please confirm your email first." });
    }
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }
    const membership = event.members.find(
      (member) => member.user.toString() === user._id.toString()
    );
    if (!membership) {
      return res.status(403).json({ message: "You are not a member of this event." });
    }
    req.authenticatedUser = user;
    req.currentEvent = event;
    req.currentMembership = membership;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  normalizeEventCode,
  requireUser,
  loadVerifiedEventMember,
};
