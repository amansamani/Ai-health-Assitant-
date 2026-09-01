"use strict";

const mongoose = require("mongoose");

const weeklyInsightSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    weekEnding: {
      type: Date,
      required: true,
      default: Date.now,
    },

    adjusted: { type: Boolean, required: true },

    oldCalories: Number,
    newCalories: Number,
    delta:       { type: Number, default: 0 }, // newCalories - oldCalories

    reason: { type: String, required: true },

    adherence:    Number, // % of days with ≥3 meals logged
    avgCalories:  Number, // avg daily intake over the window
    weightChange: Number, // kg delta over the window

    notified: { type: Boolean, default: false }, // push notif sent?
  },
  { timestamps: true }
);

// latest insight per user is the most common query
weeklyInsightSchema.index({ user: 1, weekEnding: -1 });

module.exports = mongoose.model("WeeklyInsight", weeklyInsightSchema);
