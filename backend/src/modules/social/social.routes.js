const express = require("express");
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

// ── Social profiles / follow ────────────────────────────────────────────────
router.get("/discover", auth, follow.discoverProfiles);
router.get("/profile/:identifier", auth, follow.getPublicProfile);
router.post("/follow/:userId", auth, follow.followUser);
router.delete("/follow/:userId", auth, follow.unfollowUser);
router.get("/following", auth, follow.listFollowers);
router.get("/followers", auth, follow.listFollowing);
router.get("/follow-requests", auth, follow.listFollowRequests);
router.post("/follow-requests/:requestId/respond", auth, follow.respondFollowRequest);

// ── Friends ──────────────────────────────────────────────────────────────────
router.get("/friends/code", auth, friendship.getMyCode);
router.post("/friends", auth, validate(addFriendSchema), friendship.addFriend);
router.get("/friends", auth, friendship.listFriends);
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
