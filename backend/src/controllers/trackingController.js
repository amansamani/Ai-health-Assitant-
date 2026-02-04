const DailyLog = require("../models/DailyLog");

/**
 * Utility: get start & end of today
 */
const getTodayRange = () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return { startOfToday, endOfToday };
};

/**
 * ============================
 * GET /api/track/today
 * ============================
 * Returns today's tracking data
 */
exports.getTodayTracking = async (req, res) => {
  try {
    const { startOfToday, endOfToday } = getTodayRange();

    const todayLog = await DailyLog.findOne({
      user: req.user.id,
      date: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    });

    res.status(200).json(todayLog);
  } catch (err) {
    console.error("Get today error:", err);
    res.status(500).json({ message: "Failed to fetch today tracking" });
  }
};

/**
 * ============================
 * POST /api/track/today
 * ============================
 * Creates or updates today's tracking
 */
exports.saveTodayTracking = async (req, res) => {
  try {
    const { steps, water, sleep } = req.body;
    const { startOfToday, endOfToday } = getTodayRange();

    let track = await DailyLog.findOne({
      user: req.user.id,
      date: {
        $gte: startOfToday,
        $lte: endOfToday,
      },
    });

    if (track) {
      // Update existing today record
      track.steps = steps;
      track.water = water;
      track.sleep = sleep;
      await track.save();
    } else {
      // Create new today record
      track = await DailyLog.create({
        user: req.user.id,
        date: startOfToday, // normalized date
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

/**
 * ============================
 * GET /api/track/recent/:days
 * ============================
 * Returns past days ONLY (excludes today)
 */
exports.getRecentLogs = async (req, res) => {
  try {
    const days = Number(req.params.days || 3);

    const { startOfToday } = getTodayRange();

    const fromDate = new Date(startOfToday);
    fromDate.setDate(startOfToday.getDate() - days);

    const logs = await DailyLog.find({
      user: req.user.id,
      date: {
        $gte: fromDate,
        $lt: startOfToday, // 🔥 excludes today
      },
    }).sort({ date: -1 });

    res.status(200).json(logs);
  } catch (err) {
    console.error("Recent logs error:", err);
    res.status(500).json({ message: "Failed to fetch recent logs" });
  }
};

/**
 * ============================
 * GET /api/track/weekly
 * ============================
 * Weekly summary (includes today)
 */
exports.getWeeklySummary = async (req, res) => {
  try {
    const { startOfToday, endOfToday } = getTodayRange();

    const lastWeek = new Date(startOfToday);
    lastWeek.setDate(startOfToday.getDate() - 6);

    const logs = await DailyLog.find({
      user: req.user.id,
      date: {
        $gte: lastWeek,
        $lte: endOfToday,
      },
    });

    if (!logs.length) {
      return res.status(200).json({ message: "No data" });
    }

    let totalSteps = 0;
    let totalWater = 0;
    let totalSleep = 0;
    let bestDay = null;

    logs.forEach((log) => {
      totalSteps += log.steps;
      totalWater += log.water;
      totalSleep += log.sleep;

      if (!bestDay || log.steps > bestDay.steps) {
        bestDay = log;
      }
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
