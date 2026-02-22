const HealthProfile = require("../health/health.model");
const DietPlan = require("./dietPlan.model");
const { generateDietPlan } = require("./nutrition.service");
const DietProgress = require("./dietProgress.model");
const { evaluateWeeklyProgress } = require("./nutrition.service");
const { generateDietPlan } = require("./nutrition.service");

exports.generatePlan = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await HealthProfile.findOne({ user: userId });

    if (!profile) {
      return res.status(400).json({
        message: "Health profile not found"
      });
    }

    // Generate meals
    const meals = await generateDietPlan(profile);

    // Deactivate old plans
    await DietPlan.updateMany(
      { user: userId, isActive: true },
      { isActive: false }
    );

    // Get latest version number
    const latestPlan = await DietPlan.findOne({ user: userId })
      .sort({ version: -1 });

    const nextVersion = latestPlan ? latestPlan.version + 1 : 1;

    // Save new plan
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
      return res.status(404).json({
        message: "No active diet plan found"
      });
    }

    res.status(200).json(activePlan);

  } catch (err) {
    next(err);
  }
};

exports.logDailyDiet = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const {
      date,
      mealsCompleted,
      caloriesConsumed,
      weight,
      notes
    } = req.body;

    const log = await DietProgress.findOneAndUpdate(
      { user: userId, date },
      {
        mealsCompleted,
        caloriesConsumed,
        weight,
        notes
      },
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

    const log = await DietProgress.findOne({
      user: userId,
      date
    });

    if (!log) {
      return res.status(404).json({
        message: "No log found for this date"
      });
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

    const evaluation = await evaluateWeeklyProgress(userId, profile);

    if (!evaluation.adjust) {
      return res.status(200).json(evaluation);
    }

    const adaptation = calculateNewCalories(profile, evaluation);

    if (adaptation.change === 0) {
      return res.status(200).json({
        message: "No calorie adjustment needed"
      });
    }

    profile.targetCalories = adaptation.newCalories;
    await profile.save();

    const newMeals = await generateDietPlan(profile);

    await DietPlan.updateMany(
      { user: userId, isActive: true },
      { isActive: false }
    );

    const latestPlan = await DietPlan.findOne({ user: userId })
      .sort({ version: -1 });

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

    res.status(200).json({
      message: "New plan generated",
      newPlan
    });

  } catch (err) {
    next(err);
  }
};