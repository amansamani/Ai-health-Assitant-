const FoodItem = require("./nutrition.model");
const DietProgress = require("./dietProgress.model");

// ─────────────────────────────────────────────────────────────────────────────
// Calorie % split per meal
// ─────────────────────────────────────────────────────────────────────────────
const CALORIE_SPLIT = {
  breakfast: 0.25,
  lunch:     0.35,
  dinner:    0.30,
  snack:     0.10,
};

// Realistic portion sizes in grams per item type
const PORTIONS = {
  breakfast_main:  { min: 100, max: 250 },
  breakfast_side:  { min:  80, max: 200 },
  lunch_carb:      { min: 100, max: 300 },
  lunch_protein:   { min: 100, max: 200 },
  lunch_side:      { min:  80, max: 150 },
  dinner_protein:  { min: 100, max: 250 },
  dinner_side:     { min:  80, max: 150 },
  snack_main:      { min:  30, max: 100 },
};

// ─────────────────────────────────────────────────────────────────────────────
async function generateDietPlan(profile) {
  const { targetCalories, dietType, goal } = profile;

  // Fetch all matching foods
  const dietFilter = dietType === "veg"
    ? { dietType: "veg" }
    : { dietType: { $in: ["veg", "non-veg"] } };

  const allFoods = await FoodItem.find(dietFilter).lean();
  if (allFoods.length === 0) throw new Error("No food items found in DB");

  // Group by category and shuffle for variety
  const byCategory = {};
  for (const food of allFoods) {
    if (!byCategory[food.category]) byCategory[food.category] = [];
    byCategory[food.category].push(food);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat] = shuffle(byCategory[cat]);
  }

  const meals   = { breakfast: [], lunch: [], dinner: [], snack: [] };
  const usedIds = new Set();

  // ── BREAKFAST ──────────────────────────────────────────────────────────────
  const bfCals    = targetCalories * CALORIE_SPLIT.breakfast;
  const bfFoods   = byCategory["breakfast"] || [];

  const bfMain = pickUnused(bfFoods, usedIds, goal, "any");
  if (bfMain) {
    const grams = calcGrams(bfMain, bfCals * 0.65, PORTIONS.breakfast_main);
    addToMeal(meals.breakfast, bfMain, grams);
    usedIds.add(str(bfMain._id));
  }

  // Only add side if there's a DIFFERENT breakfast food available
  const bfSide = pickUnused(bfFoods, usedIds, goal, "any");
  if (bfSide) {
    const grams = calcGrams(bfSide, bfCals * 0.35, PORTIONS.breakfast_side);
    addToMeal(meals.breakfast, bfSide, grams);
    usedIds.add(str(bfSide._id));
  }

  // ── LUNCH ──────────────────────────────────────────────────────────────────
  const lunchCals  = targetCalories * CALORIE_SPLIT.lunch;
  const lunchFoods = byCategory["lunch"] || [];

  // 1. Carb (rice, roti, etc.)
  const lunchCarb = pickUnused(lunchFoods, usedIds, goal, "carb");
  if (lunchCarb) {
    const grams = calcGrams(lunchCarb, lunchCals * 0.40, PORTIONS.lunch_carb);
    addToMeal(meals.lunch, lunchCarb, grams);
    usedIds.add(str(lunchCarb._id));
  }

  // 2. Protein (dal, rajma, chole, etc.)
  const lunchProtein = pickUnused(lunchFoods, usedIds, goal, "protein");
  if (lunchProtein) {
    const grams = calcGrams(lunchProtein, lunchCals * 0.40, PORTIONS.lunch_protein);
    addToMeal(meals.lunch, lunchProtein, grams);
    usedIds.add(str(lunchProtein._id));
  }

  // 3. Optional side (curd, veggie)
  const lunchSide = pickUnused(lunchFoods, usedIds, goal, "any");
  if (lunchSide) {
    const grams = calcGrams(lunchSide, lunchCals * 0.20, PORTIONS.lunch_side);
    addToMeal(meals.lunch, lunchSide, grams);
    usedIds.add(str(lunchSide._id));
  }

  // ── DINNER ─────────────────────────────────────────────────────────────────
  const dinnerCals  = targetCalories * CALORIE_SPLIT.dinner;
  const dinnerFoods = byCategory["dinner"] || [];

  // 1. Main protein
  const dinnerMain = pickUnused(dinnerFoods, usedIds, goal, "protein");
  if (dinnerMain) {
    const grams = calcGrams(dinnerMain, dinnerCals * 0.55, PORTIONS.dinner_protein);
    addToMeal(meals.dinner, dinnerMain, grams);
    usedIds.add(str(dinnerMain._id));
  }

  // 2. Side dish
  const dinnerSide = pickUnused(dinnerFoods, usedIds, goal, "any");
  if (dinnerSide) {
    const grams = calcGrams(dinnerSide, dinnerCals * 0.30, PORTIONS.dinner_side);
    addToMeal(meals.dinner, dinnerSide, grams);
    usedIds.add(str(dinnerSide._id));
  }

  // 3. Carb side — roti or rice from lunch category
  const dinnerCarb = pickUnused(byCategory["lunch"] || [], usedIds, goal, "carb");
  if (dinnerCarb) {
    const grams = calcGrams(dinnerCarb, dinnerCals * 0.20, PORTIONS.lunch_carb);
    addToMeal(meals.dinner, dinnerCarb, grams);
    usedIds.add(str(dinnerCarb._id));
  }

  // ── SNACK ──────────────────────────────────────────────────────────────────
  const snackCals  = targetCalories * CALORIE_SPLIT.snack;
  const snackFoods = byCategory["snack"] || [];

  const snack1 = pickUnused(snackFoods, usedIds, goal, "any");
  if (snack1) {
    const grams = calcGrams(snack1, snackCals * 0.60, PORTIONS.snack_main);
    addToMeal(meals.snack, snack1, grams);
    usedIds.add(str(snack1._id));
  }

  const snack2 = pickUnused(snackFoods, usedIds, goal, "any");
  if (snack2) {
    const grams = calcGrams(snack2, snackCals * 0.40, PORTIONS.snack_main);
    addToMeal(meals.snack, snack2, grams);
    usedIds.add(str(snack2._id));
  }

  return meals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Add food to meal array with all nutrition calculated
function addToMeal(mealArr, food, grams) {
  const r = grams / 100;
  mealArr.push({
    foodId:   food._id,
    name:     food.name,
    grams,
    calories: Math.round(food.per100g.calories * r),
    protein:  parseFloat((food.per100g.protein * r).toFixed(1)),
    carbs:    parseFloat((food.per100g.carbs   * r).toFixed(1)),
    fats:     parseFloat((food.per100g.fats    * r).toFixed(1)),
  });
}

// Pick best unused food from list based on goal + role
function pickUnused(foods, usedIds, goal, role) {
  const available = foods.filter(f => !usedIds.has(str(f._id)));
  if (available.length === 0) return null;

  const scored = available.map(food => {
    const p = food.per100g;
    let score = 0;

    if (goal === "lose") {
      score += p.protein * 3;
      score -= p.calories * 0.04;
      score += (p.fiber || 0) * 2;
    } else if (goal === "gain") {
      score += p.calories * 0.03;
      score += p.protein * 2;
      score += p.carbs * 0.5;
    } else {
      score += p.protein * 2;
      score += (p.fiber || 0) * 1.5;
    }

    // Role bonus
    if (role === "carb")    score += p.carbs * 2;
    if (role === "protein") score += p.protein * 2;

    // Random factor for variety
    score *= 0.85 + Math.random() * 0.3;
    return { food, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].food;
}

// Calculate grams to match a calorie budget, clamped to portion limits
function calcGrams(food, calBudget, portion) {
  const calPer100 = food.per100g.calories;
  if (!calPer100 || calPer100 === 0) return portion.min;
  const raw     = (calBudget / calPer100) * 100;
  const clamped = Math.max(portion.min, Math.min(raw, portion.max));
  return Math.round(clamped / 10) * 10;
}

// Shuffle array in place (Fisher-Yates)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function str(id) { return id?.toString(); }

// ─────────────────────────────────────────────────────────────────────────────
// Weekly evaluation & calorie adjustment (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
async function evaluateWeeklyProgress(userId, profile) {
  const last7Days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toISOString().split("T")[0]);
  }

  const logs = await DietProgress.find({ user: userId, date: { $in: last7Days } });
  if (logs.length < 4) return { adjust: false, reason: "Not enough data" };

  let completedDays = 0, totalCalories = 0, weights = [];
  for (const log of logs) {
    if (Object.values(log.mealsCompleted).filter(Boolean).length >= 3) completedDays++;
    totalCalories += log.caloriesConsumed;
    if (log.weight) weights.push(log.weight);
  }
  if (weights.length < 2) return { adjust: false, reason: "Not enough weight data" };

  return {
    adjust: true,
    adherence:    (completedDays / 7) * 100,
    avgCalories:  totalCalories / logs.length,
    weightChange: weights[weights.length - 1] - weights[0],
  };
}

function calculateNewCalories(profile, evaluation) {
  const { goal, targetCalories } = profile;
  const { adherence, weightChange } = evaluation;
  if (adherence < 70) return { change: 0, reason: "Low adherence" };

  let adjustment = 0;
  if (goal === "lose") {
    if (weightChange >= 0)   adjustment = -100;
    if (weightChange < -1.2) adjustment = +100;
  }
  if (goal === "gain" && weightChange <= 0) adjustment = +150;

  return {
    change:      adjustment,
    newCalories: Math.max(targetCalories + adjustment, goal === "lose" ? 1200 : 1500),
  };
}

module.exports = { generateDietPlan, evaluateWeeklyProgress, calculateNewCalories };