const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },

  allergies: {
    type: [String],
    default: [],
  },

  otherAllergies: {
    type: [String],
    default: [],
  },

  profileComplete: {
    type: Boolean,
    default: false,
  },

  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const dishSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },

  category: {
    type: String,
    enum: ["entree", "side", "dessert", "drink", "other"],
    default: "other",
  },

  contributorName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },

  ingredients: {
    type: [String],
    default: [],
  },

  containsAllergens: {
    type: [String],
    default: [],
  },

  mayContainAllergens: {
    type: [String],
    default: [],
  },

  ingredientListComplete: {
    type: Boolean,
    default: false,
  },

  preparationInformation: {
    type: String,
    enum: [
      "not-provided",
      "shared-equipment",
      "may-contain",
      "reported-separate",
    ],
    default: "not-provided",
  },

  addedAt: {
    type: Date,
    default: Date.now,
  },
});

const eventSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 6,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },

    eventType: {
      type: String,
      enum: ["potluck", "dinner", "party", "club-event", "other"],
      default: "potluck",
    },

    eventDate: {
      type: Date,
      required: true,
    },

    hostName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    participants: {
      type: [participantSchema],
      default: [],
    },

    dishes: {
      type: [dishSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Event", eventSchema);