const HealthProfile = require("./health.model");
const { generateCalorieProfile } = require("./health.service");

exports.createOrUpdateHealthProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const calorieData = generateCalorieProfile(req.body);

    const profile = await HealthProfile.findOneAndUpdate(
      { user: userId },
      { ...req.body, ...calorieData },
      { new: true, upsert: true }
    );

    res.status(200).json(profile);

  } catch (err) {
    next(err);
  }
};