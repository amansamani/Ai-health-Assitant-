const WorkoutPlan = require("../models/WorkoutPlan");

exports.getWorkouts = async (req, res) => {
  try {
    const { goal, mode } = req.query;

    if (!goal || !mode) {
      return res
        .status(400)
        .json({ message: "goal and mode are required" });
    }

    const workouts = await WorkoutPlan.find({ goal, mode })
      .sort({ day: 1 });
  

    res.status(200).json(workouts);
  } catch (err) {
    console.error("Get workouts error:", err);
    res.status(500).json({ message: "Failed to fetch workouts" });
  }
  
};

