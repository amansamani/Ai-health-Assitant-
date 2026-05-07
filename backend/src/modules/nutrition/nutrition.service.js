"use strict";

const DietProgress = require("./dietProgress.model");
const FoodTemplate = require("./foodTemplate.model");

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE  (fetched once per server boot)
// ─────────────────────────────────────────────────────────────────────────────
let _templateCache = null;

async function getTemplate() {
  if (_templateCache) return _templateCache;

  // FIX: each document IS a meal combo, not wrapped in .meals array
  const docs = await FoodTemplate.find().lean();
  if (!docs?.length) {
    throw new Error("Food template not found. Please seed the foodtemplate collection.");
  }

  _templateCache = docs;
  console.log("[FoodTemplate] Cache warmed —", _templateCache.length, "meal combos loaded.");
  return _templateCache;
}

// Also fix warmTemplateCache:
async function warmTemplateCache() {
  await getTemplate();
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CALORIE_SPLIT = {
  breakfast: 0.25,
  lunch:     0.35,
  dinner:    0.30,
  snack:     0.10,
};

// ─────────────────────────────────────────────────────────────────────────────
// BMR / TDEE  (Mifflin-St Jeor)
// ─────────────────────────────────────────────────────────────────────────────

function computeTargetCalories(profile) {
  if (profile.targetCalories && profile.targetCalories > 800) {
    return profile.targetCalories;
  }

  const weight = profile.weightKg || profile.weight;
  const height = profile.heightCm || profile.height;
  const { age, gender, activityLevel, goal } = profile;

  if (!age || !gender || !weight || !height) {
    throw new Error("Profile must include age, gender, weight, and height.");
  }

  const bmr =
    gender === "female"
      ? 10 * weight + 6.25 * height - 5 * age - 161
      : 10 * weight + 6.25 * height - 5 * age + 5;

  const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2,
    light:     1.375,
    moderate:  1.55,
    active:    1.725,
  };

  let tdee = bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.375);

  if (goal === "lose") tdee -= 500;
  if (goal === "gain") tdee += 400;

  const floor = gender === "female" ? 1200 : 1500;
  return Math.max(Math.round(tdee), floor);
}

// ─────────────────────────────────────────────────────────────────────────────
// MACRO TARGETS
// ─────────────────────────────────────────────────────────────────────────────

function computeMacroTargets(profile, targetCalories) {
  const weight = profile.weightKg || profile.weight || 70;
  const proteinMultipliers = { lose: 2.0, gain: 2.2, maintain: 1.8 };
  const proteinPerKg = proteinMultipliers[profile.goal] || 1.8;

  const proteinG   = Math.round(weight * proteinPerKg);
  const proteinCal = proteinG * 4;
  const remaining  = Math.max(targetCalories - proteinCal, 0);
  const carbsG     = Math.round((remaining * 0.55) / 4);
  const fatsG      = Math.round((remaining * 0.45) / 9);

  return { proteinG, carbsG, fatsG };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * dietType matching:
 *   vegan / veg → only "veg" combos (template has no "vegan" type)
 *   non-veg     → veg + eggetarian + non-veg
 */
function getEligibleMeals(allMeals, mealType, goal, dietType) {
  const eligibleDietTypes =
    dietType === "non-veg"
      ? ["veg", "eggetarian", "non-veg"]
      : ["veg"];

  return allMeals.filter(
    (m) =>
      m.mealType === mealType &&
      m.goal.includes(goal) &&
      eligibleDietTypes.includes(m.dietType)
  );
}

function scoreMeal(meal, goal) {
  const s = meal.mealScore;
  let score = s.realism * 1.0 + s.satiety * 1.5 + s.goalFit * 2.5 + s.proteinQuality * 1.5;
  score *= 0.85 + Math.random() * 0.30;
  return score;
}

function pickMeal(allMeals, mealType, goal, dietType, usedMealIds) {
  // L1: goal + diet + not used
  let candidates = getEligibleMeals(allMeals, mealType, goal, dietType).filter(
    (m) => !usedMealIds.has(m.id)
  );
  // L2: allow repeats
  if (!candidates.length) candidates = getEligibleMeals(allMeals, mealType, goal, dietType);
  // L3: ignore goal
  if (!candidates.length) {
    const dt = dietType === "non-veg" ? ["veg", "eggetarian", "non-veg"] : ["veg"];
    candidates = allMeals.filter((m) => m.mealType === mealType && dt.includes(m.dietType));
  }
  // L4: any
  if (!candidates.length) candidates = allMeals.filter((m) => m.mealType === mealType);
  if (!candidates.length) return null;

  return candidates
    .map((m) => ({ meal: m, score: scoreMeal(m, goal) }))
    .sort((a, b) => b.score - a.score)[0].meal;
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTION SCALING
// ─────────────────────────────────────────────────────────────────────────────

function scaleMealToCalories(templateMeal, targetMealCals) {
  const [minCals, maxCals] = templateMeal.macroRange.calories;

  const scale = maxCals === minCals
    ? 0.5
    : Math.max(0, Math.min(1, (targetMealCals - minCals) / (maxCals - minCals)));

  const lerp = (range) => Math.round(range[0] + scale * (range[1] - range[0]));

  return {
    templateId: templateMeal.id,
    mealName:   templateMeal.name,
    cuisine:    templateMeal.cuisine,
    difficulty: templateMeal.difficulty,
    prepTime:   templateMeal.prepTime,
    budget:     templateMeal.budget,
    tags:       templateMeal.tags,
    items: templateMeal.items.map((item) => ({
      name:   item.name,
      amount: item.scalable
        ? Math.round(item.minAmount + scale * (item.maxAmount - item.minAmount))
        : item.minAmount,
      unit: item.unit,
    })),
    calories: lerp(templateMeal.macroRange.calories),
    protein:  lerp(templateMeal.macroRange.protein),
    carbs:    lerp(templateMeal.macroRange.carbs),
    fats:     lerp(templateMeal.macroRange.fats),
    fiber:    lerp(templateMeal.macroRange.fiber),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: generateDietPlan
// ─────────────────────────────────────────────────────────────────────────────

async function generateDietPlan(profile) {
  const targetCalories = computeTargetCalories(profile);
  const macros         = computeMacroTargets(profile, targetCalories);
  const { goal, dietType } = profile;

  const allMeals    = await getTemplate(); // from cache after first call
  const usedMealIds = new Set();
  const meals       = {};

  for (const mealType of ["breakfast", "lunch", "dinner", "snack"]) {
    const calBudget   = targetCalories * CALORIE_SPLIT[mealType];
    const chosenCombo = pickMeal(allMeals, mealType, goal, dietType, usedMealIds);

    if (!chosenCombo) { meals[mealType] = []; continue; }

    usedMealIds.add(chosenCombo.id);
    meals[mealType] = [scaleMealToCalories(chosenCombo, calBudget)];
  }

  const summary = buildSummary(meals, targetCalories, macros, profile);
  return { meals, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(meals, targetCalories, macros, profile) {
  let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFats = 0, totalFiber = 0;

  for (const mealArr of Object.values(meals)) {
    for (const combo of mealArr) {
      totalCals    += combo.calories || 0;
      totalProtein += combo.protein  || 0;
      totalCarbs   += combo.carbs    || 0;
      totalFats    += combo.fats     || 0;
      totalFiber   += combo.fiber    || 0;
    }
  }

  return {
    targetCalories,
    plannedCalories:   totalCals,
    calorieDifference: totalCals - targetCalories,
    macroTargets: macros,
    actualMacros: {
      proteinG: +totalProtein.toFixed(1),
      carbsG:   +totalCarbs.toFixed(1),
      fatsG:    +totalFats.toFixed(1),
      fiberG:   +totalFiber.toFixed(1),
    },
    macroAchievement: {
      protein: macros.proteinG ? +(totalProtein / macros.proteinG * 100).toFixed(1) : null,
      carbs:   macros.carbsG   ? +(totalCarbs   / macros.carbsG   * 100).toFixed(1) : null,
      fats:    macros.fatsG    ? +(totalFats    / macros.fatsG    * 100).toFixed(1) : null,
    },
    generatedAt: new Date().toISOString(),
    profileSnapshot: {
      goal:          profile.goal,
      dietType:      profile.dietType,
      weightKg:      profile.weightKg || profile.weight,
      activityLevel: profile.activityLevel,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SWAP OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function getTemplateMealSwaps(mealType, goal, dietType, excludeId) {
  const allMeals = await getTemplate();

  return getEligibleMeals(allMeals, mealType, goal, dietType)
    .filter((m) => m.id !== excludeId)
    .map((m) => ({ ...m, _score: scoreMeal(m, goal) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 6)
    .map(({ _score, ...m }) => m);
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateWeeklyProgress(userId) {
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return d.toISOString().split("T")[0];
  });

  const logs = await DietProgress.find({ user: userId, date: { $in: last7Days } });
  if (logs.length < 4) return { adjust: false, reason: "Not enough data (need ≥ 4 days)" };

  let completedDays = 0, totalCalories = 0;
  const weights = [];

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
// ADAPTIVE CALORIES
// ─────────────────────────────────────────────────────────────────────────────

function calculateNewCalories(profile, evaluation) {
  const { goal, targetCalories } = profile;
  const { adherence, weightChange } = evaluation;

  if (adherence < 70) {
    return { change: 0, reason: "Low adherence — fix consistency before adjusting calories" };
  }

  let adjustment = 0, reason = "On track";

  if (goal === "lose") {
    if (weightChange >= 0)        { adjustment = -150; reason = "No weight loss — increasing deficit"; }
    else if (weightChange < -1.5) { adjustment = +150; reason = "Losing too fast — reducing deficit"; }
  } else if (goal === "gain") {
    if (weightChange <= 0)        { adjustment = +200; reason = "No weight gain — increasing surplus"; }
    else if (weightChange > 1.5)  { adjustment = -100; reason = "Gaining too fast — reducing surplus"; }
  } else {
    if (Math.abs(weightChange) > 1.0) {
      adjustment = weightChange > 0 ? -100 : +100;
      reason     = "Weight drifting — correcting calories";
    }
  }

  const floor       = profile.gender === "female" ? 1200 : 1500;
  const newCalories = Math.max((targetCalories || 2000) + adjustment, floor);
  return { change: adjustment, newCalories, reason };
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  generateDietPlan,
  evaluateWeeklyProgress,
  calculateNewCalories,
  computeTargetCalories,
  computeMacroTargets,
  getTemplateMealSwaps,
  warmTemplateCache,
};