"use strict";

const mongoose = require("mongoose");

const xpEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    key: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "exerciseConfirmed",
        "workoutCompleted",
        "mealLogged",
        "stepsGoal",
        "activeBurnGoal",
        "duelWin",
        "achievementEarned",
      ],
      required: true,
    },
    xp: { type: Number, required: true, min: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
    earnedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

xpEventSchema.index({ user: 1, key: 1 }, { unique: true });
xpEventSchema.index({ user: 1, earnedAt: -1 });

module.exports = mongoose.model("XpEvent", xpEventSchema);
