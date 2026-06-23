require("dotenv").config();
const connectDB = require("../config/db");
const DietProgress = require("../modules/nutrition/dietProgress.model");

async function run() {
  await connectDB();

  const userId = "69f9e56ba2f58100be3e27c7"; // find this in your `users` collection

  const today = new Date();
  const dateStr = (daysAgo) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };

  await DietProgress.deleteMany({ user: userId }); // clean slate

  await DietProgress.insertMany([
  { user: userId, date: dateStr(0), mealsCompleted: { breakfast: true, lunch: true, dinner: true, snack: false }, caloriesConsumed: 1900, weight: 70.0 },
  { user: userId, date: dateStr(1), mealsCompleted: { breakfast: true, lunch: true, dinner: true, snack: true },  caloriesConsumed: 2000, weight: 70.2 },
  { user: userId, date: dateStr(2), mealsCompleted: { breakfast: true, lunch: true, dinner: false, snack: false }, caloriesConsumed: 1850 },
  { user: userId, date: dateStr(3), mealsCompleted: { breakfast: true, lunch: true, dinner: true, snack: false }, caloriesConsumed: 1950, weight: 70.4 },
  { user: userId, date: dateStr(4), mealsCompleted: { breakfast: true, lunch: true, dinner: true, snack: true },  caloriesConsumed: 1980, weight: 70.5 },
  { user: userId, date: dateStr(5), mealsCompleted: { breakfast: true, lunch: true, dinner: true, snack: false }, caloriesConsumed: 1920, weight: 70.6 },
  { user: userId, date: dateStr(6), mealsCompleted: { breakfast: true, lunch: true, dinner: true, snack: false }, caloriesConsumed: 1900, weight: 70.6 },
]);

  console.log("Seeded test data.");
  process.exit(0);
}

run();