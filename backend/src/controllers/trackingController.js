const DailyLog = require("../models/DailyLog");

const getTodayRange = () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return { startOfToday, endOfToday };
};

exports.getTodayTracking = async (req, res) => {
  try {
    const { startOfToday, endOfToday } = getTodayRange();
    const todayLog = await DailyLog.findOne({
      user: req.user.id,
      date: { $gte: startOfToday, $lte: endOfToday },
    });
    res.status(200).json(todayLog);
  } catch (err) {
    console.error("Get today error:", err);
    res.status(500).json({ message: "Failed to fetch today tracking" });
  }
};

exports.saveTodayTracking = async (req, res) => {
  try {
    const { steps, water, sleep } = req.body;

    if (steps === undefined || water === undefined || sleep === undefined) {
      return res.status(400).json({ message: "steps, water and sleep are required" });
    }

    const { startOfToday, endOfToday } = getTodayRange();

    let track = await DailyLog.findOne({
      user: req.user.id,
      date: { $gte: startOfToday, $lte: endOfToday },
    });

    if (track) {
      track.steps = steps;
      track.water = water;
      track.sleep = sleep;
      await track.save();
    } else {
      track = await DailyLog.create({
        user: req.user.id,
        date: startOfToday,
        steps,
        water,
        sleep,
      });
    }

    res.status(200).json(track);
  } catch (err) {
    console.error("Save today error:", err);
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
    console.error("Recent logs error:", err);
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

    let totalSteps = 0, totalWater = 0, totalSleep = 0, bestDay = null;

    logs.forEach((log) => {
      totalSteps += log.steps;
      totalWater += log.water;
      totalSleep += log.sleep;
      if (!bestDay || log.steps > bestDay.steps) bestDay = log;
    });

    res.status(200).json({
      avgSteps: Math.round(totalSteps / logs.length),
      avgWater: (totalWater / logs.length).toFixed(1),
      avgSleep: (totalSleep / logs.length).toFixed(1),
      bestDay: bestDay.date,
      daysTracked: logs.length,
    });
  } catch (err) {
    console.error("Weekly summary error:", err);
    res.status(500).json({ message: "Weekly summary failed" });
  }
};