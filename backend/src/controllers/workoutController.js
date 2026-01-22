const WorkoutPlan = require("../models/WorkoutPlan");

// GET WORKOUT FOR USER GOAL
const getWorkoutPlan = async (req, res) => {
  try {
    const goal = req.user.goal;

    const workouts = await WorkoutPlan.find({ goal });

    res.json({
      goal,
      workouts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getWorkoutPlan };
