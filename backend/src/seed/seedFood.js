const mongoose = require("mongoose");
require("dotenv").config();

const FoodItem = require("../modules/nutrition/nutrition.model");

const foods = [
  {
    name: "White Rice (Cooked)",
    category: "lunch",
    dietType: "veg",
    per100g: {
      calories: 130,
      protein: 2.4,
      carbs: 28,
      fats: 0.3,
      fiber: 0.4
    }
  },
  {
    name: "Roti",
    category: "lunch",
    dietType: "veg",
    per100g: {
      calories: 297,
      protein: 9,
      carbs: 57,
      fats: 3,
      fiber: 4
    }
  },
  {
    name: "Paneer",
    category: "dinner",
    dietType: "veg",
    per100g: {
      calories: 265,
      protein: 18,
      carbs: 1.2,
      fats: 20,
      fiber: 0
    }
  },
  {
    name: "Egg",
    category: "breakfast",
    dietType: "non-veg",
    per100g: {
      calories: 155,
      protein: 13,
      carbs: 1.1,
      fats: 11,
      fiber: 0
    }
  },
  {
    name: "Chicken Breast",
    category: "dinner",
    dietType: "non-veg",
    per100g: {
      calories: 165,
      protein: 31,
      carbs: 0,
      fats: 3.6,
      fiber: 0
    }
  },
  {
    name: "Oats",
    category: "breakfast",
    dietType: "veg",
    per100g: {
      calories: 389,
      protein: 17,
      carbs: 66,
      fats: 7,
      fiber: 10
    }
  },
  {
  name: "Dal (Cooked)",
  category: "lunch",
  dietType: "veg",
  per100g: {
    calories: 116,
    protein: 9,
    carbs: 20,
    fats: 0.4,
    fiber: 7
  }
},
{
  name: "Milk (Full Cream)",
  category: "breakfast",
  dietType: "veg",
  per100g: {
    calories: 60,
    protein: 3.2,
    carbs: 5,
    fats: 3.3,
    fiber: 0
  }
},
{
  name: "Curd",
  category: "lunch",
  dietType: "veg",
  per100g: {
    calories: 61,
    protein: 3.5,
    carbs: 4.7,
    fats: 3.3,
    fiber: 0
  }
},
{
  name: "Rohu Fish",
  category: "dinner",
  dietType: "non-veg",
  per100g: {
    calories: 97,
    protein: 17,
    carbs: 0,
    fats: 2,
    fiber: 0
  }
},
{
  name: "Banana",
  category: "snack",
  dietType: "veg",
  per100g: {
    calories: 89,
    protein: 1.1,
    carbs: 23,
    fats: 0.3,
    fiber: 2.6
  }
},
{
  name: "Apple",
  category: "snack",
  dietType: "veg",
  per100g: {
    calories: 52,
    protein: 0.3,
    carbs: 14,
    fats: 0.2,
    fiber: 2.4
  }
},
{
  name: "Peanuts",
  category: "snack",
  dietType: "veg",
  per100g: {
    calories: 567,
    protein: 26,
    carbs: 16,
    fats: 49,
    fiber: 8
  }
},
{
  name: "Peanut Butter",
  category: "snack",
  dietType: "veg",
  per100g: {
    calories: 588,
    protein: 25,
    carbs: 20,
    fats: 50,
    fiber: 6
  }
},
{
  name: "Brown Rice (Cooked)",
  category: "lunch",
  dietType: "veg",
  per100g: {
    calories: 112,
    protein: 2.6,
    carbs: 23,
    fats: 0.9,
    fiber: 1.8
  }
},
{
  name: "Rajma (Cooked)",
  category: "lunch",
  dietType: "veg",
  per100g: {
    calories: 127,
    protein: 8.7,
    carbs: 22.8,
    fats: 0.5,
    fiber: 6.4
  }
},
{
  name: "Chole (Cooked Chickpeas)",
  category: "lunch",
  dietType: "veg",
  per100g: {
    calories: 164,
    protein: 9,
    carbs: 27,
    fats: 2.6,
    fiber: 7.6
  }
},
{
  name: "Mixed Vegetables",
  category: "dinner",
  dietType: "veg",
  per100g: {
    calories: 65,
    protein: 2,
    carbs: 12,
    fats: 0.5,
    fiber: 3
  }
},
{
  name: "Buttermilk",
  category: "snack",
  dietType: "veg",
  per100g: {
    calories: 40,
    protein: 3,
    carbs: 5,
    fats: 1,
    fiber: 0
  }
},

];

async function seedFood() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    await FoodItem.deleteMany(); // clear old data
    await FoodItem.insertMany(foods);

    console.log("Food items seeded successfully!");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedFood();