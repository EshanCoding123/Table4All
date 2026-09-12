const mongoose = require("mongoose");

const assistantMessageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "assistant"], required: true },
  text: { type: String, required: true, maxlength: 2500 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const assistantThreadSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  messages: { type: [assistantMessageSchema], default: [] },
}, { timestamps: true });

assistantThreadSchema.index({ event: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("AssistantThread", assistantThreadSchema);
