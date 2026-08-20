const mongoose = require("mongoose");

const healthProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    age: {
      type: Number,
      required: true,
      min: 10,
      max: 100,
    },

    gender: {
      type: String,
      enum: ["male", "female"],
      required: true,
    },

    height: {
      type: Number,
      required: true,
      min: 100,
      max: 250,
    },

    weight: {
      type: Number,
      required: true,
      min: 20,
      max: 300,
    },

    activityLevel: {
      type: String,
      enum: [
        "sedentary",
        "light",
        "moderate",
        "active",
      ],
      required: true,
    },

    /*
     * Nutrition goal.
     *
     * IMPORTANT:
     *
     * User model uses:
     *   bulk / lean / fit
     *
     * HealthProfile uses:
     *   gain / lose / maintain
     *
     * The controller/service is responsible for mapping
     * between these two representations.
     */
    goal: {
      type: String,
      enum: ["lose", "maintain", "gain"],
      required: true,
    },

    dietType: {
      type: String,
      enum: [
        "veg",
        "non-veg",
        "vegan",
      ],
      required: true,
    },

    diseases: {
      type: [String],
      default: [],
    },

    allergies: {
      type: [String],
      default: [],
    },

    /*
     * Calculated engine outputs.
     *
     * These values must never be trusted from the client.
     * They are recalculated by health.service.js whenever
     * profile inputs change.
     */
    bmr: {
      type: Number,
      min: 0,
    },

    maintenanceCalories: {
      type: Number,
      min: 0,
    },

    targetCalories: {
      type: Number,
      min: 0,
    },

    activeCalorieGoal: {
      type: Number,
      min: 0,
    },

    proteinTarget: {
      type: Number,
      min: 0,
    },

    carbTarget: {
      type: Number,
      min: 0,
    },

    fatTarget: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.HealthProfile ||
  mongoose.model(
    "HealthProfile",
    healthProfileSchema
  );