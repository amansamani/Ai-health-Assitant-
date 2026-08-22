const mongoose = require("mongoose");

const workoutExerciseSchema = new mongoose.Schema(
  {
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
      index: true,
    },
    sets: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
    },
    reps: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
  },
  { _id: false }
);

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
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    exercises: {
      type: [workoutExerciseSchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "A workout plan must contain at least one exercise",
      },
    },
  },
  { timestamps: true }
);

workoutPlanSchema.index({ goal: 1, mode: 1, day: 1 });

module.exports = mongoose.model("WorkoutPlan", workoutPlanSchema);
