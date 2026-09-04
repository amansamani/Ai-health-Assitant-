"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware");
const validate = require("../../middleware/validate");
const { runCreateSchema } = require("./run.validation");
const runCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  message: { message: "Too many activity saves. Please try again later." },
});

const likeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id?.toString() || req.ip,
  message: { message: "Too many like actions. Please slow down." },
});

const {
  createRun,
  getMyRuns,
  getUserRuns,
  getRunById,
  getFeed,
  toggleLike,
  deleteRun,
} = require("./run.controller");

router.post("/", authMiddleware, runCreateLimiter, validate(runCreateSchema), createRun);
router.get("/me", authMiddleware, getMyRuns);
router.get("/feed", authMiddleware, getFeed);
router.get("/user/:userId", authMiddleware, getUserRuns);
router.get("/:id", authMiddleware, getRunById);
router.post("/:id/like", authMiddleware, likeLimiter, toggleLike);
router.delete("/:id", authMiddleware, deleteRun);

module.exports = router;
