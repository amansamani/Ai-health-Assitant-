const HealthProfile = require("../health/health.model");
const DietPlan = require("./dietPlan.model");
const DietProgress = require("./dietProgress.model");
const MealLog = require("./mealLog.model");
const FoodItem = require("./nutrition.model");

const {
  generateDietPlan,
  evaluateWeeklyProgress,
  calculateNewCalories,
} = require("./nutrition.service");

// ─────────────────────────────────────────
// GENERATE PLAN
// ─────────────────────────────────────────
const generatePlan = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await HealthProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(400).json({ message: "Health profile not found" });
    }

    const { meals, summary } = await generateDietPlan(profile);

    await DietPlan.updateMany(
      { user: userId, isActive: true },
      { $set: { isActive: false } }
    );

    const latest = await DietPlan.findOne({ user: userId }).sort({ version: -1 });
    const version = latest ? latest.version + 1 : 1;

    const newPlan = await DietPlan.create({
      user: userId,
      version,
      targetCalories: summary.targetCalories,
      macroSplit: summary.macroTargets,
      meals,
      summary,
      isActive: true,
    });

    res.status(201).json(newPlan);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// GET CURRENT PLAN
// ─────────────────────────────────────────
const getCurrentPlan = async (req, res, next) => {
  try {
    const plan = await DietPlan.findOne({
      user: req.user.id,
      isActive: true,
    });

    res.status(200).json(plan || null);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// LOG DAILY DIET (with validation)
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// SWAP OPTIONS (FIXED VEGAN)
// ─────────────────────────────────────────
const getSwapOptions = async (req, res, next) => {
  try {
    const { meal, foodId } = req.query;

    const profile = await HealthProfile.findOne({ user: req.user.id });

    const dietFilter =
      profile.dietType === "vegan"
        ? { dietType: "vegan" }
        : profile.dietType === "veg"
        ? { dietType: { $in: ["veg", "vegan"] } }
        : { dietType: { $in: ["veg", "non-veg", "vegan"] } };

    const options = await FoodItem.find({
      ...dietFilter,
      _id: { $ne: foodId },
    }).limit(10);

    res.json({ data: options });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// SWAP FOOD (FIXED SUMMARY)
// ─────────────────────────────────────────
const swapFood = async (req, res, next) => {
  try {
    const { meal, oldFoodId, newFoodId } = req.body;

    const plan = await DietPlan.findOne({
      user: req.user.id,
      isActive: true,
    });

    const newFood = await FoodItem.findById(newFoodId);

    const newItem = {
      foodId: newFood._id,
      name: newFood.name,
      grams: 100,
      calories: newFood.per100g.calories,
      protein: newFood.per100g.protein,
      carbs: newFood.per100g.carbs,
      fats: newFood.per100g.fats,
    };

    const idx = plan.meals[meal].findIndex(
      (f) => f.foodId.toString() === oldFoodId
    );

    plan.meals[meal][idx] = newItem;

    // ✅ FIX: recalc summary
    let totalCals = 0,
      totalProtein = 0,
      totalCarbs = 0,
      totalFats = 0;

    for (const items of Object.values(plan.meals)) {
      for (const item of items) {
        totalCals += item.calories || 0;
        totalProtein += item.protein || 0;
        totalCarbs += item.carbs || 0;
        totalFats += item.fats || 0;
      }
    }

    plan.summary.plannedCalories = totalCals;
    plan.summary.actualMacros = {
      proteinG: totalProtein,
      carbsG: totalCarbs,
      fatsG: totalFats,
    };

    plan.markModified("meals");
    plan.markModified("summary");

    await plan.save();

    res.json(plan);
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────
// STUBS (NO CRASH)
// ─────────────────────────────────────────
const getDailyDietLog = async (req, res) =>
  res.status(501).json({ message: "Not implemented" });

const logMeal = async (req, res) =>
  res.status(501).json({ message: "Not implemented" });

const getTodayLog = async (req, res) =>
  res.status(501).json({ message: "Not implemented" });

const deleteMeal = async (req, res) =>
  res.status(501).json({ message: "Not implemented" });

const getMealHistory = async (req, res) =>
  res.status(501).json({ message: "Not implemented" });

const getFoods = async (req, res) =>
  res.status(501).json({ message: "Not implemented" });

// ─────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────
module.exports = {
  generatePlan,
  getCurrentPlan,
  logDailyDiet,
  getDailyDietLog,
  runWeeklyAdjustment: async (req, res) =>
    res.status(501).json({ message: "Not implemented" }),
  getSwapOptions,
  swapFood,
  logMeal,
  getTodayLog,
  deleteMeal,
  getMealHistory,
  getFoods,
};