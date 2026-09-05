"use strict";

const logger = require("../../config/logger");
const User = require("../../models/User");
const Friendship = require("./friendship.model");
const { getGamificationSnapshot } = require("./gamification.config");
const { getGamification } = require("./gamification.service");

exports.getMyGamification = async (req, res) => {
  try {
    const data = await getGamification(req.user.id);
    if (!data) return res.status(404).json({ message: "User not found" });
    return res.status(200).json(data);
  } catch (err) {
    logger.error({ err }, "Get gamification error");
    return res.status(500).json({ message: "Failed to fetch gamification" });
  }
};

exports.getFriendsLeaderboard = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(10, Number.parseInt(req.query.limit, 10) || 20));
    const friendships = await Friendship.find({ $or: [{ user1: req.user.id }, { user2: req.user.id }] }).lean();
    const ids = new Set([String(req.user.id)]);
    for (const friendship of friendships) {
      const other = String(friendship.user1) === String(req.user.id) ? friendship.user2 : friendship.user1;
      ids.add(String(other));
    }
    const users = await User.find({ _id: { $in: [...ids] } }).select("name username picture totalXp").lean();
    const rows = users.map((user) => ({
      user: { id: user._id, name: user.name, username: user.username, picture: user.picture },
      ...getGamificationSnapshot(user.totalXp || 0),
      isMe: String(user._id) === String(req.user.id),
    }));
    rows.sort((a, b) => b.totalXp - a.totalXp || b.level - a.level || a.user.name.localeCompare(b.user.name));
    const total = rows.length;
    const ranked = rows.map((row, index) => ({ ...row, position: index + 1 }));
    const items = ranked.slice((page - 1) * limit, page * limit);
    return res.status(200).json({ items, total, page, limit, hasMore: page * limit < total });
  } catch (err) {
    logger.error({ err }, "Gamification leaderboard error");
    return res.status(500).json({ message: "Failed to fetch leaderboard" });
  }
};
