const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  senderDisplayName: { type: String, required: true, trim: true, maxlength: 50 },
  body: { type: String, required: true, trim: true, maxlength: 1000 },
  deleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

messageSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
