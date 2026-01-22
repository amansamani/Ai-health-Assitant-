const DailyLog = require("../models/DailyLog");

// ADD / UPDATE TODAY'S LOG
const updateDailyLog = async (req, res) => {
  try {
    const { steps, water, sleep } = req.body;

    const today = new Date().setHours(0, 0, 0, 0);

    let log = await DailyLog.findOne({
      user: req.user._id,
      date: today,
    });

    if (!log) {
      log = await DailyLog.create({
        user: req.user._id,
        steps: steps || 0,
        water: water || 0,
        sleep: sleep || 0,
      });
    } else {
      if (steps !== undefined) log.steps = steps;
      if (water !== undefined) log.water = water;
      if (sleep !== undefined) log.sleep = sleep;
      await log.save();
    }

    res.json({
      message: "Daily log updated",
      log,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET TODAY'S LOG
const getTodayLog = async (req, res) => {
  const today = new Date().setHours(0, 0, 0, 0);

  const log = await DailyLog.findOne({
    user: req.user._id,
    date: today,
  });

  res.json(log || {});
};

module.exports = { updateDailyLog, getTodayLog };
