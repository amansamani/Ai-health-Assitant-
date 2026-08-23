"use strict";

const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware");
const validate = require("../../middleware/validate");
const { runCreateSchema } = require("./run.validation");

const {
  createRun,
  getMyRuns,
  getRunById,
  getFeed,
  toggleLike,
  deleteRun,
} = require("./run.controller");

router.post("/", authMiddleware, validate(runCreateSchema), createRun);
router.get("/me", authMiddleware, getMyRuns);
router.get("/feed", authMiddleware, getFeed);
router.get("/:id", authMiddleware, getRunById);
router.post("/:id/like", authMiddleware, toggleLike);
router.delete("/:id", authMiddleware, deleteRun);

module.exports = router;
