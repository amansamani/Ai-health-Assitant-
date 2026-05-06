const mealItemSchema = new mongoose.Schema(
  {
    foodId:   { type: mongoose.Schema.Types.ObjectId, ref: "FoodItem" },
    name:     String,
    category: String,

    grams:    Number,
    calories: Number,
    protein:  Number,
    carbs:    Number,
    fats:     Number,

    fiber:    Number,
    sugar:    Number,
    sodium:   Number,

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