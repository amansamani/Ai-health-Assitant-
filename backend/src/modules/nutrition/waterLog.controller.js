"use strict";

const WaterLog     = require("./waterLog.model");
const HealthProfile = require("../health/health.model");

// ── helpers ────────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

/** Default water goal in ml based on weight (30 ml/kg, capped 2000–4000). */
function defaultGoal(profile) {
  const weight = profile?.weight || 70;
  return Math.min(4000, Math.max(2000, Math.round(weight * 30)));
}

// ── GET /nutrition/water?date=YYYY-MM-DD ───────────────────────────────────────
// Returns today's log (or empty scaffold if none exists yet).
const getWaterLog = async (req, res, next) => {
  try {
    const date   = req.query.date || todayStr();
    const userId = req.user.id;

    let log = await WaterLog.findOne({ user: userId, date }).lean();

    if (!log) {
      // Return a zeroed scaffold — don't create until first drink logged
      const profile = await HealthProfile.findOne({ user: userId }).lean();
      return res.json({
        date,
        totalMl:  0,
        goalMl:   defaultGoal(profile),
        logs:     [],
        pct:      0,
      });
    }

    res.json({
      date:    log.date,
      totalMl: log.totalMl,
      goalMl:  log.goalMl,
      logs:    log.logs,
      pct:     log.goalMl > 0 ? Math.min(Math.round((log.totalMl / log.goalMl) * 100), 100) : 0,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /nutrition/water  { amount, label? } ──────────────────────────────────
// Adds a drink entry and increments totalMl.
const addWater = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { amount, label = "Water", date } = req.body;

    const ml = parseInt(amount, 10);
    if (!ml || ml < 10 || ml > 2000) {
      return res.status(400).json({ message: "amount must be 10–2000 ml" });
    }

    const logDate = date || todayStr();

    // Resolve goal
    const profile = await HealthProfile.findOne({ user: userId }).lean();
    const goal    = defaultGoal(profile);

    const entry = { amount: ml, label, loggedAt: new Date() };

    const log = await WaterLog.findOneAndUpdate(
      { user: userId, date: logDate },
      {
        $inc:  { totalMl: ml },
        $push: { logs: entry },
        $setOnInsert: { goalMl: goal },
      },
      { new: true, upsert: true }
    );

    res.status(201).json({
      date:    log.date,
      totalMl: log.totalMl,
      goalMl:  log.goalMl,
      logs:    log.logs,
      pct:     log.goalMl > 0 ? Math.min(Math.round((log.totalMl / log.goalMl) * 100), 100) : 0,
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /nutrition/water/last ───────────────────────────────────────────────
// Removes the most recent drink entry (undo button).
const undoLastWater = async (req, res, next) => {
  try {
    const userId  = req.user.id;
    const date    = req.query.date || todayStr();

    const log = await WaterLog.findOne({ user: userId, date });
    if (!log || log.logs.length === 0) {
      return res.status(404).json({ message: "Nothing to undo" });
    }

    const last = log.logs[log.logs.length - 1];
    log.totalMl = Math.max(0, log.totalMl - last.amount);
    log.logs.pop();
    await log.save();

    res.json({
      date:    log.date,
      totalMl: log.totalMl,
      goalMl:  log.goalMl,
      logs:    log.logs,
      pct:     log.goalMl > 0 ? Math.min(Math.round((log.totalMl / log.goalMl) * 100), 100) : 0,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /nutrition/water/goal  { goalMl } ──────────────────────────────────────
// Lets user override their daily goal.
const setWaterGoal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { goalMl } = req.body;
    const goal = parseInt(goalMl, 10);

    if (!goal || goal < 500 || goal > 6000) {
      return res.status(400).json({ message: "goalMl must be 500–6000" });
    }

    const date = todayStr();
    const profile = await HealthProfile.findOne({ user: userId }).lean();

    const log = await WaterLog.findOneAndUpdate(
      { user: userId, date },
      { $set: { goalMl: goal } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ goalMl: log.goalMl });
  } catch (err) {
    next(err);
  }
};

module.exports = { getWaterLog, addWater, undoLastWater, setWaterGoal };