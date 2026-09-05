const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const validate = require("../../middleware/validate");
const { addFriendSchema, createDuelSchema, respondDuelSchema } = require("../../validation/schemas");

const friendship = require("./friendship.controller");
const duel = require("./duel.controller");
const achievement = require("./achievement.controller");
const streak = require("./streak.controller");
const follow = require("./follow.controller");
const gamification = require("./gamification.controller");
const followActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  message: { message: "Too many follow actions. Please try again later." },
});

const followRequestResponseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  message: { message: "Too many follow-request actions. Please try again later." },
});

// ── Social profiles / follow ────────────────────────────────────────────────
router.get("/discover", auth, follow.discoverProfiles);
router.get("/profile/:identifier", auth, follow.getPublicProfile);
router.get("/profile/:userId/followers", auth, follow.listUserFollowers);
router.get("/profile/:userId/following", auth, follow.listUserFollowing);
router.post("/follow/:userId", auth, followActionLimiter, follow.followUser);
router.delete("/follow/:userId", auth, followActionLimiter, follow.unfollowUser);
router.get("/following", auth, follow.listFollowers);
router.get("/followers", auth, follow.listFollowing);
router.get("/follow-requests", auth, follow.listFollowRequests);
router.post("/follow-requests/:requestId/respond", auth, followRequestResponseLimiter, follow.respondFollowRequest);

// ── Friends ──────────────────────────────────────────────────────────────────
router.get("/friends/code", auth, friendship.getMyCode);
router.post("/friends", auth, validate(addFriendSchema), friendship.addFriend);
router.get("/friends", auth, friendship.listFriends);
router.get("/friends/search", auth, friendship.searchFriends);
router.delete("/friends/:friendId", auth, friendship.removeFriend);

// ── Duels ────────────────────────────────────────────────────────────────────
router.post("/duels", auth, validate(createDuelSchema), duel.createDuel);
router.get("/duels", auth, duel.listDuels);
router.get("/duels/:id", auth, duel.getDuel);
router.post("/duels/:id/respond", auth, validate(respondDuelSchema), duel.respondToDuel);
router.post("/duels/:id/cancel", auth, duel.cancelDuel);

// ── Achievements ─────────────────────────────────────────────────────────────
router.get("/achievements", auth, achievement.listAchievements);
router.get("/gamification/me", auth, gamification.getMyGamification);
router.get("/gamification/leaderboard", auth, gamification.getFriendsLeaderboard);

router.post("/achievements/check", auth, achievement.checkNow);

// ── Streak Battles ───────────────────────────────────────────────────────────
router.get("/streaks/me", auth, streak.getMyStreaks);
router.get("/streaks/leaderboard", auth, streak.streakLeaderboard);
router.get("/streaks/compare/:friendId", auth, streak.compareStreaks);

module.exports = router;
