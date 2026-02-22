const mongoose = require("mongoose");

const dietProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    date: {
      type: String, // YYYY-MM-DD format
      required: true
    },

    mealsCompleted: {
      breakfast: { type: Boolean, default: false },
      lunch: { type: Boolean, default: false },
      dinner: { type: Boolean, default: false },
      snack: { type: Boolean, default: false }
    },

    caloriesConsumed: {
      type: Number,
      default: 0
    },

    weight: {
      type: Number
    },

    notes: {
      type: String
    }

  },
  { timestamps: true }
);

// Prevent duplicate logs for same user + date
dietProgressSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DietProgress", dietProgressSchema);