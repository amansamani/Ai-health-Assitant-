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

  return {
    bmr: Math.round(bmr),
    maintenanceCalories: Math.round(maintenanceCalories),
    targetCalories: Math.round(targetCalories),
    ...macros
  };
}

module.exports = {
  generateCalorieProfile
};