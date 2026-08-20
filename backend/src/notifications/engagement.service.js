const User = require("../models/User");
const DailyLog = require("../models/DailyLog");
const WorkoutLog = require("../models/WorkoutLog");
const MealLog = require("../modules/nutrition/mealLog.model");
const NotificationLog = require("../models/NotificationLog");
const { sendPushNotification } = require("../utils/pushNotification");
const { computeWorkoutStreak, STEP_GOAL } = require("../modules/social/achievement.service");
const { pick } = require("./copy");
const logger = require("../config/logger");

// A user with a pushToken has already opted in at the OS level, but we
// still cap how many *scheduled* nudges (not event-triggered ones — see
// sendEventNotification) they can get in one day. Getting a meal reminder,
// a step nudge, AND a streak warning in the same afternoon is how people
// turn notifications off entirely.
const MAX_SCHEDULED_PER_DAY = 3;

function dateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

// ── Per-moment eligibility checks ───────────────────────────────────────
// Each returns { eligible, vars } — vars feed the {placeholders} in copy.js.
// These check *today's actual data*, so a moment only fires when it's
// genuinely relevant (no lunch reminder if lunch is already logged, no
// step nudge if the goal's already hit).

async function checkMorningKickoff(userId) {
  const streakDay = await computeWorkoutStreak(userId);
  return { eligible: true, vars: { streakDay } };
}

async function checkLunchReminder(userId) {
  const hasLunch = await MealLog.exists({
    user: userId, mealType: "lunch",
    loggedAt: { $gte: startOfDay(), $lte: endOfDay() },
  });
  return { eligible: !hasLunch, vars: {} };
}

async function checkDinnerReminder(userId) {
  const hasDinner = await MealLog.exists({
    user: userId, mealType: "dinner",
    loggedAt: { $gte: startOfDay(), $lte: endOfDay() },
  });
  return { eligible: !hasDinner, vars: {} };
}

async function checkWaterNudge(userId) {
  const log = await DailyLog.findOne({
    user: userId, date: { $gte: startOfDay(), $lte: endOfDay() },
  }).select("water").lean();
  const water = log?.water || 0;
  return { eligible: water < 1.5, vars: {} }; // under half of a typical 3L goal
}

async function checkStepNudge(userId) {
  const log = await DailyLog.findOne({
    user: userId, date: { $gte: startOfDay(), $lte: endOfDay() },
  }).select("steps").lean();
  const steps = log?.steps || 0;
  const remaining = Math.max(STEP_GOAL - steps, 0);
  return { eligible: steps < STEP_GOAL * 0.6, vars: { stepsLeft: remaining.toLocaleString("en-IN") } };
}

async function checkWorkoutReminder(userId) {
  const hasWorkout = await WorkoutLog.exists({
    user: userId, completed: true,
    date: { $gte: startOfDay(), $lte: endOfDay() },
  });
  return { eligible: !hasWorkout, vars: {} };
}

async function checkStreakAtRisk(userId) {
  // "At risk" = a streak worth protecting (3+ days) that hasn't been
  // extended yet today. Deliberately only checks the workout streak —
  // it's the one with a clear single daily action ("did you work out"),
  // vs steps/calories which can still tick up passively later in the day.
  const [workoutStreak, hasWorkoutToday] = await Promise.all([
    computeWorkoutStreak(userId),
    WorkoutLog.exists({ user: userId, completed: true, date: { $gte: startOfDay(), $lte: endOfDay() } }),
  ]);
  return { eligible: workoutStreak >= 3 && !hasWorkoutToday, vars: { streakDay: workoutStreak } };
}

async function checkWeeklyRecap() {
  return { eligible: true, vars: {} }; // gating is the Monday-only cron, not user data
}

async function checkComeback(userId) {
  const recentLog = await DailyLog.findOne({ user: userId }).sort({ date: -1 }).select("date").lean();
  if (!recentLog) return { eligible: false, vars: {} };
  const daysSince = Math.round((startOfDay() - startOfDay(recentLog.date)) / (1000 * 60 * 60 * 24));
  return { eligible: daysSince >= 3, vars: {} };
}

const MOMENT_CHECKS = {
  morningKickoff: checkMorningKickoff,
  lunchReminder: checkLunchReminder,
  dinnerReminder: checkDinnerReminder,
  waterNudge: checkWaterNudge,
  stepNudge: checkStepNudge,
  workoutReminder: checkWorkoutReminder,
  streakAtRisk: checkStreakAtRisk,
  weeklyRecap: checkWeeklyRecap,
  comeback: checkComeback,
};

// ── Send gates ───────────────────────────────────────────────────────────

/** Scheduled moments: dedup by day, respect the daily cap. */
async function sendScheduledIfEligible(userId, pushToken, moment, vars) {
  const today = dateKey();

  const [alreadySent, sentTodayCount] = await Promise.all([
    NotificationLog.exists({ user: userId, moment, dateKey: today }),
    NotificationLog.countDocuments({ user: userId, dateKey: today }),
  ]);

  if (alreadySent) return { sent: false, reason: "already sent today" };
  if (sentTodayCount >= MAX_SCHEDULED_PER_DAY) return { sent: false, reason: "daily cap reached" };

  return deliverAndLog(userId, pushToken, moment, vars, today);
}

/**
 * Event-triggered (achievement earned, duel result, etc.) — no daily cap,
 * since these are rare, positive, and time-sensitive (you want to know you
 * won a duel *now*, not "sorry, you already hit your notification limit").
 * `uniqueEventId` (e.g. a duel or achievement _id) makes the dedup key
 * event-specific rather than day-specific, so multiple different events of
 * the same type can each notify once, but the *same* event never double-fires.
 */
async function sendEventNotification(userId, moment, vars = {}, uniqueEventId = "") {
  try {
    const user = await User.findById(userId).select("pushToken").lean();
    if (!user?.pushToken) return { sent: false, reason: "no push token" };

    const key = uniqueEventId ? `${moment}:${uniqueEventId}` : moment;
    const already = await NotificationLog.exists({ user: userId, moment: key, dateKey: dateKey() });
    if (already) return { sent: false, reason: "already sent" };

    return deliverAndLog(userId, user.pushToken, moment, vars, dateKey(), key);
  } catch (err) {
    logger.warn({ err, userId, moment }, "Event notification failed");
    return { sent: false, reason: err.message };
  }
}

async function deliverAndLog(userId, pushToken, moment, vars, today, logKey = moment) {
  const content = pick(moment, vars);
  if (!content) return { sent: false, reason: "no copy for moment" };

  const result = await sendPushNotification(pushToken, content.title, content.body, { moment, ...vars });

  if (result.sent) {
    try {
      await NotificationLog.create({ user: userId, moment: logKey, dateKey: today });
    } catch (err) {
      if (err.code !== 11000) throw err; // race with another process — already logged, fine
    }
  }
  return result;
}

// ── Batch runner — one scheduled moment, every opted-in user ─────────────
async function runMomentForAllUsers(moment) {
  const checkFn = MOMENT_CHECKS[moment];
  if (!checkFn) {
    logger.warn({ moment }, "Unknown notification moment — skipping");
    return { processed: 0, sent: 0 };
  }

  const users = await User.find({ pushToken: { $exists: true, $ne: null } }).select("_id pushToken").lean();
  let sent = 0;

  for (const user of users) {
    try {
      const { eligible, vars } = await checkFn(user._id);
      if (!eligible) continue;
      const result = await sendScheduledIfEligible(user._id, user.pushToken, moment, vars);
      if (result.sent) sent++;
    } catch (err) {
      logger.error({ err, userId: user._id, moment }, "Notification check failed for user");
    }
  }

  logger.info({ moment, processed: users.length, sent }, "Engagement notification run complete");
  return { processed: users.length, sent };
}

module.exports = { runMomentForAllUsers, sendEventNotification, MOMENT_CHECKS };
