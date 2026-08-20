const logger = require("../../config/logger");
const Achievement = require("./achievement.model");
const { checkAndAwardStreakAchievements } = require("./achievement.service");

exports.listAchievements = async (req, res) => {
  try {
    const achievements = await Achievement.find({ user: req.user.id }).sort({ earnedAt: -1 });
    res.status(200).json(achievements);
  } catch (err) {
    logger.error({ err }, "List achievements error");
    res.status(500).json({ message: "Failed to fetch achievements" });
  }
};

// Streak achievements are checked automatically after workout completion
// and daily tracking saves (see workoutController.js / trackingController.js).
// This is a manual fallback — handy for the frontend to call after
// onboarding, or just to refresh the badge list on demand.
exports.checkNow = async (req, res) => {
  try {
    const awarded = await checkAndAwardStreakAchievements(req.user.id);
    res.status(200).json({ awarded });
  } catch (err) {
    logger.error({ err }, "Check achievements error");
    res.status(500).json({ message: "Failed to check achievements" });
  }
};
