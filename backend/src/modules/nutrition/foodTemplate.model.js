const mongoose = require("mongoose");

const foodTemplateSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "foodtemplate" }
);

module.exports = mongoose.model(
  "FoodTemplate",
  foodTemplateSchema
);