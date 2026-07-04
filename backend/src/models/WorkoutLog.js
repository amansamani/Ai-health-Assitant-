const mongoose = require("mongoose");

const workoutLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workoutPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkoutPlan",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    completed: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// One completion record per user per day — marking complete again same day
// just updates the existing record instead of creating a duplicate.
workoutLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("WorkoutLog", workoutLogSchema);