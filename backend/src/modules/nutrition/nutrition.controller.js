"use strict";

const logger = require("../../config/logger");
const HealthProfile = require("../health/health.model");
const DietPlan      = require("./dietPlan.model");
const DietProgress  = require("./dietProgress.model");
const MealLog       = require("./mealLog.model");
const FoodItem = require("./foodItem.model");
const { analyzeMealPhoto } = require("./mealPhoto.service");

const {
  generateDietPlan,
  evaluateWeeklyProgress,
  calculateNewCalories,
  getTemplateMealSwaps,
  getTemplate, 
  runSmartWeeklyAdjustment,
  getLatestWeeklyInsight,
  getWeeklyInsightHistory,
          
} = require("./nutrition.service");

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

const generatePlan = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await HealthProfile.findOne({ user: userId });
    if (!profile) return res.status(400).json({ message: "Health profile not found" });

    profile.goal = normalizeGoal(profile.goal);
    delete profile.targetCalories;
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
    logger.error({ err }, "generatePlan error");
    next(err);
  }
};

const getCurrentPlan = async (req, res, next) => {
  try {
    const plan = await DietPlan.findOne({ user: req.user.id, isActive: true });
    res.status(200).json(plan || null);
  } catch (err) {
    next(err);
  }
};

const logDailyDiet = async (req, res, next) => {
  try {
    const { date, mealsCompleted, caloriesConsumed, weight } = req.body;

    if (!date || isNaN(Date.parse(date))) {
      return res.status(400).json({ message: "Invalid date" });
    }

    const log = await DietProgress.findOneAndUpdate(
      { user: req.user.id, date },
      { mealsCompleted, caloriesConsumed, weight },
      { new: true, upsert: true }
    );

    res.json(log);
  } catch (err) {
    next(err);
  }
};

const getSwapOptions = async (req, res, next) => {
  try {
    const { mealType, excludeId } = req.query;

    if (!mealType) {
      return res.status(400).json({ message: "mealType query param required" });
    }

    const profile = await HealthProfile.findOne({ user: req.user.id });
    if (!profile) return res.status(400).json({ message: "Health profile not found" });

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

const CALORIE_SPLIT = { breakfast: 0.28, lunch: 0.37, dinner: 0.28, snack: 0.07 };

const swapFood = async (req, res, next) => {
  try {
    const { mealType, newMealId } = req.body;

    if (!mealType || !newMealId) {
      return res.status(400).json({ message: "mealType and newMealId required" });
    }

    const plan = await DietPlan.findOne({ user: req.user.id, isActive: true });
    if (!plan) return res.status(404).json({ message: "No active plan found" });

    const allMeals = await getTemplate();
    logger.info({ count: allMeals.length }, "Total food templates loaded");
    const newCombo = allMeals.find((m) => m.id === newMealId);
    logger.info({ found: !!newCombo, newMealId }, "newCombo lookup");
    if (!newCombo) return res.status(404).json({ message: "Meal template not found" });

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

    if (scaled.calories > calBudget * 1.08) {
      const ratio     = calBudget / scaled.calories;
      scaled.calories = Math.round(calBudget);
      scaled.protein  = Math.round(scaled.protein * ratio);
      scaled.carbs    = Math.round(scaled.carbs   * ratio);
      scaled.fats     = Math.round(scaled.fats    * ratio);
      scaled.fiber    = Math.round(scaled.fiber   * ratio);
      scaled.items    = scaled.items.map((item) => ({
        ...item,
        amount: Math.round(item.amount * ratio),
      }));
    }

    plan.meals[mealType] = [scaled];

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

const getFoods = async (req, res, next) => {
  try {
    const { search, q, tags, dietType, limit = 20 } = req.query;
    const searchTerm = search || q;

    const query = {};

    if (searchTerm) {
      query.name = { $regex: searchTerm.trim(), $options: "i" };
    }

    if (tags) {
      const tagArr = tags.split(",").map(t => t.trim()).filter(Boolean);
      if (tagArr.length) query.tags = { $in: tagArr };
    }

    if (dietType) query.dietType = dietType;

    const foods = await FoodItem.find(query).limit(Number(limit)).lean();

    res.json({ success: true, count: foods.length, data: foods });
  } catch (err) {
    next(err);
  }
};

const logMeal = async (req, res, next) => {
  try {
    const { mealType, food } = req.body;

    if (!mealType || !food) {
      return res.status(400).json({ message: "mealType and food are required" });
    }

    const normalizedMealType = mealType === "snack" ? "snacks" : mealType;

    const log = await MealLog.create({
      user:     req.user.id,
      mealType: normalizedMealType,
      food: {
        name:     food.name,
        brand:    food.brand     || "",
        quantity: food.quantity  || 100,
        unit:     food.unit      || "g",
        calories: food.calories  || 0,
        protein:  food.protein   || 0,
        carbs:    food.carbs     || 0,
        fats:     food.fats      || 0,
        fiber:    food.fiber     || 0,
        sugar:    food.sugar     || 0,
        sodium:   food.sodium    || 0,
      },
    });

    res.status(201).json({ message: "Meal logged", data: log });
  } catch (err) {
    next(err);
  }
};

const getTodayLog = async (req, res, next) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const logs = await MealLog.find({
      user:     req.user.id,
      loggedAt: { $gte: start, $lte: end },
    }).sort({ loggedAt: -1 }).lean();

    const grouped = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    for (const log of logs) {
      if (grouped[log.mealType]) grouped[log.mealType].push(log);
    }

    const totals = logs.reduce((acc, log) => ({
      calories: acc.calories + (log.food.calories || 0),
      protein:  acc.protein  + (log.food.protein  || 0),
      carbs:    acc.carbs    + (log.food.carbs     || 0),
      fats:     acc.fats     + (log.food.fats      || 0),
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 });

    res.json({ data: grouped, totals, count: logs.length });
  } catch (err) {
    next(err);
  }
};

const getDailyDietLog = async (req, res) => res.status(501).json({ message: "Not implemented" });

const deleteMeal = async (req, res, next) => {
  try {
    const log = await MealLog.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!log) return res.status(404).json({ message: "Meal not found" });
    res.json({ message: "Meal deleted", data: log });
  } catch (err) {
    if (err.name === "CastError") return res.status(400).json({ message: "Invalid meal id" });
    next(err);
  }
};

const getMealHistory = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const logs = await MealLog.find({ user: req.user.id, loggedAt: { $gte: since } })
      .sort({ loggedAt: -1 })
      .lean();

    res.json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    next(err);
  }
};

const runWeeklyAdjustment = async (req, res, next) => {
  try {
    const result = await runSmartWeeklyAdjustment(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getWeeklyInsight = async (req, res, next) => {
  try {
    const insight = await getLatestWeeklyInsight(req.user.id);
    res.json(insight || null);
  } catch (err) {
    next(err);
  }
};

const getWeeklyInsightLog = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 26);
    const history = await getWeeklyInsightHistory(req.user.id, limit);
    res.json(history);
  } catch (err) {
    next(err);
  }
};

const analyzeMealPhotoCtrl = async (req, res, next) => {
  try {
    const { imageBase64, images, mimeType, hasReferenceObject } = req.body;
    const imageList = images && images.length ? images : [imageBase64];
    const result = await analyzeMealPhoto(imageList, mimeType, { hasReferenceObject });
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Meal photo analysis error");
    res.status(500).json({ message: "Failed to analyze meal photo. Try a clearer photo or log manually." });
  }
};

module.exports = {
  generatePlan,
  getCurrentPlan,
  logDailyDiet,
  getDailyDietLog,
  runWeeklyAdjustment,
  getWeeklyInsight,
  getWeeklyInsightLog,
  getSwapOptions,
  swapFood,
  logMeal,
  getTodayLog,
  deleteMeal,
  getMealHistory,
  getFoods,
  analyzeMealPhotoCtrl,
  
};