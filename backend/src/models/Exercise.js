const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    normalizedName: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    primaryMuscle: {
      type: String,
      enum: [
        "chest",
        "back",
        "shoulders",
        "biceps",
        "triceps",
        "forearms",
        "quads",
        "hamstrings",
        "glutes",
        "calves",
        "core",
        "full_body",
        "cardio",
        "mobility",
        "other",
      ],
      default: "other",
      index: true,
    },
    secondaryMuscles: {
      type: [String],
      default: [],
    },
    equipment: {
      type: [String],
      default: ["bodyweight"],
      index: true,
    },
    category: {
      type: String,
      enum: ["strength", "cardio", "core", "mobility", "recovery", "other"],
      default: "strength",
      index: true,
    },
    movementPattern: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    difficulty: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    imageKey: {
      type: String,
      required: true,
      trim: true,
    },
    defaultSets: {
      type: Number,
      min: 1,
      max: 10,
      default: 3,
    },
    defaultReps: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "10",
    },
    defaultRestSeconds: {
      type: Number,
      min: 0,
      max: 600,
      default: 60,
    },
    durationMinutes: {
      type: Number,
      min: 0.25,
      max: 120,
      default: 4,
    },
    met: {
      type: Number,
      min: 1,
      max: 15,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

exerciseSchema.pre("validate", function () {
  if (this.name) {
    this.normalizedName = String(this.name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }
});

exerciseSchema.index({ active: 1, primaryMuscle: 1, name: 1 });

module.exports = mongoose.model("Exercise", exerciseSchema);
