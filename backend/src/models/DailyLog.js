const mongoose = require("mongoose");

const dailyLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    steps: {
      type: Number,
      default: 0,
    },
    water: {
      type: Number, // liters — manual-only; most wearables don't log hydration
      default: 0,
    },
    sleep: {
      type: Number, // hours
      default: 0,
    },
    caloriesBurned: {
      type: Number, // active calories (kcal), typically device-synced
      default: 0,
    },
    // "device" = read straight from Health Connect/HealthKit (Tier 1).
    // "estimated" = no wearable data today, so we derived it — from steps
    // via METs, or from a completed in-app workout (Tier 2).
    // "manual" = hand-typed or a quick-add preset (Tier 3).
    source: {
      type: String,
      enum: ["manual", "device", "estimated"],
      default: "manual",
    },
  },
  { timestamps: true }
);

// 🔥 VERY IMPORTANT: one log per user per day
dailyLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyLog", dailyLogSchema);
