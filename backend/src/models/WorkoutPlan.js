const mongoose = require("mongoose");

const workoutPlanSchema = new mongoose.Schema(
  {
    goal: {
      type: String,
      enum: ["bulk", "lean", "fit"],
      required: true,
    },
    day: {
      type: String,
      required: true,
    },
    exercises: [
      {
        name: String,
        sets: Number,
        reps: String,
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkoutPlan", workoutPlanSchema);
