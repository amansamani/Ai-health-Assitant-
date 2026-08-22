const express = require("express");
const router = express.Router();

const {
  getWorkouts,
  getWorkoutProgress,
  confirmExercises,
  markExerciseComplete,
  retryWorkout,
  markWorkoutComplete,
  getRecentCompletions,
} = require("../controllers/workoutController");
const auth = require("../middleware/authMiddleware");

// GET /api/workouts?goal=lean&mode=bodyweight
router.get("/", auth, getWorkouts);

// GET /api/workouts/progress?workoutPlanId=...&planType=standard|custom&dayOfWeek=1..7
router.get("/progress", auth, getWorkoutProgress);

// POST /api/workouts/exercises-confirm (supports standard/custom plans)
router.post("/exercises-confirm", auth, confirmExercises);

// Legacy single-exercise endpoint for older mobile builds.
router.post("/exercise-complete", auth, markExerciseComplete);

// POST /api/workouts/retry (supports standard/custom plans)
router.post("/retry", auth, retryWorkout);

// Legacy endpoint for older clients.
router.post("/complete", auth, markWorkoutComplete);

// GET /api/workouts/completed?days=7
router.get("/completed", auth, getRecentCompletions);

module.exports = router;
