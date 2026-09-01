const DailyLog = require("../../models/DailyLog");
const WorkoutLog = require("../../models/WorkoutLog");
const { awardDuelWin } = require("./achievement.service");
const { awardXp } = require("./gamification.service");

const { sendEventNotification } = require("../../notifications/engagement.service");

/**
 * Sums a metric for one user between two dates (inclusive). Deliberately
 * recomputed from the source logs every time rather than cached — a duel's
 * progress should always exactly match what Today's Log / Weekly Summary
 * show, with zero risk of drifting out of sync.
 */
async function computeScore(userId, metric, from, to) {
  if (metric === "workouts") {
    return WorkoutLog.countDocuments({
      user: userId,
      completed: true,
      date: { $gte: from, $lte: to },
    });
  }

  // steps | caloriesBurned
  const logs = await DailyLog.find({
    user: userId,
    date: { $gte: from, $lte: to },
  }).select(metric).lean();

  return logs.reduce((total, log) => total + (log[metric] || 0), 0);
}

/** Live progress for a still-open duel (pending or active). Works whether
 * duel.challenger/opponent are raw ObjectIds or populated user documents. */
async function computeDuelProgress(duel) {
  const challengerId = duel.challenger._id || duel.challenger;
  const opponentId = duel.opponent._id || duel.opponent;

  const from = duel.startDate || duel.createdAt;
  const to = duel.endDate && duel.endDate < new Date() ? duel.endDate : new Date();

  const [challengerScore, opponentScore] = await Promise.all([
    computeScore(challengerId, duel.metric, from, to),
    computeScore(opponentId, duel.metric, from, to),
  ]);

  return { challengerScore, opponentScore };
}

/**
 * If an active duel's window has closed, finalize it: freeze the scores,
 * decide a winner (or tie), award the winner an achievement, and flip
 * status to "completed". Safe to call on every read — it's a no-op for
 * duels that aren't active or haven't reached endDate yet.
 */
async function resolveDuelIfExpired(duel) {
  if (duel.status !== "active" || !duel.endDate || duel.endDate > new Date()) {
    return duel;
  }

  const challengerId = duel.challenger._id || duel.challenger;
  const opponentId = duel.opponent._id || duel.opponent;
  const challengerName = duel.challenger.name || "them";
  const opponentName = duel.opponent.name || "them";
  const { challengerScore, opponentScore } = await computeDuelProgress(duel);

  duel.finalChallengerScore = challengerScore;
  duel.finalOpponentScore = opponentScore;
  duel.winner =
    challengerScore > opponentScore ? challengerId
    : opponentScore > challengerScore ? opponentId
    : undefined; // tie
  duel.status = "completed";
  await duel.save();

  if (duel.winner) {
    await awardDuelWin(duel.winner, duel);
    awardXp(duel.winner, "duelWin", `duel-win:${duel._id}`, { duelId: duel._id.toString(), metric: duel.metric }).catch(() => {});

    const winnerIsChallenger = duel.winner.toString() === challengerId.toString();
    const loserId = winnerIsChallenger ? opponentId : challengerId;
    const winnerName = winnerIsChallenger ? challengerName : opponentName;
    const loserName = winnerIsChallenger ? opponentName : challengerName;

    // Fire-and-forget, both directions — the winner hears "you won", the
    // loser hears "so close, rematch?" (never a guilt-trip — see copy.js's
    // own ground rules). Not gated by the notification module's usual
    // daily cap since these are event-triggered, not scheduled.
    sendEventNotification(duel.winner, "duelWon", { name: loserName }, duel._id.toString()).catch(() => {});
    sendEventNotification(loserId, "duelLost", { name: winnerName }, duel._id.toString()).catch(() => {});
  } else {
    sendEventNotification(challengerId, "duelTie", { name: opponentName }, duel._id.toString()).catch(() => {});
    sendEventNotification(opponentId, "duelTie", { name: challengerName }, duel._id.toString()).catch(() => {});
  }

  return duel;
}

module.exports = { computeDuelProgress, resolveDuelIfExpired };
