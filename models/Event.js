const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },

  role: {
    type: String,
    enum: ["host", "member"],
    required: true,
  },

  allergies: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],

  otherAllergies: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],

  profileComplete: {
    type: Boolean,
    default: false,
  },

  crossContactConcern: {
    type: Boolean,
    default: false,
  },

  note: {
    type: String,
    trim: true,
    maxlength: 500,
    default: "",
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
    maxlength: 120,
  },

  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: "",
  },

  category: {
    type: String,
    enum: [
      "Main dish",
      "Side dish",
      "Dessert",
      "Drink",
      "Snack",
      "Other",
      // Keep existing dishes valid when their event is saved again.
      "entree",
      "side",
      "dessert",
      "drink",
      "other",
    ],
    default: "Other",
  },

  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  ingredients: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],

  containsAllergens: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],

  mayContainAllergens: [
    {
      type: String,
      trim: true,
      lowercase: true,
    },
  ],

  ingredientListComplete: {
    type: Boolean,
    default: false,
  },

  preparationInformation: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: "",
  },

  crossContactStatus: {
    type: String,
    enum: ["unknown", "possible", "reported-separate"],
    default: "unknown",
  },

  isPublished: {
    type: Boolean,
    default: true,
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

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
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

    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "open", "closed"],
      default: "open",
    },

    foodBlacklist: {
      type: [{ type: String, trim: true, lowercase: true }],
      // Preserve access to legacy blacklist fields until the host saves this list.
      default: undefined,
    },

    foodAllergenBlacklist: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    ingredientBlacklist: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    blockedEmails: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    members: {
      type: [memberSchema],
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
