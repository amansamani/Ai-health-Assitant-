const express = require("express");
const protect = require("../middleware/authMiddleware");
const { getWorkoutPlan } = require("../controllers/workoutController");

const router = express.Router();

router.get("/plan", protect, getWorkoutPlan);

module.exports = router;
