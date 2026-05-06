"use strict";

const HealthProfile = require("../health/health.model");
const DietPlan      = require("./dietPlan.model");
const DietProgress  = require("./dietProgress.model");
const MealLog       = require("./mealLog.model");

const {
  generateDietPlan,
  evaluateWeeklyProgress,
  calculateNewCalories,
  getTemplateMealSwaps,
  getTemplate,                  // ← use cache, not raw DB
} = require("./nutrition.service");

// ─────────────────────────────────────────────────────────────────────────────
// GOAL NORMALIZER
// Maps frontend/profile strings → internal strings used in template + logic
// ─────────────────────────────────────────────────────────────────────────────
const GOAL_MAP = {
  lean:     "lose",
  cut:      "lose",
  lose:     "lose",
  bulk:     "gain",
  gain:     "gain",
  fit:      "maintain",
  maintain: "maintain",
};

function normalizeGoal(goal) {
  return GOAL_MAP[goal?.toLowerCase()] || "maintain";
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE PLAN
// ─────────────────────────────────────────────────────────────────────────────
const generatePlan = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await HealthProfile.findOne({ user: userId });
    if (!profile) return res.status(400).json({ message: "Health profile not found" });

    // Normalize goal before passing to service
    profile.goal = normalizeGoal(profile.goal);

    const { meals, summary } = await generateDietPlan(profile);

    await DietPlan.updateMany({ user: userId, isActive: true }, { $set: { isActive: false } });

    const latest  = await DietPlan.findOne({ user: userId }).sort({ version: -1 });
    const version = latest ? latest.version + 1 : 1;

    const newPlan = await DietPlan.create({
      user: userId,
      version,
      targetCalories: summary.targetCalories,
      macroSplit:     summary.macroTargets,
      meals,
      summary,
      isActive: true,
    });

    res.status(201).json(newPlan);
  } catch (err) {
    console.error("generatePlan error:", err);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET CURRENT PLAN
// ─────────────────────────────────────────────────────────────────────────────
const getCurrentPlan = async (req, res, next) => {
  try {
    const plan = await DietPlan.findOne({ user: req.user.id, isActive: true });
    res.status(200).json(plan || null);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOG DAILY DIET
// ─────────────────────────────────────────────────────────────────────────────
const logDailyDiet = async (req, res, next) => {
  try {
    const { date, mealsCompleted, caloriesConsumed } = req.body;

    if (!date || isNaN(Date.parse(date))) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const log = await DietProgress.findOneAndUpdate(
      { user: req.user.id, date },
      { mealsCompleted, caloriesConsumed },
      { new: true, upsert: true }
    );

    res.json(log);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SWAP OPTIONS
// GET /nutrition/swap-options?mealType=lunch&excludeId=ln_pro_003
// ─────────────────────────────────────────────────────────────────────────────
const getSwapOptions = async (req, res, next) => {
  try {
    const { mealType, excludeId } = req.query;

    if (!mealType) {
      return res.status(400).json({ message: "mealType query param required" });
    }

    const profile = await HealthProfile.findOne({ user: req.user.id });
    if (!profile) return res.status(400).json({ message: "Health profile not found" });

    // Normalize goal
    const goal = normalizeGoal(profile.goal);

    const options = await getTemplateMealSwaps(
      mealType,
      goal,
      profile.dietType,
      excludeId || null
    );

    res.json({ data: options });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SWAP MEAL
// POST /nutrition/swap
// Body: { mealType: "lunch", newMealId: "ln_pro_007" }
// ─────────────────────────────────────────────────────────────────────────────
const CALORIE_SPLIT = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };

const swapFood = async (req, res, next) => {
  try {
    const { mealType, newMealId } = req.body;

    if (!mealType || !newMealId) {
      return res.status(400).json({ message: "mealType and newMealId required" });
    }

    const plan = await DietPlan.findOne({ user: req.user.id, isActive: true });
    if (!plan) return res.status(404).json({ message: "No active plan found" });

    // ✅ Use cached template — not raw DB call
    const allMeals = await getTemplate();
    const newCombo = allMeals.find((m) => m.id === newMealId);
    if (!newCombo) return res.status(404).json({ message: "Meal template not found" });

    // Scale to calorie budget
    const calBudget = plan.targetCalories * (CALORIE_SPLIT[mealType] || 0.25);

    const [minCals, maxCals] = newCombo.macroRange.calories;
    const scale = maxCals === minCals
      ? 0.5
      : Math.max(0, Math.min(1, (calBudget - minCals) / (maxCals - minCals)));

    const lerp = (range) => Math.round(range[0] + scale * (range[1] - range[0]));

    const scaled = {
      templateId: newCombo.id,
      mealName:   newCombo.name,
      cuisine:    newCombo.cuisine,
      difficulty: newCombo.difficulty,
      prepTime:   newCombo.prepTime,
      budget:     newCombo.budget,
      tags:       newCombo.tags,
      items: newCombo.items.map((item) => ({
        name:   item.name,
        amount: item.scalable
          ? Math.round(item.minAmount + scale * (item.maxAmount - item.minAmount))
          : item.minAmount,
        unit: item.unit,
      })),
      calories: lerp(newCombo.macroRange.calories),
      protein:  lerp(newCombo.macroRange.protein),
      carbs:    lerp(newCombo.macroRange.carbs),
      fats:     lerp(newCombo.macroRange.fats),
      fiber:    lerp(newCombo.macroRange.fiber),
    };

    // Replace only this meal slot
    plan.meals[mealType] = [scaled];

    // Recalc summary totals
    let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFats = 0, totalFiber = 0;
    for (const mealArr of Object.values(plan.meals)) {
      for (const combo of mealArr) {
        totalCals    += combo.calories || 0;
        totalProtein += combo.protein  || 0;
        totalCarbs   += combo.carbs    || 0;
        totalFats    += combo.fats     || 0;
        totalFiber   += combo.fiber    || 0;
      }
    }

    plan.summary.plannedCalories = totalCals;
    plan.summary.actualMacros = {
      proteinG: +totalProtein.toFixed(1),
      carbsG:   +totalCarbs.toFixed(1),
      fatsG:    +totalFats.toFixed(1),
      fiberG:   +totalFiber.toFixed(1),
    };

    plan.markModified("meals");
    plan.markModified("summary");
    await plan.save();

    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STUBS
// ─────────────────────────────────────────────────────────────────────────────
const getDailyDietLog = async (req, res) => res.status(501).json({ message: "Not implemented" });
const logMeal         = async (req, res) => res.status(501).json({ message: "Not implemented" });
const getTodayLog     = async (req, res) => res.status(501).json({ message: "Not implemented" });
const deleteMeal      = async (req, res) => res.status(501).json({ message: "Not implemented" });
const getMealHistory  = async (req, res) => res.status(501).json({ message: "Not implemented" });
const getFoods        = async (req, res) => res.status(501).json({ message: "Not implemented" });

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  generatePlan,
  getCurrentPlan,
  logDailyDiet,
  getDailyDietLog,
  runWeeklyAdjustment: async (req, res) => res.status(501).json({ message: "Not implemented" }),
  getSwapOptions,
  swapFood,
  logMeal,
  getTodayLog,
  deleteMeal,
  getMealHistory,
  getFoods,
};