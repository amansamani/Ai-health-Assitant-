"use strict";

// ── REPLACE the existing logDailyDiet in nutrition.controller.js with this ────
//
// What changed:
//   Old: user manually sends caloriesConsumed — nothing validated against plan.
//   New: when mealsCompleted changes, we look up the active DietPlan and sum
//        the actual calories of each completed meal slot automatically.
//        caloriesConsumed is still accepted from the body as an override
//        (for users who ate something different), but if omitted we compute it.

const DietProgress = require("../nutrition/dietProgress.model");
const DietPlan     = require("../nutrition/dietPlan.model");

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

const logDailyDiet = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date, mealsCompleted, caloriesConsumed, weight, notes } = req.body;

    const logDate = date || todayStr();
    if (isNaN(Date.parse(logDate))) {
      return res.status(400).json({ message: "Invalid date" });
    }

    // ── Auto-compute calories from active diet plan ───────────────────────────
    let resolvedCalories = caloriesConsumed;

    if (mealsCompleted && resolvedCalories == null) {
      const plan = await DietPlan.findOne({ user: userId, isActive: true }).lean();

      if (plan?.meals) {
        let total = 0;
        for (const [mealType, done] of Object.entries(mealsCompleted)) {
          if (!done) continue;
          const mealArr = plan.meals[mealType] || [];
          for (const combo of mealArr) {
            total += combo.calories || 0;
          }
        }
        resolvedCalories = total;
      }
    }

    // Build the update payload — only include defined fields
    const update = {};
    if (mealsCompleted != null)     update.mealsCompleted    = mealsCompleted;
    if (resolvedCalories != null)   update.caloriesConsumed  = resolvedCalories;
    if (weight != null)             update.weight            = weight;
    if (notes  != null)             update.notes             = notes;

    const log = await DietProgress.findOneAndUpdate(
      { user: userId, date: logDate },
      update,
      { new: true, upsert: true }
    );

    res.json({
      ...log.toObject(),
      // Surface what was computed so the frontend can show "Calories from plan: 540"
      caloriesSource: caloriesConsumed != null ? "manual" : "plan",
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /nutrition/log?date=YYYY-MM-DD ────────────────────────────────────────
// Returns the progress log for a given date with plan context.
const getDailyDietLog = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const date   = req.query.date || todayStr();

    const [log, plan] = await Promise.all([
      DietProgress.findOne({ user: userId, date }).lean(),
      DietPlan.findOne({ user: userId, isActive: true })
        .select("meals summary targetCalories")
        .lean(),
    ]);

    // Build per-meal context: did user complete it, and what were the planned calories?
    const mealContext = {};
    if (plan?.meals) {
      for (const mealType of ["breakfast", "lunch", "dinner", "snack"]) {
        const combos = plan.meals[mealType] || [];
        const plannedCals = combos.reduce((s, c) => s + (c.calories || 0), 0);
        mealContext[mealType] = {
          plannedCalories: plannedCals,
          mealName: combos[0]?.mealName || null,
          completed: log?.mealsCompleted?.[mealType] ?? false,
        };
      }
    }

    res.json({
      date,
      log: log || null,
      plan: plan
        ? {
            targetCalories: plan.summary?.targetCalories ?? plan.targetCalories,
            mealContext,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { logDailyDiet, getDailyDietLog };