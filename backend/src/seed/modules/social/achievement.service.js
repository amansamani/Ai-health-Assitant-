const DailyLog = require("../../models/DailyLog");
const WorkoutLog = require("../../models/WorkoutLog");
const HealthProfile = require("../health/health.model");
const Achievement = require("./achievement.model");
const { awardXp } = require("./gamification.service");


const MILESTONES = [3, 7, 14, 30, 60, 100]; // days

// Matches the goals used on the frontend (TrackingScreen.js / HomeScreen.js)
// — steps and sleep are fixed, active-burn calories is personalized per
// user via the health profile.
const STEP_GOAL = 10000;

function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10); // YYYY-MM-DD
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Consecutive-day streak for a DailyLog numeric field vs. a goal, ending
 * today. If today hasn't hit the goal yet (or hasn't been logged), it's
 * excluded from the count rather than zeroing the streak out — an
 * in-progress day shouldn't erase yesterday's completed streak; it only
 * actually breaks the streak once today ends without meeting the goal.
 */
async function computeGoalStreak(userId, field, goal) {
  if (!goal) return 0;

  const today = startOfDay(new Date());
  const since = new Date(today);
  since.setDate(since.getDate() - 120); // cap the lookback — plenty for any real streak

  const logs = await DailyLog.find({
    user: userId,
    date: { $gte: since, $lte: today },
  }).select("date " + field).lean();

  const byDay = new Map(logs.map((l) => [dateKey(l.date), l[field] || 0]));

  let cursor = new Date(today);
  const todayVal = byDay.get(dateKey(cursor));
  if (todayVal == null || todayVal < goal) {
    cursor.setDate(cursor.getDate() - 1); // start counting from yesterday instead
  }

  let streak = 0;
  while (true) {
    const val = byDay.get(dateKey(cursor));
    if (val != null && val >= goal) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/** Same idea as computeGoalStreak, but for WorkoutLog's boolean completed flag. */
async function computeWorkoutStreak(userId) {
  const today = startOfDay(new Date());
  const since = new Date(today);
  since.setDate(since.getDate() - 120);

  const logs = await WorkoutLog.find({
    user: userId,
    date: { $gte: since, $lte: today },
    completed: true,
  }).select("date").lean();

  const completedDays = new Set(logs.map((l) => dateKey(l.date)));

  let cursor = new Date(today);
  if (!completedDays.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (completedDays.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

const STREAK_META = {
  workout: {
    metric: "workout",
    titleFor: (n) => `${n}-Day Workout Streak`,
    descFor: (n) => `Completed a workout ${n} days in a row.`,
    icon: "barbell-outline",
  },
  steps: {
    metric: "steps",
    titleFor: (n) => `${n}-Day Step Streak`,
    descFor: (n) => `Hit your step goal ${n} days in a row.`,
    icon: "footsteps-outline",
  },
  caloriesBurned: {
    metric: "caloriesBurned",
    titleFor: (n) => `${n}-Day Active Burn Streak`,
    descFor: (n) => `Hit your Active Burn goal ${n} days in a row.`,
    icon: "flame-outline",
  },
};

/**
 * Awards any newly-crossed streak milestones (idempotent — relies on the
 * unique {user, key} index, so calling this repeatedly is always safe).
 * Called after workout completion and after daily tracking saves; never
 * throws — a failure here should never break the write that triggered it.
 */
async function checkAndAwardStreakAchievements(userId) {
  try {
    const profile = await HealthProfile.findOne({ user: userId }).select("activeCalorieGoal").lean();
    const activeCalorieGoal = profile?.activeCalorieGoal || 400;

    const streaks = {
      workout: await computeWorkoutStreak(userId),
      steps: await computeGoalStreak(userId, "steps", STEP_GOAL),
      caloriesBurned: await computeGoalStreak(userId, "caloriesBurned", activeCalorieGoal),
    };

    const awarded = [];
    for (const [type, streakLen] of Object.entries(streaks)) {
      const meta = STREAK_META[type];
      const highestCrossed = [...MILESTONES].reverse().find((m) => streakLen >= m);
      if (!highestCrossed) continue;

      const key = `${type}_streak_${highestCrossed}`;
      try {
        const doc = await Achievement.create({
          user: userId,
          key,
          category: "streak",
          metric: meta.metric,
          title: meta.titleFor(highestCrossed),
          description: meta.descFor(highestCrossed),
          icon: meta.icon,
          value: highestCrossed,
        });
        awarded.push(doc);
        awardXp(userId, "achievementEarned", `achievement-xp:${doc._id}`, { achievementId: doc._id.toString(), title: doc.title }).catch(() => {});

        // Lazy require, not a top-of-file import: engagement.service.js
        // already requires *this* file (for computeWorkoutStreak/STEP_GOAL),
        // so requiring it back at module load time would create a circular
        // dependency — the destructure below would silently resolve to
        // undefined. Requiring inside the function defers it until both
        // modules have fully finished loading (cheap after the first call;
        // Node caches the resolved module).
        const { sendEventNotification } = require("../../notifications/engagement.service");
        sendEventNotification(userId, "achievementEarned", { achievementTitle: doc.title }, doc._id.toString()).catch(() => {});
      } catch (err) {
        if (err.code !== 11000) throw err; // 11000 = already awarded, not an error
      }
    }
    return awarded;
  } catch (err) {
    // Achievements are a nice-to-have layered on top of core tracking —
    // never let a bug here surface as a failure on the calling endpoint.
    // eslint-disable-next-line no-console
    console.warn("[achievements] check failed:", err.message);
    return [];
  }
}

/** Awards a one-off achievement when a duel resolves with this user as the winner.
 * Deliberately does NOT also fire an "achievementEarned" push — duel.service.js
 * already sends a "duelWon" notification for this exact event, and stacking a
 * second "🏅 New badge!" push for the same win would just be noise. */
async function awardDuelWin(userId, duel) {
  try {
    return await Achievement.create({
      user: userId,
      key: `duel_win_${duel._id}`,
      category: "duel",
      metric: "duel",
      title: "Duel Victory",
      description: `Won a ${duel.durationDays}-day ${duel.metric} duel.`,
      icon: "trophy-outline",
    });
  } catch (err) {
    if (err.code !== 11000) {
      console.warn("[achievements] duel win award failed:", err.message);
    }
    return null;
  }
}

module.exports = {
  computeGoalStreak,
  computeWorkoutStreak,
  checkAndAwardStreakAchievements,
  awardDuelWin,
  STEP_GOAL,
};
