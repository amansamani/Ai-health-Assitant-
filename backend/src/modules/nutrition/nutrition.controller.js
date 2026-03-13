const HealthProfile = require("../health/health.model");
const DietPlan = require("./dietPlan.model");
const DietProgress = require("./dietProgress.model");
const MealLog = require("./mealLog.model");
const FoodItem = require("./nutrition.model");
const { generateDietPlan, evaluateWeeklyProgress, calculateNewCalories } = require("./nutrition.service");

// ─────────────────────────────────────────────────────────────────────────────
// DIET PLAN CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

exports.generatePlan = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profile = await HealthProfile.findOne({ user: userId });
    if (!profile) return res.status(400).json({ message: "Health profile not found" });

    const meals = await generateDietPlan(profile);

    await DietPlan.updateMany({ user: userId, isActive: true }, { isActive: false });

    const latestPlan = await DietPlan.findOne({ user: userId }).sort({ version: -1 });
    const nextVersion = latestPlan ? latestPlan.version + 1 : 1;

    const newPlan = await DietPlan.create({
      user: userId,
      version: nextVersion,
      targetCalories: profile.targetCalories,
      macroSplit: {
        protein: profile.proteinTarget,
        carbs:   profile.carbTarget,
        fats:    profile.fatTarget,
      },
      meals,
      isActive: true,
    });

    res.status(201).json(newPlan);
  } catch (err) {
    next(err);
  }
};

exports.getCurrentPlan = async (req, res, next) => {
  try {
    const activePlan = await DietPlan.findOne({
      user: req.user.id,
      isActive: true,
    }).sort({ createdAt: -1 });

    if (!activePlan) return res.status(404).json({ message: "No active diet plan found" });

    res.status(200).json(activePlan);
  } catch (err) {
    next(err);
  }
};

exports.logDailyDiet = async (req, res, next) => {
  try {
    const { date, mealsCompleted, caloriesConsumed, weight, notes } = req.body;
    const log = await DietProgress.findOneAndUpdate(
      { user: req.user.id, date },
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
    const { date } = req.query;
    const log = await DietProgress.findOne({ user: req.user.id, date });
    if (!log) return res.status(404).json({ message: "No log found for this date" });
    res.status(200).json(log);
  } catch (err) {
    next(err);
  }
};

exports.runWeeklyAdjustment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const profile = await HealthProfile.findOne({ user: userId });
    if (!profile) return res.status(404).json({ message: "Health profile not found" });

    const evaluation = await evaluateWeeklyProgress(userId, profile);
    if (!evaluation.adjust) return res.status(200).json(evaluation);

    const adaptation = calculateNewCalories(profile, evaluation);
    if (adaptation.change === 0) {
      return res.status(200).json({ message: "No calorie adjustment needed", reason: adaptation.reason });
    }

    profile.targetCalories = adaptation.newCalories;
    await profile.save();

    const newMeals = await generateDietPlan(profile);
    await DietPlan.updateMany({ user: userId, isActive: true }, { isActive: false });

    const latestPlan = await DietPlan.findOne({ user: userId }).sort({ version: -1 });
    const nextVersion = latestPlan ? latestPlan.version + 1 : 1;

    const newPlan = await DietPlan.create({
      user: userId,
      version: nextVersion,
      targetCalories: profile.targetCalories,
      macroSplit: {
        protein: profile.proteinTarget,
        carbs:   profile.carbTarget,
        fats:    profile.fatTarget,
      },
      meals: newMeals,
      isActive: true,
    });

    res.status(200).json({ message: "New plan generated", newPlan });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SWAP FOOD CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/nutrition/swap-options?meal=lunch&foodId=xxx
exports.getSwapOptions = async (req, res, next) => {
  try {
    const { meal, foodId } = req.query;
    const userId = req.user.id;

    if (!meal || !foodId) {
      return res.status(400).json({ message: "meal and foodId are required" });
    }

    const profile = await HealthProfile.findOne({ user: userId });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const dietFilter = profile.dietType === "veg"
      ? { dietType: "veg" }
      : { dietType: { $in: ["veg", "non-veg"] } };

    // For each meal type, show foods from same category + adjacent categories
    const categoryMap = {
      breakfast: ["breakfast"],
      lunch:     ["lunch"],
      dinner:    ["dinner", "lunch"],
      snack:     ["snack"],
    };

    const categories = categoryMap[meal] || [meal];

    // Exclude the current food being swapped
    const options = await FoodItem.find({
      ...dietFilter,
      category: { $in: categories },
      _id: { $ne: foodId },
    }).limit(12);

    const formatted = options.map(f => ({
      _id:      f._id,
      name:     f.name,
      category: f.category,
      dietType: f.dietType,
      per100g:  f.per100g,
      tags:     f.tags || [],
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/nutrition/swap-food
// Body: { meal, oldFoodId, newFoodId, grams }
exports.swapFood = async (req, res, next) => {
  try {
    const { meal, oldFoodId, newFoodId, grams } = req.body;
    const userId = req.user.id;

    if (!meal || !oldFoodId || !newFoodId) {
      return res.status(400).json({ message: "meal, oldFoodId and newFoodId are required" });
    }

    const plan = await DietPlan.findOne({ user: userId, isActive: true });
    if (!plan) return res.status(404).json({ message: "No active plan found" });

    const newFood = await FoodItem.findById(newFoodId);
    if (!newFood) return res.status(404).json({ message: "Food not found" });

    const servingGrams = grams || 100;
    const g = servingGrams;

    const newItem = {
      foodId:   newFood._id,
      name:     newFood.name,
      grams:    g,
      calories: Math.round((newFood.per100g.calories * g) / 100),
      protein:  parseFloat(((newFood.per100g.protein * g) / 100).toFixed(1)),
      carbs:    parseFloat(((newFood.per100g.carbs   * g) / 100).toFixed(1)),
      fats:     parseFloat(((newFood.per100g.fats    * g) / 100).toFixed(1)),
    };

    const mealArr = plan.meals[meal];
    if (!mealArr) return res.status(400).json({ message: "Invalid meal type" });

    // Find by foodId OR by _id (handles both old and new plan formats)
    const idx = mealArr.findIndex(item =>
      item.foodId?.toString() === oldFoodId.toString() ||
      item._id?.toString()    === oldFoodId.toString()
    );

    if (idx === -1) return res.status(404).json({ message: "Food not found in this meal" });

    plan.meals[meal][idx] = newItem;
    plan.markModified(`meals.${meal}`);
    await plan.save();

    return res.status(200).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MEAL LOGGING CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

const getTodayRange = () => {
  const now   = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end   = new Date(now); end.setHours(23, 59, 59, 999);
  return { start, end };
};

exports.logMeal = async (req, res, next) => {
  try {
    const { mealType, food } = req.body;

    if (!mealType || !food || !food.name || food.calories === undefined) {
      return res.status(400).json({ success: false, message: "mealType, food.name and food.calories are required" });
    }

    if (!["breakfast", "lunch", "dinner", "snacks"].includes(mealType)) {
      return res.status(400).json({ success: false, message: "Invalid mealType" });
    }

    const meal = await MealLog.create({
      user: req.user.id,
      mealType,
      food: {
        name:     food.name,
        brand:    food.brand    || "",
        quantity: food.quantity || 100,
        unit:     food.unit     || "g",
        calories: food.calories,
        protein:  food.protein  || 0,
        carbs:    food.carbs    || 0,
        fats:     food.fats     || 0,
        fiber:    food.fiber    || 0,
        sugar:    food.sugar    || 0,
        sodium:   food.sodium   || 0,
      },
    });

    return res.status(201).json({ success: true, message: "Meal logged successfully", data: meal });
  } catch (err) {
    next(err);
  }
};

exports.getTodayLog = async (req, res, next) => {
  try {
    const { start, end } = getTodayRange();
    const meals = await MealLog.find({
      user: req.user.id,
      loggedAt: { $gte: start, $lte: end },
    }).sort({ loggedAt: 1 });

    const grouped = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    let totals    = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };

    meals.forEach(meal => {
      grouped[meal.mealType].push(meal);
      totals.calories += meal.food.calories;
      totals.protein  += meal.food.protein;
      totals.carbs    += meal.food.carbs;
      totals.fats     += meal.food.fats;
      totals.fiber    += meal.food.fiber;
    });

    Object.keys(totals).forEach(k => { totals[k] = parseFloat(totals[k].toFixed(1)); });

    return res.status(200).json({
      success: true,
      data: { date: new Date().toISOString().split("T")[0], grouped, totals, totalMeals: meals.length },
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteMeal = async (req, res, next) => {
  try {
    const meal = await MealLog.findOne({ _id: req.params.id, user: req.user.id });
    if (!meal) return res.status(404).json({ success: false, message: "Meal not found" });
    await meal.deleteOne();
    return res.status(200).json({ success: true, message: "Meal deleted" });
  } catch (err) {
    next(err);
  }
};

exports.getMealHistory = async (req, res, next) => {
  try {
    const days  = parseInt(req.query.days) || 7;
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