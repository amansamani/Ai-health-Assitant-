const User = require("../models/User");

// GET PROFILE
const getProfile = async (req, res) => {
  res.json(req.user);
};

// UPDATE GOAL
const updateGoal = async (req, res) => {
  try {
    const { goal } = req.body;

    if (!["bulk", "lean", "fit"].includes(goal)) {
      return res.status(400).json({ message: "Invalid goal" });
    }

    req.user.goal = goal;
    await req.user.save();

    res.json({
      message: "Goal updated successfully",
      goal: req.user.goal,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getProfile, updateGoal };
