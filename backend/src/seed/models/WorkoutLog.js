const mongoose = require("mongoose");

const completedExerciseSchema = new mongoose.Schema(
  {
    exerciseId: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", default: null },
    name: { type: String, required: true },
    calories: { type: Number, required: true, min: 0 },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const workoutAttemptSchema = new mongoose.Schema(
  {
    attemptNumber: { type: Number, required: true },
    completedExercises: {
      type: [completedExerciseSchema],
      default: [],
    },
    caloriesBurned: { type: Number, default: 0, min: 0 },
    completed: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const workoutLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    workoutPlan: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "planModel",
      required: true,
    },
    planModel: {
      type: String,
      enum: ["WorkoutPlan", "CustomWorkoutPlan"],
      default: "WorkoutPlan",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },

    // Custom plans contain a full week inside one plan document. Keep the
    // day as part of the log identity so Monday and Thursday never share
    // completion state. Standard plans use null here.
    dayOfWeek: {
      type: Number,
      min: 1,
      max: 7,
      default: null,
    },

    // True once at least one attempt completed the full workout today.
    completed: {
      type: Boolean,
      default: false,
    },
    // Total estimated workout calories recorded for this calendar day,
    // across all attempts of this workout.
    caloriesBurned: {
      type: Number,
      default: 0,
      min: 0,
    },
    attempts: {
      type: [workoutAttemptSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// One log per user/date/plan/day. For CustomWorkoutPlan the dayOfWeek is
// essential because one plan contains Monday-Sunday workouts.
workoutLogSchema.index(
  { user: 1, date: 1, planModel: 1, workoutPlan: 1, dayOfWeek: 1 },
  { unique: true }
);

module.exports = mongoose.model("WorkoutLog", workoutLogSchema);
