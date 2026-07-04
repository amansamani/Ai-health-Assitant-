const HealthProfile = require("../modules/health/health.model");
const DietPlan = require("../modules/nutrition/dietPlan.model");
const { generateDietPlan } = require("../modules/nutrition/nutrition.service");
const DailyLog = require("../models/DailyLog");
const MealLog = require("../modules/nutrition/mealLog.model");
const WorkoutLog = require("../models/WorkoutLog");

// A user only gets their calories adjusted if they were actually
// using the app that week. Otherwise someone who vanishes for two
// weeks and comes back would get hit with two weeks of blind cuts
// they never earned.
const MIN_ACTIVE_DAYS = 5;   // out of the trailing week
const LOOKBACK_DAYS = 7;

function toDateKey(d) {
  return new Date(d).toISOString().split("T")[0]; // "YYYY-MM-DD"
}

// "Active day" = user tracked steps, logged a meal, AND completed their
// workout that day — all three, matching "properly follow everything."
// This is intentionally strict. If real usage shows almost no one clears
// this bar, relax it to "2 of 3" rather than dropping the check entirely.
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

// 🔹 Macro recalculation logic
function recalculateMacros(profile) {
  const { targetCalories, weight, goal } = profile;

  if (!weight || weight <= 0) {
    console.warn(`⚠️ Missing weight for user ${profile.user}`);
    return;
  }

  const proteinGrams = Math.round(weight * 2);
  const proteinCalories = proteinGrams * 4;

  let carbPercent = 0.4;
  let fatPercent = 0.3;

  if (goal === "lose") {
    carbPercent = 0.35;
    fatPercent = 0.25;
  }

  if (goal === "gain") {
    carbPercent = 0.5;
    fatPercent = 0.2;
  }

  const remainingCalories = targetCalories - proteinCalories;

  if (remainingCalories <= 0) return;

  const carbCalories = remainingCalories * carbPercent;
  const fatCalories = remainingCalories * fatPercent;

  profile.proteinTarget = proteinGrams;
  profile.carbTarget = Math.round(carbCalories / 4);
  profile.fatTarget = Math.round(fatCalories / 9);
}

async function runWeeklyAdjustments() {
  console.log("🚀 Running weekly adjustment...");

  const profiles = await HealthProfile.find();

  for (const profile of profiles) {
    try {
      const userId = profile.user;

      // Skip if no weight
      if (!profile.weight) continue;

      // Skip if user hasn't actually been using the app enough this week.
      // Prevents blind calorie cuts/adds for someone who's been inactive.
      const activeDays = await countActiveDays(userId);
      if (activeDays < MIN_ACTIVE_DAYS) {
        console.log(
          `⏸️  Skipped user ${userId} — only ${activeDays}/${LOOKBACK_DAYS} active days ` +
          `(needs ${MIN_ACTIVE_DAYS}). Calories unchanged, plan unchanged.`
        );
        continue;
      }

      let adjustment = 0;

      // Minimal safe logic (can improve later)
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

      console.log(`✅ Adjusted plan for user ${userId}`);

    } catch (err) {
      console.error(`❌ Failed for user ${profile.user}:`, err.message);
    }
  }

  console.log("🎉 Weekly adjustment completed.");
}

module.exports = runWeeklyAdjustments;