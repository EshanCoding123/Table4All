const mongoose = require("mongoose");

const verificationCodeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    codeHash: {
      type: String,
      required: true,
    },

    intent: {
      type: String,
      required: true,
      enum: ["host", "join", "member"],
    },

    eventCode: {
      type: String,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 6,
      required: function () { return this.intent === "join"; },
      default: null,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

// Only keep one active code for each email and intent.
verificationCodeSchema.index(
  {
    email: 1,
    intent: 1,
  },
  {
    unique: true,
  }
);

// MongoDB automatically removes expired verification codes.
verificationCodeSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
  }
);

module.exports = mongoose.model(
  "VerificationCode",
  verificationCodeSchema
);
