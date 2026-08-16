const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725
};

function calculateBMR({ weight, height, age, gender }) {
  if (gender === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}

// (maintenanceCalories - bmr) is literally "the calories your stated
// activity level accounts for above resting metabolism" — it's already
// baked into the TDEE formula above. Active Burn (what a watch/phone
// actually measures — deliberate movement) is a *subset* of that: the rest
// is NEAT (fidgeting, posture, digestion) that no sensor attributes to a
// single "workout". We take a goal-weighted slice of it instead of using
// a flat number, so a sedentary desk worker and an already-active person
// don't get the same target.
function calculateActiveCalorieGoal({ bmr, maintenanceCalories, goal }) {
  const activityCalories = Math.max(maintenanceCalories - bmr, 0);

  const goalFactor =
    goal === "lose" ? 0.5   // extra push to burn, supports the deficit
    : goal === "gain" ? 0.35 // lighter push — don't eat into a bulk surplus
    : 0.45;                  // maintain

  const raw = activityCalories * goalFactor;
  // Clamp to a realistic ring-goal range — without this, a very sedentary
  // profile could compute to an unmotivating ~40 kcal, and a very active
  // one to an unreachable ~1500 kcal.
  return Math.round(Math.min(Math.max(raw, 150), 900));
}

function calculateMacros({ weight, targetCalories, goal }) {
  // Anchor protein first
  const proteinPerKg =
    goal === "lose" ? 2.0 :
    goal === "gain" ? 1.8 :
    1.6;

  const proteinGrams = weight * proteinPerKg;
  const proteinCalories = proteinGrams * 4;

  const remainingCalories = targetCalories - proteinCalories;

  // Split remaining between carbs and fats
  const fatCalories = remainingCalories * 0.3;
  const carbCalories = remainingCalories * 0.7;

  return {
    proteinTarget: Math.round(proteinGrams),
    carbTarget: Math.round(carbCalories / 4),
    fatTarget: Math.round(fatCalories / 9)
  };
}

function generateCalorieProfile(data) {
  const bmr = calculateBMR(data);

  const maintenanceCalories =
    bmr * ACTIVITY_MULTIPLIERS[data.activityLevel];

  let targetCalories = maintenanceCalories;

  if (data.goal === "lose") {
    targetCalories -= 400;
  } else if (data.goal === "gain") {
    targetCalories += 300;
  }

  const macros = calculateMacros({
    weight: data.weight,
    targetCalories,
    goal: data.goal
  });

  const activeCalorieGoal = calculateActiveCalorieGoal({
    bmr,
    maintenanceCalories,
    goal: data.goal
  });

  return {
    bmr: Math.round(bmr),
    maintenanceCalories: Math.round(maintenanceCalories),
    targetCalories: Math.round(targetCalories),
    activeCalorieGoal,
    ...macros
  };
}

module.exports = {
  generateCalorieProfile
};