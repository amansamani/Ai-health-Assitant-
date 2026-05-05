"use strict";

const FoodItem     = require("./nutrition.model");
const DietProgress = require("./dietProgress.model");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each meal has "slots". Each slot asks for a food from a specific category
 * and optionally prefers a macro direction (high-protein, high-carb, etc.)
 *
 * calShare: fraction of the meal's own calorie budget given to this slot.
 * If calShares in a meal don't sum to 1.0, remaining budget is discarded.
 */
const MEAL_STRUCTURE = {
  breakfast: [
    { role: "main",    category: "breakfast", required: true,  calShare: 0.65 },
    { role: "side",    category: "breakfast", required: false, calShare: 0.35 },
  ],
  lunch: [
    { role: "carb",    category: "lunch",   required: true,  calShare: 0.45, preferHighCarb: true    },
    { role: "protein", category: "lunch",   required: true,  calShare: 0.40, preferHighProtein: true },
    { role: "side",    category: "lunch",   required: false, calShare: 0.15 },
  ],
  dinner: [
    { role: "protein", category: "dinner",  required: true,  calShare: 0.45, preferHighProtein: true },
    { role: "carb",    category: "dinner",  required: false, calShare: 0.35, preferHighCarb: true    }, // ✅ fixed: was "lunch"
    { role: "side",    category: "dinner",  required: false, calShare: 0.20 },
  ],
  snack: [
    { role: "snack",  category: "snack",   required: true,  calShare: 0.60 },
    { role: "snack2", category: "snack",   required: false, calShare: 0.40 },
  ],
};

/** Fraction of daily calories allocated to each meal */
const CALORIE_SPLIT = {
  breakfast: 0.25,
  lunch:     0.35,
  dinner:    0.30,
  snack:     0.10,
};

/** Gram limits per slot role */
const PORTION_LIMITS = {
  main:    { min: 80,  max: 300 },
  protein: { min: 80,  max: 250 },
  carb:    { min: 80,  max: 300 },
  side:    { min: 40,  max: 150 },
  snack:   { min: 30,  max: 100 },
  snack2:  { min: 30,  max: 80  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BMR / TDEE CALCULATION (Mifflin-St Jeor)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate daily calorie target from user profile.
 *
 * Profile fields used:
 *   age          {number}  — years
 *   gender       {string}  — "male" | "female"
 *   weightKg     {number}  — current weight in kg
 *   heightCm     {number}  — height in cm
 *   activityLevel{string}  — "sedentary" | "light" | "moderate" | "active" | "very_active"
 *   goal         {string}  — "lose" | "maintain" | "gain"
 *   targetCalories {number} — optional override; skips calculation if provided
 */
function computeTargetCalories(profile) {
  // If the caller already calculated calories (e.g. from onboarding), use that
  if (profile.targetCalories && profile.targetCalories > 800) {
    return profile.targetCalories;
  }

  const { age, gender, weightKg, heightCm, activityLevel, goal } = profile;

  if (!age || !gender || !weightKg || !heightCm) {
    throw new Error(
      "Profile must include age, gender, weightKg, and heightCm to calculate calorie target."
    );
  }

  // Mifflin-St Jeor BMR
  let bmr =
    gender === "female"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;

  const ACTIVITY_MULTIPLIERS = {
    sedentary:   1.2,
    light:       1.375,
    moderate:    1.55,
    active:      1.725,
    very_active: 1.9,
  };

  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.375;
  let tdee = bmr * multiplier;

  // Goal adjustment
  if (goal === "lose")     tdee -= 500;   // ~0.5 kg/week deficit
  if (goal === "gain")     tdee += 400;   // lean bulk

  // Hard floor for safety
  const floor = gender === "female" ? 1200 : 1500;
  return Math.max(Math.round(tdee), floor);
}

// ─────────────────────────────────────────────────────────────────────────────
// MACRO TARGETS  (personalised from profile)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns target macros in grams for the day.
 *
 * Protein target scales with weight & goal:
 *   - lose:     2.0 g / kg  (preserve muscle on deficit)
 *   - gain:     2.2 g / kg  (support muscle synthesis)
 *   - maintain: 1.8 g / kg
 *
 * Remaining calories split between carbs (55 %) and fats (45 %).
 */
function computeMacroTargets(profile, targetCalories) {
  const weightKg = profile.weightKg || 70;
  const proteinMultipliers = { lose: 2.0, gain: 2.2, maintain: 1.8 };
  const proteinPerKg = proteinMultipliers[profile.goal] || 1.8;

  const proteinG  = Math.round(weightKg * proteinPerKg);
  const proteinCal = proteinG * 4;
  const remaining  = Math.max(targetCalories - proteinCal, 0);
  const carbsG     = Math.round((remaining * 0.55) / 4);
  const fatsG      = Math.round((remaining * 0.45) / 9);

  return { proteinG, carbsG, fatsG };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: generateDietPlan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a one-day personalised diet plan for a user.
 *
 * @param {Object} profile
 *   {string}  dietType       — "veg" | "non-veg" | "vegan"
 *   {string}  goal           — "lose" | "maintain" | "gain"
 *   {number}  [targetCalories]  — override; otherwise computed from BMR
 *   {number}  age
 *   {string}  gender         — "male" | "female"
 *   {number}  weightKg
 *   {number}  heightCm
 *   {string}  activityLevel
 *   {string[]} [allergies]   — food names / tags to exclude (optional)
 *   {string[]} [dislikedFoods] — food _id strings to skip (optional)
 *
 * @returns {Object}  { meals, summary }
 */
async function generateDietPlan(profile) {
  // ── 1. Compute calorie & macro targets ────────────────────────────────────
  const targetCalories = computeTargetCalories(profile);
  const macros         = computeMacroTargets(profile, targetCalories);

  // ── 2. Fetch eligible foods from MongoDB ──────────────────────────────────
  const dietFilter =
    profile.dietType === "veg" || profile.dietType === "vegan"
      ? { dietType: profile.dietType === "vegan" ? "vegan" : "veg" }
      : { dietType: { $in: ["veg", "non-veg"] } };

  // Exclude allergies / disliked foods if provided
  const exclusionFilter = {};
  if (profile.dislikedFoods?.length) {
    exclusionFilter._id = { $nin: profile.dislikedFoods };
  }
  if (profile.allergies?.length) {
    // Assume allergy names are stored in a 'tags' or 'allergens' array field
    exclusionFilter.allergens = { $nin: profile.allergies };
  }

  const allFoods = await FoodItem.find({ ...dietFilter, ...exclusionFilter });
  if (allFoods.length === 0) throw new Error("No food items found for this diet profile.");

  // ── 3. Group foods by category (and shuffle for variety each call) ─────────
  /** @type {Object.<string, Array>} */
  const byCategory = {};
  for (const food of allFoods) {
    const cat = food.category?.toLowerCase?.() || "misc";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(food);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat] = shuffle(byCategory[cat]);
  }

  // ── 4. Fill meal slots ────────────────────────────────────────────────────
  /**
   * usedIds is per-meal, NOT global. This prevents food starvation across
   * meals (e.g. if "rice" is used at lunch it can still appear at dinner).
   * We only deduplicate within the same meal to avoid e.g. two portions of
   * rice in a single lunch.
   */
  const meals = { breakfast: [], lunch: [], dinner: [], snack: [] };

  for (const [mealName, slots] of Object.entries(MEAL_STRUCTURE)) {
    const mealCalBudget = targetCalories * CALORIE_SPLIT[mealName];
    const usedIdsInMeal = new Set(); // ✅ reset per meal

    for (const slot of slots) {
      const slotCalBudget = mealCalBudget * (slot.calShare || 0.5); // ✅ per-slot budget

      // Get candidates from the correct category
      let candidates = (byCategory[slot.category] || []).filter(
        (f) => !usedIdsInMeal.has(f._id.toString())
      );

      // Fallback 1: allow repeating within meal if category is exhausted
      if (candidates.length === 0) {
        candidates = byCategory[slot.category] || [];
      }

      // Fallback 2: use any food if the specific category doesn't exist
      if (candidates.length === 0) {
        if (!slot.required) continue;
        candidates = allFoods.filter((f) => !usedIdsInMeal.has(f._id.toString()));
        if (candidates.length === 0) candidates = allFoods;
      }

      const food = pickFood(candidates, profile.goal, slot, macros);
      if (!food) continue;

      const { entry } = buildMealEntry(food, slotCalBudget, slot.role);
      meals[mealName].push(entry);
      usedIdsInMeal.add(food._id.toString());
    }
  }

  // ── 5. Build daily summary ────────────────────────────────────────────────
  const summary = buildSummary(meals, targetCalories, macros, profile);

  return { meals, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOD SCORING (goal + macro-aware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Score a food item given the current goal and remaining macro targets.
 * Higher score = better fit for this slot.
 */
function pickFood(candidates, goal, slot, macros) {
  if (!candidates || candidates.length === 0) return null;

  const scored = candidates.map((food) => {
    const p = food.per100g;
    let score = 0;

    // ── Goal-based scoring ─────────────────────────────────────────────────
    switch (goal) {
      case "lose":
        score += p.protein  * 3.0;       // reward high protein (satiety + muscle)
        score -= p.calories * 0.06;       // penalise calorie-dense foods
        score += (p.fiber || 0) * 2.5;    // reward fibre (satiety)
        score -= (p.sugar  || 0) * 1.5;   // penalise sugar
        break;

      case "gain":
        score += p.calories * 0.05;       // reward calorie density
        score += p.protein  * 2.5;        // reward protein
        score += p.carbs    * 0.8;        // reward carbs for energy
        break;

      default: // maintain
        score += p.protein  * 2.0;
        score += (p.fiber   || 0) * 2.0;
        score -= (p.sugar   || 0) * 1.0;
        break;
    }

    // ── Slot preference bonus ──────────────────────────────────────────────
    if (slot.preferHighProtein) score += p.protein * 2.5;
    if (slot.preferHighCarb)    score += p.carbs   * 2.5;

    // ── Macro gap bonus: prefer foods that fill remaining targets ──────────
    // (lightweight heuristic — not tracking per-meal macro balance)
    if (macros) {
      if (macros.proteinG > 100) score += p.protein * 1.0;
      if (macros.carbsG   > 200) score += p.carbs   * 0.5;
    }

    // ── Add small random noise so plans vary across calls ─────────────────
    score *= 0.80 + Math.random() * 0.40;

    return { food, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].food;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD A SINGLE MEAL ENTRY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given a food and a calorie budget for the slot, calculate the correct grams
 * and return a fully-formed meal entry object.
 */
function buildMealEntry(food, calBudget, role) {
  let grams = calcGrams(food, calBudget, role);

  // ── Snap to whole pieces if the food has a piece serving ──────────────────
  const servingUnit   = food.serving?.unit  || "g";
  const gramsPerPiece = food.serving?.grams || null;
  let pieces = null;

  if (servingUnit === "piece" && gramsPerPiece) {
    pieces = Math.max(1, Math.round(grams / gramsPerPiece));
    grams  = pieces * gramsPerPiece; // recalculate from whole pieces
  }

  const r = grams / 100;
  const entry = {
    foodId:       food._id,
    name:         food.name,
    category:     food.category,
    grams,
    servingUnit,
    gramsPerPiece,
    pieces,
    calories:     Math.round(food.per100g.calories * r),
    protein:      +((food.per100g.protein * r).toFixed(1)),
    carbs:        +((food.per100g.carbs   * r).toFixed(1)),
    fats:         +((food.per100g.fats    * r).toFixed(1)),
    fiber:        +((( food.per100g.fiber  || 0) * r).toFixed(1)),
    sugar:        +((( food.per100g.sugar  || 0) * r).toFixed(1)),
    sodium:       Math.round((food.per100g.sodium || 0) * r),
  };

  return { entry, grams };
}

// ─────────────────────────────────────────────────────────────────────────────
// GRAM CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

function calcGrams(food, calBudget, role) {
  const calPer100g = food.per100g?.calories;
  if (!calPer100g || calPer100g === 0) return 100;

  const raw     = (calBudget / calPer100g) * 100;
  const { min, max } = PORTION_LIMITS[role] || { min: 50, max: 200 };
  const clamped = Math.max(min, Math.min(raw, max));

  // Round to nearest 5 g for cleaner UX
  return Math.round(clamped / 5) * 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(meals, targetCalories, macros, profile) {
  let totalCals = 0, totalProtein = 0, totalCarbs = 0;
  let totalFats = 0, totalFiber  = 0, totalSugar = 0;

  for (const items of Object.values(meals)) {
    for (const item of items) {
      totalCals    += item.calories;
      totalProtein += item.protein;
      totalCarbs   += item.carbs;
      totalFats    += item.fats;
      totalFiber   += item.fiber  || 0;
      totalSugar   += item.sugar  || 0;
    }
  }

  return {
    targetCalories,
    plannedCalories:  totalCals,
    calorieDifference: totalCals - targetCalories,
    macroTargets: macros,
    actualMacros: {
      proteinG: +totalProtein.toFixed(1),
      carbsG:   +totalCarbs.toFixed(1),
      fatsG:    +totalFats.toFixed(1),
      fiberG:   +totalFiber.toFixed(1),
      sugarG:   +totalSugar.toFixed(1),
    },
    // How well each macro was hit (ratio vs target)
    macroAchievement: {
      protein: macros.proteinG ? +(totalProtein / macros.proteinG * 100).toFixed(1) : null,
      carbs:   macros.carbsG   ? +(totalCarbs   / macros.carbsG   * 100).toFixed(1) : null,
      fats:    macros.fatsG    ? +(totalFats    / macros.fatsG    * 100).toFixed(1) : null,
    },
    generatedAt: new Date().toISOString(),
    profileSnapshot: {
      goal:          profile.goal,
      dietType:      profile.dietType,
      weightKg:      profile.weightKg,
      activityLevel: profile.activityLevel,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PROGRESS EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateWeeklyProgress(userId, profile) {
  const today    = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toISOString().split("T")[0];
  });

  const logs = await DietProgress.find({ user: userId, date: { $in: last7Days } });
  if (logs.length < 4) return { adjust: false, reason: "Not enough data (need ≥ 4 days)" };

  let completedDays = 0;
  let totalCalories = 0;
  const weights     = [];

  for (const log of logs) {
    const mealsDone = Object.values(log.mealsCompleted || {}).filter(Boolean).length;
    if (mealsDone >= 3) completedDays++;
    totalCalories += log.caloriesConsumed || 0;
    if (log.weight) weights.push(log.weight);
  }

  if (weights.length < 2) return { adjust: false, reason: "Not enough weight data" };

  return {
    adjust:       true,
    adherence:    +((completedDays / 7) * 100).toFixed(1),
    avgCalories:  +(totalCalories / logs.length).toFixed(0),
    weightChange: +(weights[weights.length - 1] - weights[0]).toFixed(2),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE CALORIE RECALCULATION
// ─────────────────────────────────────────────────────────────────────────────

function calculateNewCalories(profile, evaluation) {
  const { goal, targetCalories } = profile;
  const { adherence, weightChange } = evaluation;

  if (adherence < 70) {
    return { change: 0, reason: "Low adherence — fix consistency before adjusting calories" };
  }

  let adjustment = 0;
  let reason     = "On track";

  if (goal === "lose") {
    if (weightChange >= 0)    { adjustment = -150; reason = "No weight loss — increasing deficit"; }
    else if (weightChange < -1.5) { adjustment = +150; reason = "Losing too fast — reducing deficit"; }
  } else if (goal === "gain") {
    if (weightChange <= 0)    { adjustment = +200; reason = "No weight gain — increasing surplus"; }
    else if (weightChange > 1.5)  { adjustment = -100; reason = "Gaining too fast — reducing surplus"; }
  } else { // maintain
    if (Math.abs(weightChange) > 1.0) {
      adjustment = weightChange > 0 ? -100 : +100;
      reason     = "Weight drifting — correcting calories";
    }
  }

  const floor      = profile.gender === "female" ? 1200 : 1500;
  const newCalories = Math.max((targetCalories || 2000) + adjustment, floor);

  return { change: adjustment, newCalories, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER-SIDE searchFoodsByFilter  (MongoDB query — NOT an HTTP call)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter foods directly from MongoDB.
 * Used by admin / plan generation, NOT a frontend HTTP helper.
 *
 * @param {Object} params
 *   tags     {string[]}  — e.g. ["high-protein","gym"]
 *   category {string}
 *   dietType {string}
 *   search   {string}    — partial name match
 *   match    {string}    — "any" | "all"  (default "any")
 */
async function searchFoodsByFilter(params = {}) {
  const query = {};

  if (params.category) query.category = params.category;
  if (params.dietType) query.dietType = params.dietType;

  if (params.search) {
    query.name = { $regex: params.search, $options: "i" };
  }

  if (params.tags?.length) {
    query.tags = params.match === "all"
      ? { $all: params.tags }   // food must have ALL listed tags
      : { $in: params.tags };   // food must have ANY listed tag
  }

  return FoodItem.find(query).lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  generateDietPlan,
  evaluateWeeklyProgress,
  calculateNewCalories,
  searchFoodsByFilter,
  computeTargetCalories,   // export for use in onboarding / profile screens
  computeMacroTargets,     // export for display in nutrition dashboard
};