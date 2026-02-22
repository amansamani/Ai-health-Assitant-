const HealthProfile = require("../modules/health/health.model");
const DietPlan = require("../modules/nutrition/dietPlan.model");
const {
  evaluateWeeklyProgress,
  generateDietPlan
} = require("../modules/nutrition/nutrition.service");

async function runWeeklyAdjustments() {
  console.log("🔄 Running weekly diet adjustment job...");

  const profiles = await HealthProfile.find();

  for (let profile of profiles) {
    try {
      const userId = profile.user;

      const evaluation = await evaluateWeeklyProgress(userId, profile);

      if (!evaluation.adjust || evaluation.adherence < 70) continue;

      let adjustment = 0;

      if (profile.goal === "lose" && evaluation.weightChange >= 0) {
        adjustment = -100;
      }

      if (profile.goal === "gain" && evaluation.weightChange <= 0) {
        adjustment = +150;
      }

      if (adjustment === 0) continue;

      profile.targetCalories = Math.max(
        profile.targetCalories + adjustment,
        profile.goal === "lose" ? 1200 : 1500
      );

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
      console.error(`❌ Error adjusting user ${profile.user}:`, err);
    }
  }

  console.log("✅ Weekly adjustment completed.");
}

module.exports = runWeeklyAdjustments;