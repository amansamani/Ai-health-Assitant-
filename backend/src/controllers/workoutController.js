const logger = require("../config/logger");
const WorkoutPlan = require("../models/WorkoutPlan");
const WorkoutLog = require("../models/WorkoutLog");
const HealthProfile = require("../modules/health/health.model");
const { addEstimatedCaloriesForToday } = require("./trackingController");

// Rough MET (Metabolic Equivalent of Task) values per workout style —
// grounded loosely in the Compendium of Physical Activities (resistance
// training ~3.5-6 METs, vigorous circuits/calisthenics higher). These are
// estimates, not lab measurements — good enough for a Tier 2 fallback when
// there's no wearable to measure the real thing.
const MET_TABLE = {
  equipment:  { bulk: 6,   lean: 7,   fit: 5.5 },
  bodyweight: { bulk: 5,   lean: 6.5, fit: 4.5 },
};
const DEFAULT_MET = 5;

function estimateWorkoutCalories(plan, weightKg) {
  if (!weightKg) return 0;
  const met = MET_TABLE[plan.mode]?.[plan.goal] ?? DEFAULT_MET;
  // WorkoutPlan doesn't store an explicit duration, so we approximate ~4
  // minutes per exercise (working sets + rest), clamped to a realistic
  // session length.
  const durationMinutes = Math.min(Math.max((plan.exercises?.length || 6) * 4, 20), 60);
  // Standard ACSM formula: kcal/min = METs × 3.5 × weight(kg) / 200
  const kcal = ((met * 3.5 * weightKg) / 200) * durationMinutes;
  return Math.round(kcal);
}

exports.getWorkouts = async (req, res) => {
  try {
    const { goal, mode } = req.query;

    if (!goal || !mode) {
      return res.status(400).json({ message: "goal and mode are required" });
    }

    const validGoals = ["bulk", "lean", "fit"];
    const validModes = ["equipment", "bodyweight"];

    if (!validGoals.includes(goal) || !validModes.includes(mode)) {
      return res.status(400).json({ message: "Invalid goal or mode value" });
    }

    const workouts = await WorkoutPlan.find({ goal, mode }).sort({ day: 1 });

    res.status(200).json(workouts);
  } catch (err) {
    logger.error({ err }, "Get workouts error");
    res.status(500).json({ message: "Failed to fetch workouts" });
  }
};

exports.markWorkoutComplete = async (req, res) => {
  try {
    const { workoutPlanId, date } = req.body;

    if (!workoutPlanId) {
      return res.status(400).json({ message: "workoutPlanId is required" });
    }

    const plan = await WorkoutPlan.findById(workoutPlanId);
    if (!plan) {
      return res.status(404).json({ message: "Workout plan not found" });
    }

    const logDate = date ? new Date(date) : new Date();
    logDate.setHours(0, 0, 0, 0);

    const log = await WorkoutLog.findOneAndUpdate(
      { user: req.user.id, date: logDate },
      { user: req.user.id, date: logDate, workoutPlan: workoutPlanId, completed: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Tier 2b of the calorie-source hierarchy: no wearable needed — since
    // we already know exactly what workout the user just finished, we can
    // estimate the burn from METs + their logged body weight.
    let caloriesAdded = 0;
    try {
      const profile = await HealthProfile.findOne({ user: req.user.id }).select("weight").lean();
      if (profile?.weight) {
        caloriesAdded = estimateWorkoutCalories(plan, profile.weight);
        if (caloriesAdded > 0) {
          await addEstimatedCaloriesForToday(req.user.id, caloriesAdded);
        }
      }
    } catch (err) {
      logger.warn({ err }, "Could not add estimated workout calories");
      caloriesAdded = 0;
    }

    res.status(200).json({ message: "Workout marked complete", log, caloriesAdded });
  } catch (err) {
    logger.error({ err }, "Mark workout complete error");
    res.status(500).json({ message: "Failed to mark workout complete" });
  }
};

exports.getRecentCompletions = async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await WorkoutLog.find({
      user: req.user.id,
      date: { $gte: since },
    }).sort({ date: -1 });

    res.status(200).json(logs);
  } catch (err) {
    logger.error({ err }, "Get recent completions error");
    res.status(500).json({ message: "Failed to fetch completion history" });
  }
};