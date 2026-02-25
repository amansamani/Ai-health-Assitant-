const FoodItem = require("./nutrition.model");
const DietProgress = require("./dietProgress.model");
/**
 * MAIN FUNCTION
 */
async function generateDietPlan(profile) {
  const { proteinTarget, carbTarget, fatTarget, dietType } = profile;

  const foods = await FoodItem.find({ dietType });

  const proteinFoods = foods.filter(f => f.per100g.protein >= 10);
  const carbFoods = foods.filter(f => f.per100g.carbs >= 15);
  const fatFoods = foods.filter(f => f.per100g.fats >= 10);

  const plan = [];

  // 1️⃣ Protein anchor
  const proteinPlan = buildProteinBase(proteinFoods, proteinTarget);
  plan.push(...proteinPlan);

  const currentMacros = calculateTotalMacros(plan);

  let remainingCarbs = carbTarget - currentMacros.carbs;
  let remainingFats = fatTarget - currentMacros.fats;

  // 2️⃣ Add carb source
  if (remainingCarbs > 0 && carbFoods.length > 0) {
    const carbFood =
      carbFoods[Math.floor(Math.random() * carbFoods.length)];

    const grams = calculateGramsForMacro(
      carbFood,
      "carbs",
      remainingCarbs
    );

    plan.push({
      food: carbFood,
      grams: clampGrams(grams, 30, 300)
    });
  }

  // 3️⃣ Add fat source
  if (remainingFats > 0 && fatFoods.length > 0) {
    const fatFood =
      fatFoods[Math.floor(Math.random() * fatFoods.length)];

    const grams = calculateGramsForMacro(
      fatFood,
      "fats",
      remainingFats
    );

    plan.push({
      food: fatFood,
      grams: clampGrams(grams, 10, 100)
    });
  }

  // 4️⃣ Distribute into meals
  const distributedMeals = distributeIntoMeals(plan);

  return distributedMeals;
}

async function evaluateWeeklyProgress(userId, profile) {
  const today = new Date();
  const last7Days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    last7Days.push(d.toISOString().split("T")[0]);
  }

  const logs = await DietProgress.find({
    user: userId,
    date: { $in: last7Days }
  });

  if (logs.length < 4) {
    return { adjust: false, reason: "Not enough data" };
  }

  // Calculate adherence
  let completedDays = 0;
  let totalCalories = 0;
  let weights = [];

  for (let log of logs) {
    const mealsDone = Object.values(log.mealsCompleted)
      .filter(Boolean).length;

    if (mealsDone >= 3) completedDays++;

    totalCalories += log.caloriesConsumed;

    if (log.weight) weights.push(log.weight);
  }

  const adherence = (completedDays / 7) * 100;
  const avgCalories = totalCalories / logs.length;

  if (weights.length < 2) {
    return { adjust: false, reason: "Not enough weight data" };
  }

  const weightChange =
    weights[weights.length - 1] - weights[0];

  return {
    adjust: true,
    adherence,
    avgCalories,
    weightChange
  };
}

/**
 * Calculate grams required for a macro
 */
function calculateGramsForMacro(food, macroName, targetGrams) {
  const macroPer100g = food.per100g[macroName];

  if (!macroPer100g || macroPer100g === 0) return 0;

  const gramsNeeded = (targetGrams / macroPer100g) * 100;

  return Math.round(gramsNeeded);
}

/**
 * Clamp grams between min and max and round to nearest 10
 */
function clampGrams(grams, min, max) {
  const rounded = Math.round(grams / 10) * 10;
  return Math.max(min, Math.min(rounded, max));
}

/**
 * Build protein base first
 */
function buildProteinBase(proteinFoods, proteinTarget) {
  const selectedFoods = [];

  let remainingProtein = proteinTarget;

  for (let food of proteinFoods) {
    if (remainingProtein <= 0) break;

    const grams = calculateGramsForMacro(
      food,
      "protein",
      remainingProtein
    );

    const safeGrams = clampGrams(grams, 30, 300);

    selectedFoods.push({
      food,
      grams: safeGrams
    });

    const proteinProvided =
      (food.per100g.protein * safeGrams) / 100;

    remainingProtein -= proteinProvided;
  }

  return selectedFoods;
}

/**
 * Calculate total macros of selected foods
 */
function calculateTotalMacros(selectedFoods) {
  let totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0
  };

  for (let item of selectedFoods) {
    const { food, grams } = item;

    totals.calories += (food.per100g.calories * grams) / 100;
    totals.protein += (food.per100g.protein * grams) / 100;
    totals.carbs += (food.per100g.carbs * grams) / 100;
    totals.fats += (food.per100g.fats * grams) / 100;
  }

  return totals;
}

/**
 * Distribute foods into meals
 */
function distributeIntoMeals(plan) {
  const meals = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: []
  };

  for (let item of plan) {
    const category = item.food.category;

    if (meals[category]) {
      meals[category].push({
        foodId: item.food._id,
        name: item.food.name,
        grams: item.grams
      });
    }
  }

  return meals;
}

function calculateNewCalories(profile, evaluation) {
  const { goal, targetCalories } = profile;
  const { adherence, weightChange } = evaluation;

  if (adherence < 70) {
    return { change: 0, reason: "Low adherence" };
  }

  let adjustment = 0;

  if (goal === "lose") {
    if (weightChange >= 0) adjustment = -100;
    if (weightChange < -1.2) adjustment = +100;
  }

  if (goal === "gain") {
    if (weightChange <= 0) adjustment = +150;
  }

  const newCalories = Math.max(
    targetCalories + adjustment,
    goal === "lose" ? 1200 : 1500
  );

  return {
    change: adjustment,
    newCalories
  };
}

function recalculateMacros(profile) {
  const { targetCalories, weight, goal } = profile;

  // 1️⃣ Protein anchor (2g per kg safe default)
  const proteinGrams = Math.round(weight * 2);
  const proteinCalories = proteinGrams * 4;

  let carbPercent = 0.4;
  let fatPercent = 0.3;

  if (goal === "lose") {
    carbPercent = 0.35;
    fatPercent = 0.25;
  }

  if (goal === "gain") {
    carbPercent = 0.5;
    fatPercent = 0.2;
  }

  const remainingCalories = targetCalories - proteinCalories;

  const carbCalories = remainingCalories * carbPercent;
  const fatCalories = remainingCalories * fatPercent;

  profile.proteinTarget = proteinGrams;
  profile.carbTarget = Math.round(carbCalories / 4);
  profile.fatTarget = Math.round(fatCalories / 9);

  return profile;
}

module.exports = {
  generateDietPlan,
  evaluateWeeklyProgress,
  calculateNewCalories
};