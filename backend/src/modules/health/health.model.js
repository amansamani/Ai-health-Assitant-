const mongoose = require("mongoose");

const healthProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    age: { type: Number, required: true, min: 10, max: 100 },
    gender: { type: String, enum: ["male", "female"], required: true },

    height: { type: Number, required: true }, // cm
    weight: { type: Number, required: true }, // kg

    activityLevel: {
      type: String,
      enum: ["sedentary", "light", "moderate", "active"],
      required: true
    },

    goal: {
      type: String,
      enum: ["lose", "maintain", "gain"],
      required: true
    },

    dietType: {
      type: String,
      enum: ["veg", "non-veg", "vegan"],
      required: true
    },

    diseases: {
      type: [String],
      default: []
    },

    // Calculated values (engine output)
    bmr: Number,
    maintenanceCalories: Number,
    targetCalories: Number,
    proteinTarget: Number,
    carbTarget: Number,
    fatTarget: Number

  },
  { timestamps: true }
);

module.exports = mongoose.model("HealthProfile", healthProfileSchema);