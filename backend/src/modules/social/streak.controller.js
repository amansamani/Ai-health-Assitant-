const logger = require("../../config/logger");
const User = require("../../models/User");
const HealthProfile = require("../health/health.model");
const Friendship = require("./friendship.model");
const { computeWorkoutStreak, computeGoalStreak, STEP_GOAL } = require("./achievement.service");

// Same canonical-pair convention as friendship.controller.js / duel.controller.js
// (kept as a small local copy rather than a shared util, matching how the
// rest of this module already does it).
function canonicalPair(idA, idB) {
  const a = idA.toString();
  const b = idB.toString();
  return a < b ? [a, b] : [b, a];
}

async function areFriends(idA, idB) {
  const [user1, user2] = canonicalPair(idA, idB);
  const friendship = await Friendship.findOne({ user1, user2 });
  return !!friendship;
}

// The same three streaks achievement.service.js tracks for badges — workout
// completion, step goal, and Active Burn goal (personalized per user).
async function getUserStreaks(userId) {
  const profile = await HealthProfile.findOne({ user: userId }).select("activeCalorieGoal").lean();
  const activeCalorieGoal = profile?.activeCalorieGoal || 400;

  const [workout, steps, caloriesBurned] = await Promise.all([
    computeWorkoutStreak(userId),
    computeGoalStreak(userId, "steps", STEP_GOAL),
    computeGoalStreak(userId, "caloriesBurned", activeCalorieGoal),
  ]);

  return { workout, steps, caloriesBurned };
}

exports.getMyStreaks = async (req, res) => {
  try {
    const streaks = await getUserStreaks(req.user.id);
    res.status(200).json(streaks);
  } catch (err) {
    logger.error({ err }, "Get my streaks error");
    res.status(500).json({ message: "Failed to fetch streaks" });
  }
};

// The actual "battle" — head-to-head streaks against one friend.
exports.compareStreaks = async (req, res) => {
  try {
    const { friendId } = req.params;

    if (friendId === req.user.id) {
      return res.status(400).json({ message: "Pick a friend to compare with" });
    }
    if (!(await areFriends(req.user.id, friendId))) {
      return res.status(403).json({ message: "You can only compare streaks with friends" });
    }

    const friend = await User.findById(friendId).select("name picture");
    if (!friend) return res.status(404).json({ message: "User not found" });

    const [mine, theirs] = await Promise.all([
      getUserStreaks(req.user.id),
      getUserStreaks(friendId),
    ]);

    res.status(200).json({
      me: mine,
      friend: { id: friend._id, name: friend.name, picture: friend.picture, streaks: theirs },
    });
  } catch (err) {
    logger.error({ err }, "Compare streaks error");
    res.status(500).json({ message: "Failed to compare streaks" });
  }
};

// Broader view than a single 1v1 compare — everyone in your friend circle
// ranked by workout streak (ties broken by step streak). Makes the feature
// feel alive with more than one friend, not just a single rival.
exports.streakLeaderboard = async (req, res) => {
  try {
    const friendships = await Friendship.find({
      $or: [{ user1: req.user.id }, { user2: req.user.id }],
    }).lean();

    const friendIds = friendships.map((f) =>
      f.user1.toString() === req.user.id ? f.user2.toString() : f.user1.toString()
    );
    const allIds = [req.user.id, ...friendIds];

    const users = await User.find({ _id: { $in: allIds } }).select("name picture").lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const rows = await Promise.all(
      allIds.map(async (id) => ({
        user: userMap.get(id),
        streaks: await getUserStreaks(id),
        isMe: id === req.user.id,
      }))
    );

    rows.sort((a, b) =>
      b.streaks.workout - a.streaks.workout || b.streaks.steps - a.streaks.steps
    );

    res.status(200).json(rows);
  } catch (err) {
    logger.error({ err }, "Streak leaderboard error");
    res.status(500).json({ message: "Failed to fetch streak leaderboard" });
  }
};
