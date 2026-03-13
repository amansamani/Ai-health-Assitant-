const mongoose = require("mongoose");

const foodItemSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  brand:    { type: String, default: "" },
  quantity: { type: Number, required: true }, // grams
  unit:     { type: String, default: "g" },
  calories: { type: Number, required: true },
  protein:  { type: Number, default: 0 },
  carbs:    { type: Number, default: 0 },
  fats:     { type: Number, default: 0 },
  fiber:    { type: Number, default: 0 },
  sugar:    { type: Number, default: 0 },
  sodium:   { type: Number, default: 0 },
});

const mealLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mealType: {
      type: String,
      enum: ["breakfast", "lunch","snacks","dinner"],
      required: true,
    },
    food:     { type: foodItemSchema, required: true },
    loggedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MealLog", mealLogSchema);