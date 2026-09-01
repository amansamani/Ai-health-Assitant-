const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────
// Macronutrients per 100g
// ─────────────────────────────────────────────────────
const macroSchema = new mongoose.Schema(
{
  calories: { type: Number, required: true },
  protein:  { type: Number, required: true },
  carbs:    { type: Number, required: true },
  fats:     { type: Number, required: true },
  fiber:    { type: Number, default: 0 }
},
{ _id: false }
);


// ─────────────────────────────────────────────────────
// Serving definition (for piece-based foods)
// Example:
// roti → 1 piece = 40g
// egg  → 1 piece = 50g
// ─────────────────────────────────────────────────────
const servingSchema = new mongoose.Schema(
{
  unit: {
    type: String,
    enum: ["g", "piece"],
    default: "g"
  },

  grams: {
    type: Number,
    default: 100
  }
},
{ _id: false }
);


// ─────────────────────────────────────────────────────
// Food Item Schema
// ─────────────────────────────────────────────────────
const foodItemSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: true,
    unique: true
  },

  category: {
    type: String,
    enum: ["breakfast", "lunch", "snack", "dinner"],
    required: true
  },

  dietType: {
    type: String,
    enum: ["veg", "non-veg", "vegan"],
    required: true
  },

  isIndian: {
    type: Boolean,
    default: true
  },

  // Nutrition values per 100g
  per100g: {
    type: macroSchema,
    required: true
  },

  // Portion information
  serving: {
    type: servingSchema,
    default: () => ({ unit: "g", grams: 100 })
  },

  // Optional tags
  tags: [String]

},
{ timestamps: true }
);


// ─────────────────────────────────────────────────────
module.exports = mongoose.model("FoodItem", foodItemSchema);