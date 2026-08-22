"use strict";

const DietProgress = require("./dietProgress.model");
const FoodTemplate = require("./foodTemplate.model");
const HealthProfile = require("../health/health.model");
const DietPlan = require("./dietPlan.model");
const WeeklyInsight = require("./weeklyInsight.model");
const User = require("../../models/User");

const {
  generateAiMealPlan,
} = require("../../services/ai.service");

const {
  sendPushNotification,
} = require("../../utils/pushNotification");

const logger = require("../../config/logger");
const {
  generateCalorieProfile,
  calculateMacros,
  MIN_DAILY_CALORIES,
  MAX_DAILY_CALORIES,
} = require("../health/health.service");

// ─────────────────────────────────────────────────────────────────────────────
// GOAL NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

const GOAL_MAP = {
  lean: "lose",
  cut: "lose",
  lose: "lose",

  bulk: "gain",
  gain: "gain",

  fit: "maintain",
  maintain: "maintain",
};

function normalizeGoal(goal) {
  const normalized = String(
    goal || ""
  )
    .trim()
    .toLowerCase();

  return (
    GOAL_MAP[normalized] ||
    "maintain"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BASIC NORMALIZATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeDietType(
  dietType
) {
  const value = String(
    dietType || ""
  )
    .trim()
    .toLowerCase();

  if (
    value === "vegan"
  ) {
    return "vegan";
  }

  if (
    value === "nonveg" ||
    value === "non-veg" ||
    value === "non vegetarian" ||
    value === "non-vegetarian"
  ) {
    return "non-veg";
  }

  if (
    value === "eggetarian"
  ) {
    return "eggetarian";
  }

  return "veg";
}

function normalizeGender(
  gender
) {
  const value = String(
    gender || ""
  )
    .trim()
    .toLowerCase();

  if (
    value === "female" ||
    value === "f"
  ) {
    return "female";
  }

  if (
    value === "male" ||
    value === "m"
  ) {
    return "male";
  }

  return "male";
}

function normalizeActivityLevel(
  activityLevel
) {
  const value = String(
    activityLevel || ""
  )
    .trim()
    .toLowerCase();

  const aliases = {
    sedentary: "sedentary",

    light: "light",
    lightly_active: "light",
    "lightly active": "light",

    moderate: "moderate",
    moderately_active: "moderate",
    "moderately active": "moderate",

    active: "active",
    very_active: "active",
    "very active": "active",
  };

  return (
    aliases[value] ||
    "light"
  );
}

function toFiniteNumber(
  value,
  fallback = null
) {
  const number = Number(
    value
  );

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

function normalizeArray(
  value
) {
  return Array.isArray(
    value
  )
    ? value
        .filter(
          (item) =>
            item !==
              null &&
            item !==
              undefined
        )
        .map(
          (item) =>
            String(
              item
            ).trim()
        )
        .filter(Boolean)
    : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE
// ─────────────────────────────────────────────────────────────────────────────

let _templateCache =
  null;

async function getTemplate() {
  if (
    Array.isArray(
      _templateCache
    ) &&
    _templateCache.length
  ) {
    return _templateCache;
  }

  const docs =
    await FoodTemplate.find()
      .select(
        "id mealType name dietType goal cuisine difficulty prepTime budget mealScore items macroRange tags"
      )
      .lean();

  if (
    !docs?.length
  ) {
    throw new Error(
      "Food template not found. Please seed the foodtemplate collection."
    );
  }

  _templateCache =
    docs;

  logger.info(
    {
      count:
        _templateCache.length,
    },
    "Food template cache warmed"
  );

  return _templateCache;
}

async function warmTemplateCache() {
  await getTemplate();
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

const CALORIE_SPLIT = {
  breakfast: 0.28,
  lunch: 0.37,
  dinner: 0.28,
  snack: 0.07,
};

const DAILY_CALORIE_TOLERANCE = 75;

const WEEK_DAYS = 7;

const MIN_WEEKLY_LOGS = 4;

// ─────────────────────────────────────────────────────────────────────────────
// BMR / TDEE
// Mifflin-St Jeor equation
// ─────────────────────────────────────────────────────────────────────────────

function computeTargetCalories(
  profile
) {
  if (!profile) {
    throw new Error(
      "Profile is required."
    );
  }

  /*
   * HealthProfile.targetCalories is the persisted canonical value.
   * This matters for adaptive weekly adjustments: once the health
   * profile is adjusted, diet generation must use that exact target.
   */
  const persistedTarget = toFiniteNumber(
    profile.targetCalories
  );

  if (
    persistedTarget !== null &&
    persistedTarget > 0
  ) {
    return Math.min(
      Math.max(
        Math.round(persistedTarget),
        MIN_DAILY_CALORIES[
          normalizeGender(profile.gender)
        ]
      ),
      MAX_DAILY_CALORIES
    );
  }

  /*
   * No persisted target exists (for example, legacy data).
   * Delegate the calculation to the canonical health engine.
   */
  return generateCalorieProfile({
    ...profile,
    goal: normalizeGoal(profile.goal),
    gender: normalizeGender(profile.gender),
    activityLevel: normalizeActivityLevel(
      profile.activityLevel
    ),
    dietType: normalizeDietType(
      profile.dietType
    ),
  }).targetCalories;
}

// ─────────────────────────────────────────────────────────────────────────────
// MACRO TARGETS
// ─────────────────────────────────────────────────────────────────────────────

function computeMacroTargets(
  profile,
  targetCalories
) {
  if (!profile) {
    throw new Error(
      "Profile is required for macro calculation."
    );
  }

  const calories = toFiniteNumber(targetCalories);

  if (calories === null || calories <= 0) {
    throw new Error(
      "Target calories must be a positive number."
    );
  }

  const weight = toFiniteNumber(
    profile.weightKg ?? profile.weight
  );

  if (weight === null || weight <= 0) {
    throw new Error(
      "Weight must be greater than zero."
    );
  }

  /*
   * Macro calculation is also delegated to the canonical health engine.
   * This prevents nutrition from silently using different protein/carb/fat
   * rules than the HealthProfile values shown elsewhere in the app.
   */
  const result = calculateMacros({
    weight,
    targetCalories: calories,
    goal: normalizeGoal(profile.goal),
  });

  return {
    proteinG: result.proteinTarget,
    carbsG: result.carbTarget,
    fatsG: result.fatTarget,
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getEligibleMeals(
  allMeals,
  mealType,
  goal,
  dietType
) {
  const normalizedGoal =
    normalizeGoal(
      goal
    );

  const normalizedDiet =
    normalizeDietType(
      dietType
    );

  let eligibleDietTypes;

  if (
    normalizedDiet ===
    "non-veg"
  ) {
    eligibleDietTypes = [
      "veg",
      "eggetarian",
      "non-veg",
    ];
  } else if (
    normalizedDiet ===
    "eggetarian"
  ) {
    eligibleDietTypes = [
      "veg",
      "eggetarian",
    ];
  } else if (
    normalizedDiet ===
    "vegan"
  ) {
    /*
     * Your FoodTemplate data must contain vegan records for
     * this to work correctly.
     *
     * We intentionally do NOT silently include vegetarian meals
     * because a vegetarian meal can contain dairy/eggs.
     */
    eligibleDietTypes = [
      "vegan",
    ];
  } else {
    eligibleDietTypes = [
      "veg",
    ];
  }

  return allMeals.filter(
    (meal) => {
      if (
        meal.mealType !==
        mealType
      ) {
        return false;
      }

      const mealGoals =
        Array.isArray(
          meal.goal
        )
          ? meal.goal
          : [];

      const normalizedMealGoals =
        mealGoals.map(
          (item) =>
            normalizeGoal(
              item
            )
        );

      if (
        !normalizedMealGoals.includes(
          normalizedGoal
        )
      ) {
        return false;
      }

      return eligibleDietTypes.includes(
        normalizeDietType(
          meal.dietType
        )
      );
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEAL SCORING
// ─────────────────────────────────────────────────────────────────────────────

function scoreMeal(
  meal,
  goal,
  targetMealCals
) {
  const scoreData =
    meal?.mealScore;

  const macroRange =
    meal?.macroRange;

  if (
    !scoreData ||
    !macroRange
  ) {
    return 0;
  }

  const calorieRange =
    Array.isArray(
      macroRange.calories
    )
      ? macroRange.calories
      : null;

  if (
    !calorieRange ||
    calorieRange.length <
      2
  ) {
    return 0;
  }

  const minCal =
    Number(
      calorieRange[0]
    );

  const maxCal =
    Number(
      calorieRange[1]
    );

  if (
    !Number.isFinite(
      minCal
    ) ||
    !Number.isFinite(
      maxCal
    ) ||
    minCal < 0 ||
    maxCal < minCal
  ) {
    return 0;
  }

  /*
   * FIX:
   *
   * Previously getTemplateMealSwaps() called:
   *
   * scoreMeal(m, goal)
   *
   * without targetMealCals.
   *
   * Comparisons with undefined caused calorieFit to become
   * meaningless.
   *
   * We now gracefully fall back to the midpoint if a caller
   * doesn't provide a target.
   */
  const fallbackTarget =
    (minCal +
      maxCal) /
    2;

  const target =
    Number.isFinite(
      Number(
        targetMealCals
      )
    )
      ? Number(
          targetMealCals
        )
      : fallbackTarget;

  let calorieFit;

  if (
    target >= minCal &&
    target <= maxCal
  ) {
    calorieFit = 1.5;
  } else if (
    target < minCal
  ) {
    calorieFit =
      Math.max(
        0.2,
        target /
          Math.max(
            minCal,
            1
          )
      );
  } else {
    calorieFit =
      Math.max(
        0.2,
        maxCal /
          Math.max(
            target,
            1
          )
      );
  }

  const realism =
    toFiniteNumber(
      scoreData.realism,
      0
    );

  const satiety =
    toFiniteNumber(
      scoreData.satiety,
      0
    );

  const goalFit =
    toFiniteNumber(
      scoreData.goalFit,
      0
    );

  const proteinQuality =
    toFiniteNumber(
      scoreData.proteinQuality,
      0
    );

  let score =
    realism * 1.0 +
    satiety * 1.5 +
    goalFit * 2.5 +
    proteinQuality * 1.5 +
    calorieFit * 3.0;

  /*
   * Small randomness prevents identical plans every time,
   * while preserving score ranking.
   */
  score *=
    0.85 +
    Math.random() *
      0.20;

  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// PICK MEAL
// ─────────────────────────────────────────────────────────────────────────────

function pickMeal(
  allMeals,
  mealType,
  goal,
  dietType,
  usedMealIds,
  targetMealCals
) {
  let candidates =
    getEligibleMeals(
      allMeals,
      mealType,
      goal,
      dietType
    ).filter(
      (meal) =>
        !usedMealIds.has(
          meal.id
        )
    );

  /*
   * If every eligible meal has already been used, allow reuse.
   */
  if (
    !candidates.length
  ) {
    candidates =
      getEligibleMeals(
        allMeals,
        mealType,
        goal,
        dietType
      );
  }

  /*
   * Emergency fallback:
   * ignore goal but continue respecting diet.
   */
  if (
    !candidates.length
  ) {
    const normalizedDiet =
      normalizeDietType(
        dietType
      );

    let dietTypes;

    if (
      normalizedDiet ===
      "non-veg"
    ) {
      dietTypes = [
        "veg",
        "eggetarian",
        "non-veg",
      ];
    } else if (
      normalizedDiet ===
      "eggetarian"
    ) {
      dietTypes = [
        "veg",
        "eggetarian",
      ];
    } else if (
      normalizedDiet ===
      "vegan"
    ) {
      dietTypes = [
        "vegan",
      ];
    } else {
      dietTypes = [
        "veg",
      ];
    }

    candidates =
      allMeals.filter(
        (meal) =>
          meal.mealType ===
            mealType &&
          dietTypes.includes(
            normalizeDietType(
              meal.dietType
            )
          )
      );
  }

  /*
   * Final fallback:
   * if no compatible food exists, use the meal type.
   *
   * This should be rare. The caller can still detect an incomplete
   * result.
   */
  if (
    !candidates.length
  ) {
    candidates =
      allMeals.filter(
        (meal) =>
          meal.mealType ===
          mealType
      );
  }

  if (
    !candidates.length
  ) {
    return null;
  }

  return candidates
    .map(
      (meal) => ({
        meal,
        score: scoreMeal(
          meal,
          goal,
          targetMealCals
        ),
      })
    )
    .sort(
      (a, b) =>
        b.score -
        a.score
    )[0].meal;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCALE TEMPLATE MEAL
// ─────────────────────────────────────────────────────────────────────────────

function scaleMealToCalories(
  templateMeal,
  targetMealCals
) {
  if (
    !templateMeal
  ) {
    throw new Error(
      "Template meal is required."
    );
  }

  const macroRange =
    templateMeal.macroRange;

  if (
    !macroRange
  ) {
    throw new Error(
      `Template meal "${templateMeal.name}" has no macro range.`
    );
  }

  const calorieRange =
    Array.isArray(
      macroRange.calories
    )
      ? macroRange.calories
      : null;

  if (
    !calorieRange ||
    calorieRange.length <
      2
  ) {
    throw new Error(
      `Template meal "${templateMeal.name}" has an invalid calorie range.`
    );
  }

  const minCals =
    Number(
      calorieRange[0]
    );

  const maxCals =
    Number(
      calorieRange[1]
    );

  const target =
    Number(
      targetMealCals
    );

  if (
    !Number.isFinite(
      target
    ) ||
    target <= 0
  ) {
    throw new Error(
      "Target meal calories must be positive."
    );
  }

  /*
   * If the target is outside the template range, we clamp the
   * interpolation factor, but we do not pretend the template
   * can perfectly represent an arbitrary calorie target.
   */
  const rawScale =
    maxCals === minCals
      ? 0.5
      : (target -
          minCals) /
        (maxCals -
          minCals);

  const scale =
    Math.max(
      0,
      Math.min(
        1,
        rawScale
      )
    );

  const lerp = (
    range,
    fallback = 0
  ) => {
    if (
      !Array.isArray(
        range
      ) ||
      range.length <
        2
    ) {
      return fallback;
    }

    const min =
      Number(
        range[0]
      );

    const max =
      Number(
        range[1]
      );

    if (
      !Number.isFinite(
        min
      ) ||
      !Number.isFinite(
        max
      )
    ) {
      return fallback;
    }

    return Math.round(
      min +
        scale *
          (max -
            min)
    );
  };

  const sourceItems =
    Array.isArray(
      templateMeal.items
    )
      ? templateMeal.items
      : [];

  const items =
    sourceItems.map(
      (item) => {
        const minAmount =
          toFiniteNumber(
            item.minAmount,
            0
          );

        const maxAmount =
          toFiniteNumber(
            item.maxAmount,
            minAmount
          );

        let amount;

        if (
          item.scalable
        ) {
          amount =
            Math.round(
              minAmount +
                scale *
                  (maxAmount -
                    minAmount)
            );
        } else {
          amount =
            Math.round(
              minAmount
            );
        }

        return {
          name:
            String(
              item.name ||
                ""
            ).trim(),

          amount:
            Math.max(
              amount,
              0
            ),

          unit:
            String(
              item.unit ||
                "g"
            ).trim(),
        };
      }
    );

  return {
    templateId:
      templateMeal.id,

    mealName:
      templateMeal.name,

    cuisine:
      templateMeal.cuisine,

    difficulty:
      templateMeal.difficulty,

    prepTime:
      templateMeal.prepTime,

    budget:
      templateMeal.budget,

    tags:
      Array.isArray(
        templateMeal.tags
      )
        ? templateMeal.tags
        : [],

    items,

    calories:
      lerp(
        macroRange.calories
      ),

    protein:
      lerp(
        macroRange.protein
      ),

    carbs:
      lerp(
        macroRange.carbs
      ),

    fats:
      lerp(
        macroRange.fats
      ),

    fiber:
      lerp(
        macroRange.fiber
      ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE-BASED PLAN
// ─────────────────────────────────────────────────────────────────────────────

async function generateTemplateMeals(
  profile,
  targetCalories
) {
  const goal =
    normalizeGoal(
      profile.goal
    );

  const dietType =
    normalizeDietType(
      profile.dietType
    );

  const allMeals =
    await getTemplate();

  const usedMealIds =
    new Set();

  const meals = {};

  for (
    const mealType of MEAL_TYPES
  ) {
    const calBudget =
      Math.round(
        targetCalories *
          CALORIE_SPLIT[
            mealType
          ]
      );

    const chosenCombo =
      pickMeal(
        allMeals,
        mealType,
        goal,
        dietType,
        usedMealIds,
        calBudget
      );

    if (
      !chosenCombo
    ) {
      throw new Error(
        `No compatible ${mealType} food template found for diet type "${dietType}".`
      );
    }

    if (
      chosenCombo.id
    ) {
      usedMealIds.add(
        chosenCombo.id
      );
    }

    const scaled =
      scaleMealToCalories(
        chosenCombo,
        calBudget
      );

    /*
     * Template calorie values come from the template's macro range.
     *
     * If the resulting meal is outside the tolerance, don't silently
     * rewrite it into fake nutrition values. Instead, report the
     * discrepancy so the caller can reject or replace the meal.
     */
    if (
      Math.abs(
        scaled.calories -
          calBudget
      ) >
      75
    ) {
      logger.warn(
        {
          mealType,
          meal:
            scaled.mealName,
          target:
            calBudget,
          generated:
            scaled.calories,
        },
        "Template meal is outside calorie tolerance"
      );
    }

    meals[
      mealType
    ] = [
      scaled,
    ];
  }

  return {
    meals,

    aiAdvice:
      null,

    warnings:
      [],

    source:
      "template",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AI-BASED PLAN
// ─────────────────────────────────────────────────────────────────────────────

async function generateAiMeals(
  profile,
  targetCalories,
  macros
) {
  logger.info(
    {
      conditionCount:
        Array.isArray(
          profile.diseases
        )
          ? profile
              .diseases
              .length
          : 0,

      allergyCount:
        Array.isArray(
          profile.allergies
        )
          ? profile
              .allergies
              .length
          : 0,
    },

    "Generating personalized meal plan"
  );

  const aiResult =
    await generateAiMealPlan(
      profile,
      targetCalories,
      macros
    );

  if (
    !aiResult
  ) {
    throw new Error(
      "AI meal generator returned no result."
    );
  }

  const meals = {};

  for (
    const mealType of MEAL_TYPES
  ) {
    const sourceMeals =
      Array.isArray(
        aiResult[
          mealType
        ]
      )
        ? aiResult[
            mealType
          ]
        : [];

    if (
      sourceMeals.length !==
      1
    ) {
      throw new Error(
        `AI must return exactly one ${mealType} meal.`
      );
    }

    meals[
      mealType
    ] =
      sourceMeals.map(
        (meal) => ({
          templateId:
            null,

          mealName:
            meal.mealName,

          cuisine:
            "Indian",

          difficulty:
            "easy",

          prepTime:
            null,

          budget:
            null,

          tags:
            Array.isArray(
              meal.tags
            )
              ? meal.tags
              : [],

          items:
            meal.items,

          calories:
            meal.calories,

          protein:
            meal.protein,

          carbs:
            meal.carbs,

          fats:
            meal.fats,

          fiber:
            meal.fiber ||
            0,
        })
      );
  }

  return {
    meals,

    aiAdvice:
      aiResult.aiAdvice ||
      null,

    warnings:
      Array.isArray(
        aiResult.warnings
      )
        ? aiResult.warnings
        : [],

    source:
      "ai",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function validateGeneratedMeals(
  meals,
  targetCalories
) {
  if (
    !meals ||
    typeof meals !==
      "object"
  ) {
    throw new Error(
      "Generated meal plan is empty."
    );
  }

  let totalCalories =
    0;

  for (
    const mealType of MEAL_TYPES
  ) {
    const mealArray =
      meals[
        mealType
      ];

    if (
      !Array.isArray(
        mealArray
      ) ||
      mealArray.length !==
        1
    ) {
      throw new Error(
        `Generated plan must contain exactly one ${mealType} meal.`
      );
    }

    const meal =
      mealArray[0];

    const calories =
      Number(
        meal.calories
      );

    if (
      !Number.isFinite(
        calories
      ) ||
      calories <= 0
    ) {
      throw new Error(
        `Invalid calories for ${mealType}.`
      );
    }

    const mealTarget =
      Math.round(
        targetCalories *
          CALORIE_SPLIT[
            mealType
          ]
      );

    /*
     * Individual meal tolerance is deliberately generous enough
     * for template ranges but strict enough to catch major errors.
     */
    if (
      Math.abs(
        calories -
          mealTarget
      ) >
      100
    ) {
      throw new Error(
        `${mealType} meal is too far from its calorie target. Expected approximately ${mealTarget} kcal but received ${Math.round(
          calories
        )} kcal.`
      );
    }

    totalCalories +=
      calories;

    if (
      !Array.isArray(
        meal.items
      ) ||
      meal.items.length ===
        0
    ) {
      throw new Error(
        `${mealType} contains no food items.`
      );
    }

    for (
      const item of meal.items
    ) {
      const amount =
        Number(
          item.amount
        );

      if (
        !item.name ||
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        throw new Error(
          `Invalid food item in ${mealType}.`
        );
      }
    }
  }

  if (
    Math.abs(
      totalCalories -
        targetCalories
    ) >
    DAILY_CALORIE_TOLERANCE
  ) {
    throw new Error(
      `Generated plan calories are outside the daily target. Target: ${Math.round(
        targetCalories
      )}, generated: ${Math.round(
        totalCalories
      )}.`
    );
  }

  return Math.round(
    totalCalories
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildSummary(
  meals,
  targetCalories,
  macros,
  profile,
  meta
) {
  let totalCals =
    0;

  let totalProtein =
    0;

  let totalCarbs =
    0;

  let totalFats =
    0;

  let totalFiber =
    0;

  for (
    const mealType of MEAL_TYPES
  ) {
    const mealArr =
      Array.isArray(
        meals[
          mealType
        ]
      )
        ? meals[
            mealType
          ]
        : [];

    for (
      const combo of mealArr
    ) {
      totalCals +=
        toFiniteNumber(
          combo.calories,
          0
        );

      totalProtein +=
        toFiniteNumber(
          combo.protein,
          0
        );

      totalCarbs +=
        toFiniteNumber(
          combo.carbs,
          0
        );

      totalFats +=
        toFiniteNumber(
          combo.fats,
          0
        );

      totalFiber +=
        toFiniteNumber(
          combo.fiber,
          0
        );
    }
  }

  const normalizedGoal =
    normalizeGoal(
      profile.goal
    );

  const normalizedDiet =
    normalizeDietType(
      profile.dietType
    );

  const profileWeight =
    toFiniteNumber(
      profile.weightKg ??
        profile.weight
    );

  return {
    targetCalories:
      Math.round(
        targetCalories
      ),

    plannedCalories:
      Math.round(
        totalCals
      ),

    calorieDifference:
      Math.round(
        totalCals -
          targetCalories
      ),

    macroTargets: {
      proteinG:
        Math.round(
          macros.proteinG
        ),

      carbsG:
        Math.round(
          macros.carbsG
        ),

      fatsG:
        Math.round(
          macros.fatsG
        ),
    },

    actualMacros: {
      proteinG:
        +totalProtein.toFixed(
          1
        ),

      carbsG:
        +totalCarbs.toFixed(
          1
        ),

      fatsG:
        +totalFats.toFixed(
          1
        ),

      fiberG:
        +totalFiber.toFixed(
          1
        ),
    },

    macroAchievement: {
      protein:
        macros.proteinG
          ? +(
              (totalProtein /
                macros.proteinG) *
              100
            ).toFixed(1)
          : null,

      carbs:
        macros.carbsG
          ? +(
              (totalCarbs /
                macros.carbsG) *
              100
            ).toFixed(1)
          : null,

      fats:
        macros.fatsG
          ? +(
              (totalFats /
                macros.fatsG) *
              100
            ).toFixed(1)
          : null,
    },

    generatedAt:
      new Date().toISOString(),

    source:
      meta.source,

    aiAdvice:
      meta.aiAdvice ||
      null,

    warnings:
      Array.isArray(
        meta.warnings
      )
        ? meta.warnings
        : [],

    profileSnapshot: {
      goal:
        normalizedGoal,

      dietType:
        normalizedDiet,

      weightKg:
        profileWeight,

      activityLevel:
        normalizeActivityLevel(
          profile.activityLevel
        ),

      diseases:
        normalizeArray(
          profile.diseases
        ),

      allergies:
        normalizeArray(
          profile.allergies
        ),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: GENERATE DIET PLAN
// ─────────────────────────────────────────────────────────────────────────────

async function generateDietPlan(
  profile
) {
  if (!profile) {
    throw new Error(
      "Health profile is required."
    );
  }

  /*
   * Normalize before BOTH calorie and macro calculations.
   */
  const normalizedProfile =
    {
      ...profile,

      goal:
        normalizeGoal(
          profile.goal
        ),

      dietType:
        normalizeDietType(
          profile.dietType
        ),

      gender:
        normalizeGender(
          profile.gender
        ),

      activityLevel:
        normalizeActivityLevel(
          profile.activityLevel
        ),

      diseases:
        normalizeArray(
          profile.diseases
        ),

      allergies:
        normalizeArray(
          profile.allergies
        ),
    };

  const targetCalories =
    computeTargetCalories(
      normalizedProfile
    );

  const macros =
    computeMacroTargets(
      normalizedProfile,
      targetCalories
    );

  const hasConditions =
    normalizedProfile
      .diseases.length >
      0 ||
    normalizedProfile
      .allergies.length >
      0;

  let result;

  /*
   * AI is preferred when medical conditions or allergies are
   * present, but failure falls back to template generation.
   */
  if (
    hasConditions &&
    process.env
      .GEMINI_API_KEY
  ) {
    try {
      result =
        await generateAiMeals(
          normalizedProfile,
          targetCalories,
          macros
        );

      /*
       * AI already has its own safety validation, but we still
       * validate the final shape here because this service is the
       * boundary before persistence.
       */
      validateGeneratedMeals(
        result.meals,
        targetCalories
      );
    } catch (err) {
      logger.error(
        {
          err,
          userId:
            normalizedProfile.user,
        },
        "AI meal generation failed, falling back to templates"
      );

      result =
        await generateTemplateMeals(
          normalizedProfile,
          targetCalories
        );

      result.warnings = [
        ...(Array.isArray(
          result.warnings
        )
          ? result.warnings
          : []),

        "AI meal generation failed. Showing standard plan.",
      ];
    }
  } else {
    result =
      await generateTemplateMeals(
        normalizedProfile,
        targetCalories
      );
  }

  /*
   * Final common validation for BOTH AI and template plans.
   */
  validateGeneratedMeals(
    result.meals,
    targetCalories
  );

  const summary =
    buildSummary(
      result.meals,
      targetCalories,
      macros,
      normalizedProfile,
      result
    );

  return {
    meals:
      result.meals,

    summary,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SWAP OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function getTemplateMealSwaps(
  mealType,
  goal,
  dietType,
  excludeId,
  targetMealCals = null
) {
  const allMeals =
    await getTemplate();

  const normalizedGoal =
    normalizeGoal(
      goal
    );

  const normalizedDiet =
    normalizeDietType(
      dietType
    );

  const eligible =
    getEligibleMeals(
      allMeals,
      mealType,
      normalizedGoal,
      normalizedDiet
    );

  return eligible
    .filter(
      (meal) =>
        String(
          meal.id
        ) !==
        String(
          excludeId
        )
    )
    .map(
      (meal) => ({
        ...meal,

        _score:
          scoreMeal(
            meal,
            normalizedGoal,
            targetMealCals
          ),
      })
    )
    .sort(
      (a, b) =>
        b._score -
        a._score
    )
    .slice(0, 6)
    .map(
      ({
        _score,
        ...meal
      }) => meal
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getDateKey(
  date
) {
  return date
    .toISOString()
    .split("T")[0];
}

function getLast7DateKeys() {
  const today =
    new Date();

  const dates = [];

  for (
    let i = 0;
    i < WEEK_DAYS;
    i += 1
  ) {
    const date =
      new Date(
        today
      );

    date.setDate(
      today.getDate() -
        i
    );

    dates.push(
      getDateKey(
        date
      )
    );
  }

  return dates;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

async function evaluateWeeklyProgress(
  userId
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const last7Days =
    getLast7DateKeys();

  const logs =
    await DietProgress.find(
      {
        user: userId,

        date: {
          $in:
            last7Days,
        },
      }
    )
      .sort({
        date: 1,
      })
      .lean();

  if (
    logs.length <
    MIN_WEEKLY_LOGS
  ) {
    return {
      adjust: false,

      reason:
        `Not enough data (need ≥ ${MIN_WEEKLY_LOGS} days)`,
    };
  }

  let completedDays =
    0;

  let totalCalories =
    0;

  const weights =
    [];

  for (
    const log of logs
  ) {
    const mealsDone =
      Object.values(
        log.mealsCompleted ||
          {}
      ).filter(
        Boolean
      ).length;

    if (
      mealsDone >= 3
    ) {
      completedDays +=
        1;
    }

    totalCalories +=
      toFiniteNumber(
        log.caloriesConsumed,
        0
      );

    const weight =
      toFiniteNumber(
        log.weight
      );

    if (
      weight !== null &&
      weight > 0
    ) {
      weights.push({
        date:
          log.date,

        weight,
      });
    }
  }

  if (
    weights.length <
    2
  ) {
    return {
      adjust: false,

      reason:
        "Not enough weight data",
    };
  }

  /*
   * IMPORTANT FIX:
   *
   * MongoDB $in does not guarantee chronological ordering.
   *
   * The old code used:
   *
   * weights[weights.length - 1] - weights[0]
   *
   * without sorting.
   *
   * That could calculate weight change backwards.
   *
   * We explicitly sort by date above.
   */

  const firstWeight =
    weights[0].weight;

  const latestWeight =
    weights[
      weights.length - 1
    ].weight;

  const weightChange =
    latestWeight -
    firstWeight;

  /*
   * IMPORTANT FIX:
   *
   * If only 4 logs exist, dividing by 7 makes perfect adherence
   * appear to be 57%.
   *
   * We measure adherence across the actual available logs.
   */
  const adherence =
    (completedDays /
      logs.length) *
    100;

  return {
    adjust: true,

    adherence:
      +adherence.toFixed(
        1
      ),

    avgCalories:
      +(
        totalCalories /
        logs.length
      ).toFixed(0),

    weightChange:
      +weightChange.toFixed(
        2
      ),

    daysEvaluated:
      logs.length,

    weightEntries:
      weights.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE CALORIES
// ─────────────────────────────────────────────────────────────────────────────

function calculateNewCalories(
  profile,
  evaluation
) {
  if (
    !profile ||
    !evaluation
  ) {
    throw new Error(
      "Profile and evaluation are required."
    );
  }

  const goal =
    normalizeGoal(
      profile.goal
    );

  const adherence =
    toFiniteNumber(
      evaluation.adherence,
      0
    );

  const weightChange =
    toFiniteNumber(
      evaluation.weightChange,
      0
    );

  /*
   * Prefer the persisted targetCalories when available.
   *
   * If it isn't available, calculate a fresh target.
   */
  let targetCalories =
    toFiniteNumber(
      profile.targetCalories
    );

  if (
    targetCalories ===
      null ||
    targetCalories <= 0
  ) {
    targetCalories =
      computeTargetCalories(
        {
          ...profile,
          goal,
        }
      );
  }

  if (
    adherence < 70
  ) {
    return {
      change: 0,

      newCalories:
        targetCalories,

      reason:
        "Low adherence — fix consistency before adjusting calories",
    };
  }

  let adjustment =
    0;

  let reason =
    "On track";

  if (
    goal === "lose"
  ) {
    if (
      weightChange >=
      0
    ) {
      adjustment =
        -150;

      reason =
        "No weight loss — increasing deficit";
    } else if (
      weightChange <
      -1.5
    ) {
      adjustment =
        +150;

      reason =
        "Losing too fast — reducing deficit";
    }
  } else if (
    goal === "gain"
  ) {
    if (
      weightChange <=
      0
    ) {
      adjustment =
        +200;

      reason =
        "No weight gain — increasing surplus";
    } else if (
      weightChange >
      1.5
    ) {
      adjustment =
        -100;

      reason =
        "Gaining too fast — reducing surplus";
    }
  } else {
    if (
      Math.abs(
        weightChange
      ) > 1.0
    ) {
      adjustment =
        weightChange >
        0
          ? -100
          : +100;

      reason =
        "Weight drifting — correcting calories";
    }
  }

  const gender =
    normalizeGender(
      profile.gender
    );

  const floor =
    MIN_DAILY_CALORIES[
      gender
    ];

  const newCalories =
    Math.min(
      Math.max(
        Math.round(
          targetCalories +
            adjustment
        ),
        floor
      ),
      MAX_DAILY_CALORIES
    );

  return {
    change:
      adjustment,

    newCalories,

    reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY INSIGHT PERSISTENCE + NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────────

async function saveWeeklyInsight(
  userId,
  payload
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const insight =
    await WeeklyInsight.create(
      {
        user: userId,
        ...payload,
      }
    );

  /*
   * Only notify when a real evaluation happened.
   */
  if (
    payload.adherence !==
    undefined
  ) {
    try {
      const user =
        await User.findById(
          userId
        ).select(
          "pushToken"
        );

      if (
        user?.pushToken
      ) {
        const deltaText =
          payload.delta >
          0
            ? `+${payload.delta} kcal`
            : payload.delta <
              0
            ? `${payload.delta} kcal`
            : "No change";

        const notificationResult =
          await sendPushNotification(
            user.pushToken,

            "Your weekly nutrition update is ready",

            `${deltaText} — ${payload.reason}`,

            {
              type:
                "weeklyInsight",

              insightId:
                insight._id.toString(),
            }
          );

        if (
          notificationResult?.sent
        ) {
          insight.notified =
            true;

          await insight.save();
        }
      }
    } catch (notificationError) {
      /*
       * Notification failure must not make the nutrition
       * adjustment itself fail.
       */
      logger.error(
        {
          err:
            notificationError,

          userId,
        },
        "Weekly insight notification failed"
      );
    }
  }

  return insight;
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY PLAN GENERATION
// ─────────────────────────────────────────────────────────────────────────────

async function runSmartWeeklyAdjustment(
  userId
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const evaluation =
    await evaluateWeeklyProgress(
      userId
    );

  if (
    !evaluation.adjust
  ) {
    await saveWeeklyInsight(
      userId,
      {
        adjusted: false,

        reason:
          evaluation.reason,
      }
    );

    return {
      adjusted: false,

      reason:
        evaluation.reason,
    };
  }

  const profile =
    await HealthProfile.findOne(
      {
        user: userId,
      }
    );

  if (
    !profile
  ) {
    await saveWeeklyInsight(
      userId,
      {
        adjusted: false,

        reason:
          "No health profile found",

        adherence:
          evaluation.adherence,

        avgCalories:
          evaluation.avgCalories,

        weightChange:
          evaluation.weightChange,
      }
    );

    return {
      adjusted: false,

      reason:
        "No health profile found",
    };
  }

  /*
   * Normalize before calculating the adjustment.
   */
  profile.goal =
    normalizeGoal(
      profile.goal
    );

  const oldCalories =
    toFiniteNumber(
      profile.targetCalories
    );

  const result =
    calculateNewCalories(
      profile,
      evaluation
    );

  /*
   * No actual calorie change:
   * don't regenerate a completely new plan unnecessarily.
   */
  if (
    !result.newCalories
  ) {
    await saveWeeklyInsight(
      userId,
      {
        adjusted: false,

        reason:
          result.reason,

        oldCalories,

        adherence:
          evaluation.adherence,

        avgCalories:
          evaluation.avgCalories,

        weightChange:
          evaluation.weightChange,
      }
    );

    return {
      adjusted: false,

      reason:
        result.reason,
    };
  }

  const actualChange =
    result.newCalories -
    (oldCalories ||
      result.newCalories);

  /*
   * If there was no actual change, record the insight but avoid
   * creating a duplicate DietPlan.
   */
  if (
    actualChange ===
    0
  ) {
    await saveWeeklyInsight(
      userId,
      {
        adjusted: false,

        reason:
          result.reason,

        oldCalories,

        newCalories:
          result.newCalories,

        delta: 0,

        adherence:
          evaluation.adherence,

        avgCalories:
          evaluation.avgCalories,

        weightChange:
          evaluation.weightChange,
      }
    );

    return {
      adjusted: false,

      reason:
        result.reason,

      newCalories:
        result.newCalories,
    };
  }

  /*
   * Update the profile first so the newly generated plan reflects
   * the new target.
   */
  profile.targetCalories =
    result.newCalories;

  await profile.save();

  /*
   * Generate and validate the new plan BEFORE touching the old
   * active plan.
   *
   * This is important.
   *
   * If generation fails, the user's existing active plan remains
   * untouched.
   */
  const {
    meals,
    summary,
  } =
    await generateDietPlan(
      profile
    );

  validateGeneratedMeals(
    meals,
    summary.targetCalories
  );

  /*
   * Determine the next version.
   */
  const latest =
    await DietPlan.findOne(
      {
        user: userId,
      }
    )
      .sort({
        version: -1,
      })
      .lean();

  const version =
    latest
      ? Number(
          latest.version
        ) + 1
      : 1;

  /*
   * Create the new plan first.
   *
   * The DietPlan model's unique partial index ensures only one
   * active plan can ultimately exist.
   *
   * Therefore we first deactivate the current plan, then create
   * the new one.
   */
  await DietPlan.updateMany(
    {
      user: userId,

      isActive: true,
    },
    {
      $set: {
        isActive:
          false,
      },
    }
  );

  let newPlan;

  try {
    newPlan =
      await DietPlan.create(
        {
          user: userId,

          version,

          targetCalories:
            summary.targetCalories,

          macroSplit:
            summary.macroTargets,

          meals,

          summary,

          isActive:
            true,
        }
      );
  } catch (err) {
    /*
     * If creation fails after deactivation, try to restore the
     * most recent previous plan.
     */
    logger.error(
      {
        err,
        userId,
        version,
      },
      "Failed to create new weekly diet plan"
    );

    const previousPlan =
      await DietPlan.findOne(
        {
          user: userId,
        }
      )
        .sort({
          version: -1,
        });

    if (
      previousPlan
    ) {
      previousPlan.isActive =
        true;

      await previousPlan.save();
    }

    throw err;
  }

  await saveWeeklyInsight(
    userId,
    {
      adjusted:
        result.change !==
        0,

      reason:
        result.reason,

      oldCalories,

      newCalories:
        result.newCalories,

      delta:
        result.newCalories -
        (oldCalories ||
          result.newCalories),

      adherence:
        evaluation.adherence,

      avgCalories:
        evaluation.avgCalories,

      weightChange:
        evaluation.weightChange,
    }
  );

  return {
    adjusted: true,

    reason:
      result.reason,

    newCalories:
      result.newCalories,

    planId:
      newPlan._id,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY INSIGHT QUERIES
// ─────────────────────────────────────────────────────────────────────────────

async function getLatestWeeklyInsight(
  userId
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  return WeeklyInsight.findOne(
    {
      user: userId,
    }
  ).sort({
    weekEnding: -1,
  });
}

async function getWeeklyInsightHistory(
  userId,
  limit = 8
) {
  if (!userId) {
    throw new Error(
      "User ID is required."
    );
  }

  const safeLimit =
    Math.min(
      Math.max(
        Number(
          limit
        ) || 8,
        1
      ),
      50
    );

  return WeeklyInsight.find(
    {
      user: userId,
    }
  )
    .sort({
      weekEnding: -1,
    })
    .limit(
      safeLimit
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALL USERS
// ─────────────────────────────────────────────────────────────────────────────

async function runSmartWeeklyAdjustmentForAllUsers() {
  const profiles =
    await HealthProfile.find()
      .select(
        "user"
      )
      .lean();

  const results =
    [];

  for (
    const profile of profiles
  ) {
    try {
      const result =
        await runSmartWeeklyAdjustment(
          profile.user
        );

      results.push({
        user:
          profile.user,

        ...result,
      });
    } catch (err) {
      logger.error(
        {
          err,

          userId:
            profile.user,
        },

        "Weekly adjustment failed"
      );

      results.push({
        user:
          profile.user,

        adjusted: false,

        reason:
          err.message,
      });
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  generateDietPlan,

  evaluateWeeklyProgress,

  calculateNewCalories,

  computeTargetCalories,

  computeMacroTargets,

  getTemplateMealSwaps,

  warmTemplateCache,

  getTemplate,

  runSmartWeeklyAdjustment,

  runSmartWeeklyAdjustmentForAllUsers,

  getLatestWeeklyInsight,

  getWeeklyInsightHistory,

  normalizeGoal,
};