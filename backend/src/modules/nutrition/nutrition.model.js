const mongoose = require("mongoose");

const macroSchema = new mongoose.Schema(
  {
    calories: { type: Number, required: true },
    protein: { type: Number, required: true },
    carbs: { type: Number, required: true },
    fats: { type: Number, required: true },
    fiber: { type: Number, default: 0 }
  },
  { _id: false }
);

const foodItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },

    category: {
      type: String,
      enum: ["breakfast", "lunch", "dinner", "snack"],
      required: true
    },

    dietType: {
      type: String,
      enum: ["veg", "non-veg", "vegan"],
      required: true
    },

    isIndian: { type: Boolean, default: true },

    per100g: { type: macroSchema, required: true },

    tags: [String] // high-protein, low-carb, etc.
  },
  { timestamps: true }
);

module.exports = mongoose.model("FoodItem", foodItemSchema);