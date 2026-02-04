const mongoose = require("mongoose");

const workoutPlanSchema = new mongoose.Schema(
  {
    goal: {
      type: String,
      enum: ["bulk", "lean", "fit"],
      required: true,
    },

    mode: {
      type: String,
      enum: ["equipment", "bodyweight"],
      required: true,
    },

    day: {
      type: Number, // Day 1, 2, 3...
      required: true,
    },

    title: {
      type: String, // e.g. "Full Body", "Leg Day"
      required: true,
    },

    exercises: [
      {
        name: {
          type: String,
          required: true,
        },
        sets: {
          type: Number,
          required: true,
        },
        reps: {
          type: String,
          required: true,
        },
        imageKey: {
          type: String,
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkoutPlan", workoutPlanSchema);
