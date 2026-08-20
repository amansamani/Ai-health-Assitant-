const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const validate = require("../../middleware/validate");
const { addFriendSchema, createDuelSchema, respondDuelSchema } = require("../../validation/schemas");

const friendship = require("./friendship.controller");
const duel = require("./duel.controller");
const achievement = require("./achievement.controller");
const streak = require("./streak.controller");

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
router.post("/achievements/check", auth, achievement.checkNow);

// ── Streak Battles ───────────────────────────────────────────────────────────
router.get("/streaks/me", auth, streak.getMyStreaks);
router.get("/streaks/leaderboard", auth, streak.streakLeaderboard);
router.get("/streaks/compare/:friendId", auth, streak.compareStreaks);

module.exports = router;
