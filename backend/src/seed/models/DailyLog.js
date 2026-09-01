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
      type: Number, // total active calories shown in the app
      default: 0,
    },

    // Source breakdown. These let the UI distinguish workout calories from
    // step calories instead of attributing every estimate to steps.
    stepsCaloriesBurned: {
      type: Number,
      default: 0,
      min: 0,
    },
    exerciseCaloriesBurned: {
      type: Number,
      default: 0,
      min: 0,
    },
    activityCaloriesBurned: {
      type: Number,
      default: 0,
      min: 0,
    },

    activityEntries: {
      type: [
        {
          activityType: { type: String, required: true },
          label: { type: String, required: true },
          minutes: { type: Number, min: 0, default: 0 },
          met: { type: Number, min: 0, default: 0 },
          calories: { type: Number, min: 0, required: true },
          loggedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    manualCaloriesBurned: {
      type: Number,
      default: 0,
      min: 0,
    },
    // When set, this is the user's explicit Active Burn value for today.
    // Other tracked components can still be retained for transparency, but
    // this headline total must not be overwritten by a later device sync.
    caloriesOverride: {
      type: Number,
      default: null,
      min: 0,
    },
    caloriesSource: {
      type: String,
      enum: ["device", "estimated", "manual", "mixed"],
      default: "manual",
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
