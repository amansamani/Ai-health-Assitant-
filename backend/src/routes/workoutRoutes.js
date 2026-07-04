const express = require("express");
const router = express.Router();

const { getWorkouts, markWorkoutComplete, getRecentCompletions } = require("../controllers/workoutController");
const auth = require("../middleware/authMiddleware");

// GET /api/workouts?goal=lean&mode=bodyweight
router.get("/", auth, getWorkouts);

// POST /api/workouts/complete  { workoutPlanId, date? }
router.post("/complete", auth, markWorkoutComplete);

// GET /api/workouts/completed?days=7
router.get("/completed", auth, getRecentCompletions);

module.exports = router;