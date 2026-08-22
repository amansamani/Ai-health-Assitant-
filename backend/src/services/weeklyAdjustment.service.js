const HealthProfile = require("../modules/health/health.model");
const DietPlan = require("../modules/nutrition/dietPlan.model");
const { generateDietPlan } = require("../modules/nutrition/nutrition.service");
const DailyLog = require("../models/DailyLog");
const MealLog = require("../modules/nutrition/mealLog.model");
const WorkoutLog = require("../models/WorkoutLog");
const logger = require("../config/logger");
const { calculateMacros } = require("../modules/health/health.service");

const MIN_ACTIVE_DAYS = 5;
const LOOKBACK_DAYS = 7;

function toDateKey(d) {
  return new Date(d).toISOString().split("T")[0];
}

async function countActiveDays(userId) {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const [dailyLogs, mealLogs, workoutLogs] = await Promise.all([
    DailyLog.find({ user: userId, date: { $gte: since }, steps: { $gt: 0 } }).select("date"),
    MealLog.find({ user: userId, loggedAt: { $gte: since } }).select("loggedAt"),
    WorkoutLog.find({ user: userId, date: { $gte: since }, completed: true }).select("date"),
  ]);

  const stepDays = new Set(dailyLogs.map((d) => toDateKey(d.date)));
  const mealDays = new Set(mealLogs.map((m) => toDateKey(m.loggedAt)));
  const workoutDays = new Set(workoutLogs.map((w) => toDateKey(w.date)));

  let activeDays = 0;
  for (const day of stepDays) {
    if (mealDays.has(day) && workoutDays.has(day)) activeDays++;
  }
  return activeDays;
}

function recalculateMacros(profile) {
  const { targetCalories, weight, goal } = profile;

  if (!weight || weight <= 0) {
    logger.warn(
      { userId: profile.user },
      "Missing weight for user, skipping macro recalculation"
    );
    return;
  }

  const macros = calculateMacros({
    weight: Number(weight),
    targetCalories: Number(targetCalories),
    goal,
  });

  profile.proteinTarget = macros.proteinTarget;
  profile.carbTarget = macros.carbTarget;
  profile.fatTarget = macros.fatTarget;
}

async function runWeeklyAdjustments() {
  logger.info("Running weekly adjustment...");

  const profiles = await HealthProfile.find();

  for (const profile of profiles) {
    try {
      const userId = profile.user;

      if (!profile.weight) continue;

      const activeDays = await countActiveDays(userId);
      if (activeDays < MIN_ACTIVE_DAYS) {
        logger.info(
          { userId, activeDays, lookbackDays: LOOKBACK_DAYS, minRequired: MIN_ACTIVE_DAYS },
          "Skipped user — not enough active days, calories/plan unchanged"
        );
        continue;
      }

      let adjustment = 0;

      if (profile.goal === "lose") adjustment = -100;
      if (profile.goal === "gain") adjustment = +150;

      if (adjustment === 0) continue;

      profile.targetCalories = Math.max(
        profile.targetCalories + adjustment,
        profile.goal === "lose" ? 1200 : 1500
      );

      recalculateMacros(profile);

      await profile.save();

      const { meals: newMeals } = await generateDietPlan(profile);

      await DietPlan.updateMany(
        { user: userId, isActive: true },
        { isActive: false }
      );

      const latestPlan = await DietPlan.findOne({ user: userId })
        .sort({ version: -1 });

      const nextVersion = latestPlan ? latestPlan.version + 1 : 1;

      await DietPlan.create({
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

      logger.info({ userId }, "Adjusted plan for user");

    } catch (err) {
      logger.error({ err, userId: profile.user }, "Weekly adjustment failed for user");
    }
  }

  logger.info("Weekly adjustment completed.");
}

module.exports = runWeeklyAdjustments;