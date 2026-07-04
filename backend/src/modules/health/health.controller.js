const HealthProfile = require("./health.model");
const { generateCalorieProfile } = require("./health.service");

// Only these fields can ever come from the client. Anything else in
// req.body — including `user`, `bmr`, `targetCalories`, etc — is ignored.
// Without this, a client could overwrite ownership (`user`) or fake the
// calculated calorie/macro numbers directly, bypassing the real engine.
const ALLOWED_HEALTH_FIELDS = [
  "age", "gender", "height", "weight",
  "activityLevel", "goal", "dietType",
  "diseases", "allergies",
];

function pickAllowedFields(body = {}) {
  const result = {};
  for (const key of ALLOWED_HEALTH_FIELDS) {
    if (body[key] !== undefined) result[key] = body[key];
  }
  return result;
}

exports.createOrUpdateHealthProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const incoming = pickAllowedFields(req.body);

    // Merge with the existing profile so a partial update (e.g. only
    // `weight` changed) still has age/height/gender/etc available —
    // otherwise the calorie calculation below silently produces NaN.
    const existing = await HealthProfile.findOne({ user: userId }).lean();
    const merged = { ...existing, ...incoming };

    const calorieData = generateCalorieProfile(merged);

    const profile = await HealthProfile.findOneAndUpdate(
      { user: userId },
      { ...incoming, ...calorieData },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};

exports.getHealthProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile = await HealthProfile.findOne({ user: userId });

    if (!profile) {
      return res.status(404).json({ message: "Health profile not found" });
    }

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
};