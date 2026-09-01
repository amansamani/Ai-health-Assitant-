"use strict";

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const VALID_GOALS = [
  "lose",
  "maintain",
  "gain",
];

const VALID_GENDERS = [
  "male",
  "female",
];

const VALID_ACTIVITY_LEVELS = Object.keys(
  ACTIVITY_MULTIPLIERS
);

const VALID_DIET_TYPES = [
  "veg",
  "non-veg",
  "vegan",
];

// Canonical calorie-engine constants. Keep all calorie calculations
// in this module so nutrition/workout features consume one source of truth.
const MIN_DAILY_CALORIES = {
  female: 1200,
  male: 1500,
};
const MAX_DAILY_CALORIES = 10000;
const GOAL_CALORIE_ADJUSTMENTS = {
  lose: -400,
  maintain: 0,
  gain: 300,
};

/**
 * Calculate BMR using the Mifflin-St Jeor equation.
 */
function calculateBMR({
  weight,
  height,
  age,
  gender,
}) {
  if (
    !Number.isFinite(weight) ||
    !Number.isFinite(height) ||
    !Number.isFinite(age)
  ) {
    throw new Error(
      "Weight, height and age must be valid numbers"
    );
  }

  if (!VALID_GENDERS.includes(gender)) {
    throw new Error(
      "Invalid gender"
    );
  }

  const bmr =
    gender === "male"
      ? 10 * weight +
        6.25 * height -
        5 * age +
        5
      : 10 * weight +
        6.25 * height -
        5 * age -
        161;

  if (
    !Number.isFinite(bmr) ||
    bmr <= 0
  ) {
    throw new Error(
      "Unable to calculate a valid BMR"
    );
  }

  return bmr;
}

/**
 * Calculate TDEE / maintenance calories.
 */
function calculateMaintenanceCalories({
  bmr,
  activityLevel,
}) {
  if (!Number.isFinite(bmr) || bmr <= 0) {
    throw new Error(
      "BMR must be a positive number"
    );
  }

  const multiplier =
    ACTIVITY_MULTIPLIERS[
      activityLevel
    ];

  if (!multiplier) {
    throw new Error(
      "Invalid activity level"
    );
  }

  return bmr * multiplier;
}

/**
 * Calculate the daily active-calorie goal.
 *
 * This is intentionally NOT the user's total calorie deficit.
 * It is a target for deliberate/activity calories.
 */
function calculateActiveCalorieGoal({
  bmr,
  maintenanceCalories,
  goal,
}) {
  if (
    !Number.isFinite(bmr) ||
    !Number.isFinite(
      maintenanceCalories
    )
  ) {
    throw new Error(
      "Invalid calorie values"
    );
  }

  if (!VALID_GOALS.includes(goal)) {
    throw new Error(
      "Invalid nutrition goal"
    );
  }

  const activityCalories = Math.max(
    maintenanceCalories - bmr,
    0
  );

  const goalFactor =
    goal === "lose"
      ? 0.5
      : goal === "gain"
        ? 0.35
        : 0.45;

  const raw =
    activityCalories * goalFactor;

  /*
   * Keep the activity target within a practical range.
   */
  return Math.round(
    Math.min(
      Math.max(raw, 150),
      900
    )
  );
}

/**
 * Calculate macro targets.
 */
function calculateMacros({
  weight,
  targetCalories,
  goal,
}) {
  if (
    !Number.isFinite(weight) ||
    weight <= 0
  ) {
    throw new Error(
      "Weight must be a positive number"
    );
  }

  if (
    !Number.isFinite(targetCalories) ||
    targetCalories <= 0
  ) {
    throw new Error(
      "Target calories must be positive"
    );
  }

  const proteinPerKg =
    goal === "lose"
      ? 2.0
      : goal === "gain"
        ? 1.8
        : 1.6;

  const proteinGrams =
    weight * proteinPerKg;

  const proteinCalories =
    proteinGrams * 4;

  /*
   * Ensure the protein target does not consume
   * more calories than the entire calorie budget.
   */
  const remainingCalories = Math.max(
    targetCalories -
      proteinCalories,
    0
  );

  const fatCalories =
    remainingCalories * 0.3;

  const carbCalories =
    remainingCalories * 0.7;

  return {
    proteinTarget: Math.round(
      proteinGrams
    ),

    carbTarget: Math.round(
      carbCalories / 4
    ),

    fatTarget: Math.round(
      fatCalories / 9
    ),
  };
}

/**
 * Generate the complete calorie/macro profile.
 */
function generateCalorieProfile(
  data
) {
  if (!data) {
    throw new Error(
      "Health profile data is required"
    );
  }

  const {
    weight,
    height,
    age,
    gender,
    activityLevel,
    goal,
    dietType,
  } = data;

  if (
    !Number.isFinite(Number(age)) ||
    !Number.isFinite(Number(height)) ||
    !Number.isFinite(Number(weight))
  ) {
    throw new Error(
      "Age, height and weight are required"
    );
  }

  if (
    !VALID_GENDERS.includes(
      gender
    )
  ) {
    throw new Error(
      "Invalid gender"
    );
  }

  if (
    !VALID_ACTIVITY_LEVELS.includes(
      activityLevel
    )
  ) {
    throw new Error(
      "Invalid activity level"
    );
  }

  if (
    !VALID_GOALS.includes(goal)
  ) {
    throw new Error(
      "Invalid nutrition goal"
    );
  }

  if (
    !VALID_DIET_TYPES.includes(
      dietType
    )
  ) {
    throw new Error(
      "Invalid diet type"
    );
  }

  const numericData = {
    age: Number(age),
    height: Number(height),
    weight: Number(weight),
    gender,
    activityLevel,
    goal,
    dietType,
  };

  const bmr =
    calculateBMR(numericData);

  const maintenanceCalories =
    calculateMaintenanceCalories({
      bmr,
      activityLevel,
    });

  /*
   * Keep the existing FitLip goal adjustments:
   *
   * lose      -> 400 kcal deficit
   * maintain  -> maintenance
   * gain      -> 300 kcal surplus
   */
  let targetCalories =
    maintenanceCalories +
    GOAL_CALORIE_ADJUSTMENTS[goal];

  /*
   * Never allow an accidental negative/near-zero
   * calorie target.
   */
  const minimumCalories =
    MIN_DAILY_CALORIES[
      numericData.gender
    ];

  targetCalories = Math.min(
    Math.max(
      targetCalories,
      minimumCalories
    ),
    MAX_DAILY_CALORIES
  );

  const macros =
    calculateMacros({
      weight: numericData.weight,
      targetCalories,
      goal,
    });

  const activeCalorieGoal =
    calculateActiveCalorieGoal({
      bmr,
      maintenanceCalories,
      goal,
    });

  return {
    bmr: Math.round(bmr),

    maintenanceCalories:
      Math.round(
        maintenanceCalories
      ),

    targetCalories:
      Math.round(targetCalories),

    activeCalorieGoal,

    ...macros,
  };
}

/**
 * Convert the application's User goal to the
 * HealthProfile nutrition goal.
 *
 * User model:
 *
 *   bulk -> gain
 *   lean -> lose
 *   fit  -> maintain
 */
function mapUserGoalToHealthGoal(
  userGoal
) {
  const mapping = {
    bulk: "gain",
    lean: "lose",
    fit: "maintain",
  };

  return mapping[userGoal] || null;
}

/**
 * Convert HealthProfile goal back to User goal.
 */
function mapHealthGoalToUserGoal(
  healthGoal
) {
  const mapping = {
    gain: "bulk",
    lose: "lean",
    maintain: "fit",
  };

  return mapping[healthGoal] || null;
}

module.exports = {
  ACTIVITY_MULTIPLIERS,
  MIN_DAILY_CALORIES,
  MAX_DAILY_CALORIES,
  GOAL_CALORIE_ADJUSTMENTS,
  calculateBMR,
  calculateMaintenanceCalories,
  calculateActiveCalorieGoal,
  calculateMacros,
  generateCalorieProfile,
  mapUserGoalToHealthGoal,
  mapHealthGoalToUserGoal,
};