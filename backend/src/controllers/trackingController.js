const logger = require("../config/logger");
const DailyLog = require("../models/DailyLog");

const getTodayRange = () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return { startOfToday, endOfToday };
};

// Tier 2 of the calorie-source hierarchy: called by workoutController when
// a workout is marked complete, to add a METs-based estimate on top of
// today's caloriesBurned.
//
// If a wearable has already reported real active-calorie data today
// (source === "device"), we deliberately skip adding the estimate — the
// watch almost certainly already captured that same workout, and stacking
// an estimate on top would double-count it. Estimates only fill the gap
// when there's no real device data for the day.
const addEstimatedCaloriesForToday = async (userId, kcalToAdd) => {
  if (!kcalToAdd || kcalToAdd <= 0) return null;

  const { startOfToday, endOfToday } = getTodayRange();
  let track = await DailyLog.findOne({
    user: userId,
    date: { $gte: startOfToday, $lte: endOfToday },
  });

  if (track?.source === "device") {
    return track; // real data already present — don't stack an estimate on it
  }

  if (track) {
    track.caloriesBurned = Math.round((track.caloriesBurned || 0) + kcalToAdd);
    track.source = "estimated";
    await track.save();
  } else {
    track = await DailyLog.create({
      user: userId,
      date: startOfToday,
      caloriesBurned: Math.round(kcalToAdd),
      source: "estimated",
    });
  }
  return track;
};
exports.addEstimatedCaloriesForToday = addEstimatedCaloriesForToday;

exports.getTodayTracking = async (req, res) => {
  try {
    const { startOfToday, endOfToday } = getTodayRange();
    const todayLog = await DailyLog.findOne({
      user: req.user.id,
      date: { $gte: startOfToday, $lte: endOfToday },
    });
    res.status(200).json(todayLog);
  } catch (err) {
    logger.error({ err }, "Get today error");
    res.status(500).json({ message: "Failed to fetch today tracking" });
  }
};

exports.saveTodayTracking = async (req, res) => {
  try {
    const { steps, water, sleep, caloriesBurned, source } = req.body;

    if (steps === undefined && water === undefined && sleep === undefined && caloriesBurned === undefined) {
      return res.status(400).json({ message: "At least one of steps, water, sleep or caloriesBurned is required" });
    }

    const { startOfToday, endOfToday } = getTodayRange();

    let track = await DailyLog.findOne({
      user: req.user.id,
      date: { $gte: startOfToday, $lte: endOfToday },
    });

    // Only overwrite the fields that were actually sent — this lets a
    // device sync post steps+sleep+calories now and water later (or vice
    // versa) without one write wiping out the other's numbers.
    if (track) {
      if (steps !== undefined) track.steps = steps;
      if (water !== undefined) track.water = water;
      if (sleep !== undefined) track.sleep = sleep;
      if (caloriesBurned !== undefined) track.caloriesBurned = caloriesBurned;
      if (source) track.source = source;
      await track.save();
    } else {
      track = await DailyLog.create({
        user: req.user.id,
        date: startOfToday,
        steps: steps ?? 0,
        water: water ?? 0,
        sleep: sleep ?? 0,
        caloriesBurned: caloriesBurned ?? 0,
        source: source || "manual",
      });
    }

    res.status(200).json(track);
  } catch (err) {
    logger.error({ err }, "Save today error");
    res.status(500).json({ message: "Failed to save today tracking" });
  }
};

exports.getRecentLogs = async (req, res) => {
  try {
    const days = Math.min(Number(req.params.days) || 3, 30);
    const { startOfToday } = getTodayRange();
    const fromDate = new Date(startOfToday);
    fromDate.setDate(startOfToday.getDate() - days);

    const logs = await DailyLog.find({
      user: req.user.id,
      date: { $gte: fromDate, $lt: startOfToday },
    }).sort({ date: -1 });

    res.status(200).json(logs);
  } catch (err) {
    logger.error({ err }, "Recent logs error");
    res.status(500).json({ message: "Failed to fetch recent logs" });
  }
};

exports.getWeeklySummary = async (req, res) => {
  try {
    const { startOfToday, endOfToday } = getTodayRange();
    const lastWeek = new Date(startOfToday);
    lastWeek.setDate(startOfToday.getDate() - 6);

    const logs = await DailyLog.find({
      user: req.user.id,
      date: { $gte: lastWeek, $lte: endOfToday },
    });

    if (!logs.length) {
      return res.status(200).json({ message: "No data" });
    }

    let totalSteps = 0, totalWater = 0, totalSleep = 0, totalCalories = 0, bestDay = null;

    logs.forEach((log) => {
      totalSteps += log.steps;
      totalWater += log.water;
      totalSleep += log.sleep;
      totalCalories += log.caloriesBurned || 0;
      if (!bestDay || log.steps > bestDay.steps) bestDay = log;
    });

    res.status(200).json({
      avgSteps: Math.round(totalSteps / logs.length),
      avgWater: (totalWater / logs.length).toFixed(1),
      avgSleep: (totalSleep / logs.length).toFixed(1),
      avgCalories: Math.round(totalCalories / logs.length),
      bestDay: bestDay.date,
      daysTracked: logs.length,
    });
  } catch (err) {
    logger.error({ err }, "Weekly summary error");
    res.status(500).json({ message: "Weekly summary failed" });
  }
};