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

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function getMacroTags(food) {
  const { protein, carbs, fats } = food.per100g;
  const tags = [];

  if (protein >= 12) tags.push("high-protein");
  if (carbs >= 40) tags.push("high-carb");
  if (fats >= 15) tags.push("high-fat");

  return tags;
}

// ─────────────────────────────────────────────────────────
// GENERATE DIET PLAN ✅ FIXED
// ─────────────────────────────────────────────────────────

exports.generatePlan = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await HealthProfile.findOne({ user: userId });
    if (!profile) {
      return res.status(400).json({ message: "Health profile not found" });
    }

    // ✅ FIX: correct destructuring
    const { meals, summary } = await generateDietPlan(profile);

    // deactivate old plans
    await DietPlan.updateMany(
      { user: userId, isActive: true },
      { $set: { isActive: false } }
    );

    const latestPlan = await DietPlan.findOne({ user: userId }).sort({ version: -1 });
    const nextVersion = latestPlan ? latestPlan.version + 1 : 1;

    // ✅ SAVE CORRECT STRUCTURE
    const newPlan = await DietPlan.create({
      user: userId,
      version: nextVersion,

      targetCalories: summary.targetCalories,

      macroSplit: {
        protein: summary.macroTargets.proteinG,
        carbs: summary.macroTargets.carbsG,
        fats: summary.macroTargets.fatsG,
      },

      meals,
      summary, // ✅ VERY IMPORTANT

      isActive: true,
    });

    res.status(201).json(newPlan);
  } catch (err) {
    console.error("Generate Plan Error:", err.message);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────
// GET CURRENT PLAN ✅ FIXED
// ─────────────────────────────────────────────────────────

exports.getCurrentPlan = async (req, res, next) => {
  try {
    const plan = await DietPlan.findOne({
      user: req.user.id,
      isActive: true,
    }).sort({ createdAt: -1 });

    // ✅ important: return null instead of 404
    if (!plan) return res.status(200).json(null);

    res.status(200).json(plan);
  } catch (err) {
    console.error("Get Plan Error:", err.message);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────
// WEEKLY ADJUSTMENT ✅ FIXED
// ─────────────────────────────────────────────────────────

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
      return res.status(200).json({
        message: "No calorie adjustment needed",
        reason: adaptation.reason,
      });
    }

    profile.targetCalories = adaptation.newCalories;
    await profile.save();

    // ✅ FIX HERE ALSO
    const { meals, summary } = await generateDietPlan(profile);

    await DietPlan.updateMany(
      { user: userId, isActive: true },
      { $set: { isActive: false } }
    );

    const latestPlan = await DietPlan.findOne({ user: userId }).sort({ version: -1 });
    const nextVersion = latestPlan ? latestPlan.version + 1 : 1;

    const newPlan = await DietPlan.create({
      user: userId,
      version: nextVersion,

      targetCalories: summary.targetCalories,

      macroSplit: {
        protein: summary.macroTargets.proteinG,
        carbs: summary.macroTargets.carbsG,
        fats: summary.macroTargets.fatsG,
      },

      meals,
      summary,

      isActive: true,
    });

    res.status(200).json({
      message: "New plan generated",
      newPlan,
    });
  } catch (err) {
    console.error("Weekly Adjustment Error:", err.message);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────
// SWAP FOOD (UNCHANGED)
// ─────────────────────────────────────────────────────────

exports.getSwapOptions = async (req, res, next) => {
  try {
    const { meal, foodId } = req.query;
    const userId = req.user.id;

    if (!meal || !foodId) {
      return res.status(400).json({ message: "meal and foodId are required" });
    }

    const profile = await HealthProfile.findOne({ user: userId });
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const dietFilter =
      profile.dietType === "veg"
        ? { dietType: "veg" }
        : { dietType: { $in: ["veg", "non-veg"] } };

    const categoryMap = {
      breakfast: ["breakfast"],
      lunch: ["lunch"],
      dinner: ["dinner", "lunch"],
      snack: ["snack"],
    };

    const categories = categoryMap[meal] || [meal];

    const options = await FoodItem.find({
      ...dietFilter,
      category: { $in: categories },
      _id: { $ne: foodId },
    }).limit(12);

    const formatted = options.map((f) => ({
      _id: f._id,
      name: f.name,
      category: f.category,
      dietType: f.dietType,
      per100g: f.per100g,
      tags: getMacroTags(f),
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
};

exports.swapFood = async (req, res, next) => {
  try {
    const { meal, oldFoodId, newFoodId, grams } = req.body;
    const userId = req.user.id;

    const plan = await DietPlan.findOne({ user: userId, isActive: true });
    if (!plan || !plan.meals || !plan.meals[meal]) {
      return res.status(404).json({ message: "Invalid meal or plan not found" });
    }

    const newFood = await FoodItem.findById(newFoodId);
    if (!newFood) {
      return res.status(404).json({ message: "Food not found" });
    }

    const g = grams && grams > 0 ? grams : 100;

    const newItem = {
      foodId: newFood._id,
      name: newFood.name,
      grams: g,
      calories: Math.round((newFood.per100g.calories * g) / 100),
      protein: +((newFood.per100g.protein * g) / 100).toFixed(1),
      carbs: +((newFood.per100g.carbs * g) / 100).toFixed(1),
      fats: +((newFood.per100g.fats * g) / 100).toFixed(1),
    };

    const idx = plan.meals[meal].findIndex(
      (i) => i.foodId?.toString() === String(oldFoodId)
    );

    if (idx === -1) {
      return res.status(404).json({ message: "Food not found in this meal" });
    }

    plan.meals[meal][idx] = newItem;
    plan.markModified(`meals.${meal}`);

    await plan.save();

    res.status(200).json({ success: true, data: plan });
  } catch (err) {
    next(err);
  }
};