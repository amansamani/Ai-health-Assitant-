const logger = require("../config/logger");
const WorkoutPlan = require("../models/WorkoutPlan");
const WorkoutLog = require("../models/WorkoutLog");

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

    res.status(200).json({ message: "Workout marked complete", log });
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