const express = require("express");
const router = express.Router();

const { getWorkouts } = require("../controllers/workoutController");
const auth = require("../middleware/authMiddleware");

// GET /api/workouts?goal=lean&mode=bodyweight
router.get("/", auth, getWorkouts);

module.exports = router;
