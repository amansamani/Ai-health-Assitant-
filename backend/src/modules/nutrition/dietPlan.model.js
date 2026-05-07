const mongoose = require("mongoose");

const mealItemSchema = new mongoose.Schema(
  {
    // ── Template identity ──
    templateId: String,
    mealName:   String,
    cuisine:    String,
    difficulty: String,
    prepTime:   Number,
    budget:     String,
    tags:       [String],

    // ── Ingredients ──
    items: [
      {
        name:   String,
        amount: Number,
        unit:   String,
        _id:    false,
      },
    ],

    // ── Macros ──
    calories: Number,
    protein:  Number,
    carbs:    Number,
    fats:     Number,
    fiber:    Number,

    // ── Legacy fields (keep for backward compat) ──
    servingUnit:   { type: String, default: "g" },
    gramsPerPiece: { type: Number, default: null },
    pieces:        { type: Number, default: null },
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
      breakfast: { type: [mealItemSchema], default: [] },
      lunch:     { type: [mealItemSchema], default: [] },
      dinner:    { type: [mealItemSchema], default: [] },
      snack:     { type: [mealItemSchema], default: [] },
    },

    summary: { type: mongoose.Schema.Types.Mixed },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DietPlan", dietPlanSchema);