const mongoose = require("mongoose");

const customExerciseSchema = new mongoose.Schema(
  {
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
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
    restSeconds: {
      type: Number,
      min: 0,
      max: 600,
      default: 60,
    },
  },
  { _id: false }
);

const workoutDaySchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 1,
      max: 7,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "Workout",
    },
    focusMuscles: {
      type: [String],
      default: [],
    },
    isRestDay: {
      type: Boolean,
      default: false,
    },
    exercises: {
      type: [customExerciseSchema],
      default: [],
    },
  },
  { _id: false }
);

const customWorkoutPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    template: {
      type: String,
      enum: ["ppl", "upper_lower", "full_body", "bro_split", "custom"],
      default: "custom",
    },
    goal: {
      type: String,
      enum: ["bulk", "lean", "fit"],
      default: "fit",
    },
    mode: {
      type: String,
      enum: ["equipment", "bodyweight", "mixed"],
      default: "mixed",
    },
    days: {
      type: [workoutDaySchema],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 7,
        message: "A custom workout plan must contain exactly 7 days",
      },
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

customWorkoutPlanSchema.index({ user: 1, isActive: 1 });
customWorkoutPlanSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("CustomWorkoutPlan", customWorkoutPlanSchema);
