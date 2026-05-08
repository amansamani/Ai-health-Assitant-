const User = require("../models/User");
const HealthProfile = require("../health/health.model");
// GET PROFILE
const getProfile = async (req, res) => {
  res.json(req.user);
};

// UPDATE GOAL
const updateGoal = async (req, res) => {
  try {
    const { goal } = req.body;
    const userId = req.user.id;
    if (!["bulk", "lean", "fit"].includes(goal)) {
      return res.status(400).json({ message: "Invalid goal" });
    }

    req.user.goal = goal;
    await req.user.save();
    
    await HealthProfile.findOneAndUpdate(
      { user: userId },
      { goal },
      { new: true }
    );

    

    res.json({
      message: "Goal updated successfully",
      goal: req.user.goal,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getProfile, updateGoal };
