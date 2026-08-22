"use strict";

const User = require("../../models/User");
const XpEvent = require("./xpEvent.model");
const Achievement = require("./achievement.model");
const { XP_VALUES, getGamificationSnapshot } = require("./gamification.config");

async function awardXp(userId, type, key, metadata = {}) {
  const amount = Number(XP_VALUES[type] || 0);
  if (!amount || !userId || !key) return { awarded: false, xp: 0 };

  try {
    const write = await XpEvent.updateOne(
      { user: userId, key },
      {
        $setOnInsert: {
          user: userId,
          key,
          type,
          xp: amount,
          metadata,
          earnedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const inserted = Number(write.upsertedCount || 0) > 0;
    if (!inserted) {
      const user = await User.findById(userId).select("totalXp").lean();
      return { awarded: false, xp: 0, totalXp: user?.totalXp || 0 };
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { totalXp: amount } },
      { new: true, select: "totalXp" }
    ).lean();

    return { awarded: true, xp: amount, totalXp: user?.totalXp || 0 };
  } catch (err) {
    throw err;
  }
}

async function getGamification(userId) {
  const user = await User.findById(userId).select("name picture username totalXp").lean();
  if (!user) return null;

  const snapshot = getGamificationSnapshot(user.totalXp || 0);
  const [achievementCount, recentXp] = await Promise.all([
    Achievement.countDocuments({ user: userId }),
    XpEvent.find({ user: userId }).sort({ earnedAt: -1 }).limit(10).lean(),
  ]);

  return {
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      picture: user.picture,
    },
    ...snapshot,
    achievementCount,
    recentXp,
  };
}

async function awardAndCheckLevel(userId, type, key, metadata = {}) {
  const result = await awardXp(userId, type, key, metadata);
  if (!result.awarded) return result;

  const beforeUser = await User.findById(userId).select("totalXp").lean();
  const snapshot = getGamificationSnapshot(beforeUser?.totalXp || 0);

  return { ...result, snapshot };
}

module.exports = { awardXp, awardAndCheckLevel, getGamification };
