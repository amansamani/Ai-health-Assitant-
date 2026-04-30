const FoodItem = require("./nutrition.model");
const DietProgress = require("./dietProgress.model");

const MEAL_STRUCTURE = {
  breakfast: [
    { role: "main",    category: "breakfast", required: true  },
    { role: "side",    category: "breakfast", required: false },
  ],
  lunch: [
    { role: "carb",    category: "lunch", required: true,  preferHighCarb: true  },
    { role: "protein", category: "lunch", required: true,  preferHighProtein: true },
    { role: "side",    category: "lunch", required: false },
  ],
  dinner: [
    { role: "protein", category: "dinner", required: true,  preferHighProtein: true },
    { role: "side",    category: "dinner", required: false },
    { role: "carb",    category: "lunch",  required: false, preferHighCarb: true },
  ],
  snack: [
    { role: "snack",  category: "snack", required: true  },
    { role: "snack2", category: "snack", required: false },
  ],
};

const CALORIE_SPLIT = {
  breakfast: 0.25,
  lunch:     0.35,
  dinner:    0.30,
  snack:     0.10,
};

const PORTION_LIMITS = {
  main:    { min: 80,  max: 300 },
  protein: { min: 80,  max: 250 },
  carb:    { min: 80,  max: 300 },
  side:    { min: 50,  max: 150 },
  snack:   { min: 30,  max: 100 },
  snack2:  { min: 30,  max: 80  },
};

// ─────────────────────────────────────────────────────────────────────────────
async function generateDietPlan(profile) {
  const { targetCalories, dietType, goal } = profile;

  const dietFilter = dietType === "veg"
    ? { dietType: "veg" }
    : { dietType: { $in: ["veg", "non-veg"] } };

  const allFoods = await FoodItem.find(dietFilter);
  if (allFoods.length === 0) throw new Error("No food items found");

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

  for (const [mealName, slots] of Object.entries(MEAL_STRUCTURE)) {
    const mealCalBudget = targetCalories * CALORIE_SPLIT[mealName];
    let   mealCalsUsed  = 0;
    const requiredCount = slots.filter(s => s.required).length || 1;
    const calPerSlot    = mealCalBudget / requiredCount;

    for (const slot of slots) {
      let candidates = (byCategory[slot.category] || [])
        .filter(f => !usedIds.has(f._id.toString()));

      if (candidates.length === 0) {
        candidates = byCategory[slot.category] || [];
      }

      if (candidates.length === 0) {
        if (slot.required) {
          candidates = allFoods.filter(f => !usedIds.has(f._id.toString()));
          if (candidates.length === 0) candidates = allFoods;
        } else {
          continue;
        }
      }

      const food = pickFood(candidates, goal, slot);
      if (!food) continue;

      const budget     = mealCalsUsed === 0 ? calPerSlot * 0.7 : calPerSlot * 0.5;
      const grams      = calcGrams(food, budget, slot.role);
      const calories   = Math.round((food.per100g.calories * grams) / 100);
      const protein    = parseFloat(((food.per100g.protein * grams) / 100).toFixed(1));
      const carbs      = parseFloat(((food.per100g.carbs   * grams) / 100).toFixed(1));
      const fats       = parseFloat(((food.per100g.fats    * grams) / 100).toFixed(1));

      // ── Serving info ───────────────────────────────────────────────────────
      const servingUnit   = food.serving?.unit   || "g";
      const gramsPerPiece = food.serving?.grams  || null;
      // Calculate pieces — round to nearest whole piece
      const pieces = servingUnit === "piece" && gramsPerPiece
        ? Math.max(1, Math.round(grams / gramsPerPiece))
        : null;
      // Recalculate actual grams from rounded pieces (so nutrition is accurate)
      const finalGrams = pieces ? pieces * gramsPerPiece : grams;
      const finalCals  = pieces ? Math.round((food.per100g.calories * finalGrams) / 100) : calories;
      const finalPro   = pieces ? parseFloat(((food.per100g.protein * finalGrams) / 100).toFixed(1)) : protein;
      const finalCarbs = pieces ? parseFloat(((food.per100g.carbs   * finalGrams) / 100).toFixed(1)) : carbs;
      const finalFats  = pieces ? parseFloat(((food.per100g.fats    * finalGrams) / 100).toFixed(1)) : fats;

      meals[mealName].push({
        foodId:       food._id,
        name:         food.name,
        grams:        finalGrams,
        calories:     finalCals,
        protein:      finalPro,
        carbs:        finalCarbs,
        fats:         finalFats,
        servingUnit,
        gramsPerPiece,
        pieces,
      });

      mealCalsUsed += finalCals;
      usedIds.add(food._id.toString());
    }
  }

  return meals;
}

// ─────────────────────────────────────────────────────────────────────────────
function pickFood(candidates, goal, slot) {
  if (!candidates || candidates.length === 0) return null;

  const scored = candidates.map(food => {
    const p = food.per100g;
    let score = 0;

    if (goal === "lose") {
      score += p.protein * 3;
      score -= p.calories * 0.04;
      score += (p.fiber || 0) * 2;
    } else if (goal === "gain") {
      score += p.calories * 0.04;
      score += p.protein * 2;
      score += p.carbs * 0.5;
    } else {
      score += p.protein * 2;
      score += (p.fiber || 0) * 1.5;
    }

    if (slot.preferHighProtein) score += p.protein * 2;
    if (slot.preferHighCarb)    score += p.carbs * 2;

    score *= 0.85 + Math.random() * 0.3;
    return { food, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].food;
}

// ─────────────────────────────────────────────────────────────────────────────
function calcGrams(food, calBudget, role) {
  const calPer100g = food.per100g.calories;
  if (!calPer100g || calPer100g === 0) return 100;

  const raw = (calBudget / calPer100g) * 100;
  const { min, max } = PORTION_LIMITS[role] || { min: 50, max: 200 };
  const clamped = Math.max(min, Math.min(raw, max));
  return Math.round(clamped / 10) * 10;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─────────────────────────────────────────────────────────────────────────────
async function evaluateWeeklyProgress(userId, profile) {
  const today = new Date();
  const last7Days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    last7Days.push(d.toISOString().split("T")[0]);
  }

  const logs = await DietProgress.find({ user: userId, date: { $in: last7Days } });
  if (logs.length < 4) return { adjust: false, reason: "Not enough data" };

  let completedDays = 0, totalCalories = 0, weights = [];
  for (const log of logs) {
    const mealsDone = Object.values(log.mealsCompleted).filter(Boolean).length;
    if (mealsDone >= 3) completedDays++;
    totalCalories += log.caloriesConsumed;
    if (log.weight) weights.push(log.weight);
  }

  if (weights.length < 2) return { adjust: false, reason: "Not enough weight data" };

  return {
    adjust:       true,
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
  if (goal === "gain") {
    if (weightChange <= 0) adjustment = +150;
  }

  return {
    change:      adjustment,
    newCalories: Math.max(targetCalories + adjustment, goal === "lose" ? 1200 : 1500),
  };
}

// GET /api/nutrition/foods?tags=high-protein,gym&category=lunch&dietType=veg&search=paneer&match=any
 const searchFoodsByFilter = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.tags?.length)  query.set("tags",     params.tags.join(","));
  if (params.category)      query.set("category", params.category);
  if (params.dietType)      query.set("dietType", params.dietType);
  if (params.search)        query.set("search",   params.search);
  if (params.match)         query.set("match",    params.match);        // "any" | "all"
  const res = await API.get(`/nutrition/foods?${query.toString()}`);
  return res.data?.data || [];
};

module.exports = { generateDietPlan, evaluateWeeklyProgress, calculateNewCalories, searchFoodsByFilter };