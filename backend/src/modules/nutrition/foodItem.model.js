"use strict";
const mongoose = require("mongoose");

const foodItemSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "fooditems" }
);

module.exports = mongoose.model("FoodItem", foodItemSchema);