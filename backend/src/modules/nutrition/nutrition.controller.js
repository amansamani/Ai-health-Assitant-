const HealthProfile = require("../health/health.model");
const DietPlan = require("./dietPlan.model");
const DietProgress = require("./dietProgress.model");
const MealLog = require("./mealLog.model");
const { generateDietPlan, evaluateWeeklyProgress, calculateNewCalories } = require("./nutrition.service");

// ── Existing Controllers ──────────────────────────────────────────────────────

exports.generatePlan = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await HealthProfile.findOne({ user: userId });

    if (!profile) {
      return res.status(400).json({ message: "Health profile not found" });
    }

    const meals = await generateDietPlan(profile);

    await DietPlan.updateMany(
      { user: userId, isActive: true },
      { isActive: false }
    );

    const latestPlan = await DietPlan.findOne({ user: userId }).sort({ version: -1 });
    const nextVersion = latestPlan ? latestPlan.version + 1 : 1;

    const newPlan = await DietPlan.create({
      user: userId,
      version: nextVersion,
      targetCalories: profile.targetCalories,
      macroSplit: {
        protein: profile.proteinTarget,
        carbs: profile.carbTarget,
        fats: profile.fatTarget
      },
      meals,
      isActive: true
    });

    res.status(201).json(newPlan);
  } catch (err) {
    next(err);
  }
};

exports.getCurrentPlan = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const activePlan = await DietPlan.findOne({
      user: userId,
      isActive: true
    }).sort({ createdAt: -1 });

    if (!activePlan) {
      return res.status(404).json({ message: "No active diet plan found" });
    }

    res.status(200).json(activePlan);
  } catch (err) {
    next(err);
  }
};

exports.logDailyDiet = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date, mealsCompleted, caloriesConsumed, weight, notes } = req.body;

    const log = await DietProgress.findOneAndUpdate(
      { user: userId, date },
      { mealsCompleted, caloriesConsumed, weight, notes },
      { new: true, upsert: true }
    );

    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
};

exports.getDailyDietLog = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    const log = await DietProgress.findOne({ user: userId, date });

    if (!log) {
      return res.status(404).json({ message: "No log found for this date" });
    }

    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
};

exports.runWeeklyAdjustment = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await HealthProfile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).json({ message: "Health profile not found" });
    }

    const evaluation = await evaluateWeeklyProgress(userId, profile);

    if (!evaluation.adjust) {
      return res.status(200).json(evaluation);
    }

    const adaptation = calculateNewCalories(profile, evaluation);

    if (adaptation.change === 0) {
      return res.status(200).json({ message: "No calorie adjustment needed", reason: adaptation.reason });
    }

    profile.targetCalories = adaptation.newCalories;
    await profile.save();

    const newMeals = await generateDietPlan(profile);

    await DietPlan.updateMany(
      { user: userId, isActive: true },
      { isActive: false }
    );

    const latestPlan = await DietPlan.findOne({ user: userId }).sort({ version: -1 });
    const nextVersion = latestPlan ? latestPlan.version + 1 : 1;

    const newPlan = await DietPlan.create({
      user: userId,
      version: nextVersion,
      targetCalories: profile.targetCalories,
      macroSplit: {
        protein: profile.proteinTarget,
        carbs: profile.carbTarget,
        fats: profile.fatTarget
      },
      meals: newMeals,
      isActive: true
    });

    res.status(200).json({ message: "New plan generated", newPlan });
  } catch (err) {
    next(err);
  }
};

// ── New Meal Logging Controllers ──────────────────────────────────────────────

// Helper: get start and end of today
const getTodayRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// POST /api/nutrition/log-meal
exports.logMeal = async (req, res, next) => {
  try {
    const { mealType, food } = req.body;

    if (!mealType || !food || !food.name || food.calories === undefined) {
      return res.status(400).json({
        success: false,
        message: "mealType, food.name and food.calories are required",
      });
    }

    if (!["breakfast", "lunch", "dinner", "snacks"].includes(mealType)) {
      return res.status(400).json({
        success: false,
        message: "mealType must be breakfast, lunch, dinner or snacks",
      });
    }

    const meal = await MealLog.create({
      user: req.user.id,
      mealType,
      food: {
        name: food.name,
        brand: food.brand || "",
        quantity: food.quantity || 100,
        unit: food.unit || "g",
        calories: food.calories,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fats: food.fats || 0,
        fiber: food.fiber || 0,
        sugar: food.sugar || 0,
        sodium: food.sodium || 0,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Meal logged successfully",
      data: meal,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/nutrition/today-log
exports.getTodayLog = async (req, res, next) => {
  try {
    const { start, end } = getTodayRange();

    const meals = await MealLog.find({
      user: req.user.id,
      loggedAt: { $gte: start, $lte: end },
    }).sort({ loggedAt: 1 });

    const grouped = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    let totals = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };

    meals.forEach((meal) => {
      grouped[meal.mealType].push(meal);
      totals.calories += meal.food.calories;
      totals.protein  += meal.food.protein;
      totals.carbs    += meal.food.carbs;
      totals.fats     += meal.food.fats;
      totals.fiber    += meal.food.fiber;
    });

    Object.keys(totals).forEach((k) => {
      totals[k] = parseFloat(totals[k].toFixed(1));
    });

    return res.status(200).json({
      success: true,
      data: {
        date: new Date().toISOString().split("T")[0],
        grouped,
        totals,
        totalMeals: meals.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/nutrition/meal/:id
exports.deleteMeal = async (req, res, next) => {
  try {
    const meal = await MealLog.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!meal) {
      return res.status(404).json({ success: false, message: "Meal not found" });
    }

    await meal.deleteOne();
    return res.status(200).json({ success: true, message: "Meal deleted" });
  } catch (err) {
    next(err);
  }
};

// GET /api/nutrition/history?days=7
exports.getMealHistory = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const meals = await MealLog.find({
      user: req.user.id,
      loggedAt: { $gte: since },
    }).sort({ loggedAt: -1 });

    return res.status(200).json({ success: true, data: meals });
  } catch (err) {
    next(err);
  }
};