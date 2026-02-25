const HealthProfile = require("../modules/health/health.model");
const DietPlan = require("../modules/nutrition/dietPlan.model");
const { generateDietPlan } = require("../modules/nutrition/nutrition.service");

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

      const newMeals = await generateDietPlan(profile);

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