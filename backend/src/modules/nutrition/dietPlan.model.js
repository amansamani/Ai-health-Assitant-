const mongoose = require("mongoose");

const mealItemSchema = new mongoose.Schema(
  {
    foodId:   { type: mongoose.Schema.Types.ObjectId, ref: "FoodItem" },
    name:     String,
    grams:    Number,
    calories: Number,
    protein:  Number,
    carbs:    Number,
    fats:     Number,
    // ── Serving info (new) ──────────────────────────────────────────────────
    servingUnit:     { type: String, default: "g" },     // "g" or "piece"
    gramsPerPiece:   { type: Number, default: null },    // e.g. 40 for roti
    pieces:          { type: Number, default: null },    // e.g. 2 pieces
  },
  { _id: false }
);

const dietPlanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    version:        { type: Number, default: 1 },
    targetCalories: Number,
    macroSplit: {
      protein: Number,
      carbs:   Number,
      fats:    Number,
    },
    meals: {
      breakfast: [mealItemSchema],
      lunch:     [mealItemSchema],
      dinner:    [mealItemSchema],
      snack:     [mealItemSchema],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DietPlan", dietPlanSchema);