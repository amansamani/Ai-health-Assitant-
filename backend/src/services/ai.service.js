"use strict";

const {
  GoogleGenerativeAI,
} = require("@google/generative-ai");

const { z } = require("zod");

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is not configured."
  );
}

const genAI =
  new GoogleGenerativeAI(
    GEMINI_API_KEY
  );

const model =
  genAI.getGenerativeModel({
    model:
      "gemini-2.5-flash",
  });

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

const MEAL_TOLERANCE_KCAL = 30;

const DAILY_TOLERANCE_KCAL = 30;

const MAX_RETRIES = 2;

const MAX_ITEM_AMOUNT = 2000;

const MAX_MEAL_ITEMS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

const MealItemSchema =
  z.object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(150),

    amount: z
      .number()
      .finite()
      .positive()
      .max(
        MAX_ITEM_AMOUNT
      ),

    unit: z
      .string()
      .trim()
      .min(1)
      .max(30),
  });

const MealSchema =
  z.object({
    mealName: z
      .string()
      .trim()
      .min(1)
      .max(150),

    items: z
      .array(
        MealItemSchema
      )
      .min(1)
      .max(
        MAX_MEAL_ITEMS
      ),

    calories: z
      .number()
      .finite()
      .positive()
      .max(5000),

    protein: z
      .number()
      .finite()
      .nonnegative()
      .max(500),

    carbs: z
      .number()
      .finite()
      .nonnegative()
      .max(700),

    fats: z
      .number()
      .finite()
      .nonnegative()
      .max(300),

    fiber: z
      .number()
      .finite()
      .nonnegative()
      .max(150)
      .default(0),

    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(50)
      )
      .max(20)
      .default([]),
  });

/*
 * We expect exactly one meal object per meal slot.
 *
 * The previous schema used arrays with min(1), which technically
 * allowed:
 *
 * breakfast: [meal1, meal2, meal3]
 *
 * That could make the total daily calories exceed the user's
 * target even if every individual meal was inside its own budget.
 */
const AiMealPlanSchema =
  z.object({
    breakfast:
      z
        .array(
          MealSchema
        )
        .length(1),

    lunch:
      z
        .array(
          MealSchema
        )
        .length(1),

    dinner:
      z
        .array(
          MealSchema
        )
        .length(1),

    snack:
      z
        .array(
          MealSchema
        )
        .length(1),

    aiAdvice:
      z
        .string()
        .trim()
        .min(1)
        .max(1000),

    warnings:
      z
        .array(
          z
            .string()
            .trim()
            .min(1)
            .max(300)
        )
        .max(20)
        .default([]),
  });

// ─────────────────────────────────────────────────────────────────────────────
// TEXT / SAFETY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeText(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function normalizeList(
  value
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .map(
      (item) =>
        normalizeText(
          item
        )
    )
    .filter(Boolean);
}

function getAllMealText(
  meal
) {
  const itemNames =
    Array.isArray(
      meal.items
    )
      ? meal.items.map(
          (item) =>
            item.name
        )
      : [];

  return normalizeText(
    [
      meal.mealName,
      ...itemNames,
      ...(meal.tags || []),
    ].join(" ")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLERGEN DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

const ALLERGEN_ALIASES = {
  peanut: [
    "peanut",
    "peanuts",
    "groundnut",
    "groundnuts",
    "moongphali",
    "peanut butter",
  ],

  peanuts: [
    "peanut",
    "peanuts",
    "groundnut",
    "groundnuts",
    "moongphali",
    "peanut butter",
  ],

  milk: [
    "milk",
    "dairy",
    "curd",
    "yogurt",
    "yoghurt",
    "paneer",
    "cheese",
    "butter",
    "ghee",
    "cream",
    "whey",
    "casein",
  ],

  dairy: [
    "milk",
    "dairy",
    "curd",
    "yogurt",
    "yoghurt",
    "paneer",
    "cheese",
    "butter",
    "ghee",
    "cream",
    "whey",
    "casein",
  ],

  egg: [
    "egg",
    "eggs",
  ],

  eggs: [
    "egg",
    "eggs",
  ],

  wheat: [
    "wheat",
    "atta",
    "maida",
    "bread",
    "roti",
    "chapati",
    "paratha",
    "naan",
  ],

  gluten: [
    "wheat",
    "atta",
    "maida",
    "bread",
    "roti",
    "chapati",
    "paratha",
    "naan",
  ],

  soy: [
    "soy",
    "soya",
    "soybean",
    "tofu",
  ],

  soybean: [
    "soy",
    "soya",
    "soybean",
    "tofu",
  ],

  nuts: [
    "almond",
    "almonds",
    "cashew",
    "cashews",
    "walnut",
    "walnuts",
    "pistachio",
    "pistachios",
    "hazelnut",
    "hazelnuts",
    "pecan",
    "pecans",
  ],

  tree_nuts: [
    "almond",
    "almonds",
    "cashew",
    "cashews",
    "walnut",
    "walnuts",
    "pistachio",
    "pistachios",
    "hazelnut",
    "hazelnuts",
    "pecan",
    "pecans",
  ],

  almond: [
    "almond",
    "almonds",
  ],

  cashew: [
    "cashew",
    "cashews",
  ],

  walnut: [
    "walnut",
    "walnuts",
  ],

  fish: [
    "fish",
    "salmon",
    "tuna",
    "rohu",
    "katla",
    "pomfret",
    "sardine",
    "mackerel",
  ],

  shellfish: [
    "prawn",
    "prawns",
    "shrimp",
    "crab",
    "lobster",
    "shellfish",
  ],
};

const ANIMAL_PRODUCTS = [
  "chicken",
  "chickens",
  "mutton",
  "lamb",
  "beef",
  "pork",
  "fish",
  "salmon",
  "tuna",
  "rohu",
  "katla",
  "pomfret",
  "prawn",
  "prawns",
  "shrimp",
  "crab",
  "lobster",
  "egg",
  "eggs",
  "meat",
];

const VEGAN_ANIMAL_PRODUCTS = [
  ...ANIMAL_PRODUCTS,

  "milk",
  "curd",
  "yogurt",
  "yoghurt",
  "paneer",
  "cheese",
  "butter",
  "ghee",
  "cream",
  "whey",
  "casein",
];

function getAllergyTerms(
  allergies
) {
  const terms =
    new Set();

  for (
    const allergy of normalizeList(
      allergies
    )
  ) {
    const aliases =
      ALLERGEN_ALIASES[
        allergy
      ];

    if (
      Array.isArray(
        aliases
      )
    ) {
      for (
        const alias of aliases
      ) {
        terms.add(
          normalizeText(
            alias
          )
        );
      }
    } else {
      terms.add(
        allergy
      );
    }
  }

  return [
    ...terms,
  ];
}

function containsTerm(
  text,
  term
) {
  return text.includes(
    normalizeText(
      term
    )
  );
}

function mealViolatesAllergies(
  meal,
  allergies
) {
  const text =
    getAllMealText(
      meal
    );

  const allergyTerms =
    getAllergyTerms(
      allergies
    );

  return allergyTerms.some(
    (term) =>
      containsTerm(
        text,
        term
      )
  );
}

function mealViolatesDiet(
  meal,
  dietType
) {
  const text =
    getAllMealText(
      meal
    );

  const diet =
    normalizeText(
      dietType
    );

  if (
    diet === "vegan"
  ) {
    return VEGAN_ANIMAL_PRODUCTS.some(
      (term) =>
        containsTerm(
          text,
          term
        )
    );
  }

  if (
    diet === "veg"
  ) {
    return ANIMAL_PRODUCTS.some(
      (term) =>
        containsTerm(
          text,
          term
        )
    );
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT SAFETY
// ─────────────────────────────────────────────────────────────────────────────

function safePromptValue(
  value,
  fallback = "none"
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return fallback;
  }

  const text =
    String(
      value
    )
      .trim()
      .replace(
        /[\r\n]+/g,
        " "
      );

  if (!text) {
    return fallback;
  }

  /*
   * Prevent extremely large user-controlled strings from
   * consuming the prompt context.
   */
  return text.slice(
    0,
    500
  );
}

function safePromptList(
  value
) {
  const list =
    normalizeList(
      value
    );

  if (
    !list.length
  ) {
    return "none";
  }

  return list
    .slice(0, 20)
    .map(
      (item) =>
        safePromptValue(
          item
        )
    )
    .join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(
  profile,
  targetCalories,
  macros
) {
  const goal =
    safePromptValue(
      profile.goal
    );

  const dietType =
    safePromptValue(
      profile.dietType
    );

  const diseasesStr =
    safePromptList(
      profile.diseases
    );

  const allergiesStr =
    safePromptList(
      profile.allergies
    );

  const age =
    safePromptValue(
      profile.age
    );

  const gender =
    safePromptValue(
      profile.gender
    );

  const weight =
    safePromptValue(
      profile.weightKg ??
        profile.weight
    );

  const activityLevel =
    safePromptValue(
      profile.activityLevel
    );

  const calorieBudgets = {
    breakfast:
      Math.round(
        targetCalories *
          CALORIE_SPLIT
            .breakfast
      ),

    lunch:
      Math.round(
        targetCalories *
          CALORIE_SPLIT
            .lunch
      ),

    dinner:
      Math.round(
        targetCalories *
          CALORIE_SPLIT
            .dinner
      ),

    snack:
      Math.round(
        targetCalories *
          CALORIE_SPLIT
            .snack
      ),
  };

  let dietRule;

  if (
    dietType ===
    "vegan"
  ) {
    dietRule =
      "STRICTLY VEGAN. No meat, chicken, fish, seafood, eggs, milk, curd, yogurt, paneer, cheese, butter, ghee, whey, or other animal-derived foods.";
  } else if (
    dietType ===
    "veg"
  ) {
    dietRule =
      "STRICTLY VEGETARIAN. No meat, chicken, fish, seafood, or eggs.";
  } else {
    dietRule =
      "NON-VEGETARIAN is allowed. Eggs, chicken and fish may be used when appropriate.";
  }

  return `
SYSTEM ROLE:
You are an Indian nutrition planning assistant.

IMPORTANT:
You generate a food plan, but you must NEVER ignore the user's explicit allergy or diet restrictions.

USER PROFILE:
- Age: ${age}
- Gender: ${gender}
- Weight: ${weight} kg
- Activity level: ${activityLevel}
- Goal: ${goal}
- Diet type: ${dietType}
- Medical conditions: ${diseasesStr}
- Allergies: ${allergiesStr}

HARD DAILY TARGET:
- Total calories: ${Math.round(
    targetCalories
  )} kcal
- Protein: ${Math.round(
    macros.proteinG
  )} g
- Carbohydrates: ${Math.round(
    macros.carbsG
  )} g
- Fat: ${Math.round(
    macros.fatsG
  )} g

MEAL CALORIE TARGETS:
- Breakfast: ${calorieBudgets.breakfast} kcal
- Lunch: ${calorieBudgets.lunch} kcal
- Dinner: ${calorieBudgets.dinner} kcal
- Snack: ${calorieBudgets.snack} kcal

DIET RESTRICTION:
${dietRule}

ALLERGIES:
${allergiesStr}

MEDICAL CONDITIONS:
${diseasesStr}

MEDICAL-NUTRITION GUIDANCE:
- diabetes: prefer high-fiber, lower-GI carbohydrate sources and avoid added sugar.
- hypertension: reduce sodium and avoid heavily processed foods.
- cholesterol concerns: emphasize fiber and limit highly saturated/fried foods.
- PCOS/PCOD: prioritize protein, fiber, minimally processed foods and controlled carbohydrate portions.
- thyroid conditions: do not make extreme food exclusions unless explicitly required by the profile.
- Multiple conditions: follow the safest compatible combination rather than applying contradictory rules.

FOOD RULES:
1. Use realistic, commonly eaten Indian foods.
2. Do not invent exotic or restaurant-only meals.
3. Do not include an allergen under another name.
4. Do not use a restricted animal product to satisfy protein targets.
5. Portions must be physically realistic.
6. Every listed item must contribute to the meal.
7. The reported meal calories must be approximately consistent with the listed food portions.
8. Do not create impossible combinations such as extremely large quantities of one food merely to hit calories.
9. Do not use negative or zero quantities.
10. Do not include duplicate meals merely to increase calories.

IMPORTANT CALORIE RULE:
There must be exactly ONE meal object for each of:
- breakfast
- lunch
- dinner
- snack

The sum of the four "calories" fields must be within ±${DAILY_TOLERANCE_KCAL} kcal of ${Math.round(
    targetCalories
  )} kcal.

Each meal must be within ±${MEAL_TOLERANCE_KCAL} kcal of its meal budget.

Before responding, internally verify:
A. Each meal has realistic food portions.
B. Each meal's calories are reasonable for its listed portions.
C. The four meal calories sum to approximately ${Math.round(
    targetCalories
  )} kcal.
D. No allergy is present.
E. The diet restriction is obeyed.
F. Medical-condition guidance is respected.

OUTPUT:
Return ONLY valid JSON.
Do not use markdown.
Do not use \`\`\`.
Do not add commentary before or after the JSON.

Required JSON shape:
{
  "breakfast": [{
    "mealName": "string",
    "items": [
      {
        "name": "string",
        "amount": 100,
        "unit": "g"
      }
    ],
    "calories": 300,
    "protein": 20,
    "carbs": 35,
    "fats": 8,
    "fiber": 6,
    "tags": ["high-protein"]
  }],
  "lunch": [{
    "mealName": "string",
    "items": [],
    "calories": 500,
    "protein": 30,
    "carbs": 55,
    "fats": 12,
    "fiber": 8,
    "tags": []
  }],
  "dinner": [{
    "mealName": "string",
    "items": [],
    "calories": 500,
    "protein": 30,
    "carbs": 55,
    "fats": 12,
    "fiber": 8,
    "tags": []
  }],
  "snack": [{
    "mealName": "string",
    "items": [],
    "calories": 150,
    "protein": 10,
    "carbs": 15,
    "fats": 5,
    "fiber": 3,
    "tags": []
  }],
  "aiAdvice": "2-3 concise personalized sentences.",
  "warnings": []
}
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

function extractJson(
  raw
) {
  if (
    typeof raw !==
      "string" ||
    !raw.trim()
  ) {
    throw new Error(
      "AI returned an empty response."
    );
  }

  let clean =
    raw.trim();

  /*
   * Remove common markdown fences.
   */
  clean = clean
    .replace(
      /^```(?:json)?\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();

  /*
   * First attempt:
   * the entire response is JSON.
   */
  try {
    return JSON.parse(
      clean
    );
  } catch {
    // Continue to extraction.
  }

  /*
   * Second attempt:
   * find the outermost JSON object.
   *
   * This handles occasional responses such as:
   *
   * Here is the JSON:
   * {...}
   */
  const firstBrace =
    clean.indexOf(
      "{"
    );

  const lastBrace =
    clean.lastIndexOf(
      "}"
    );

  if (
    firstBrace === -1 ||
    lastBrace === -1 ||
    lastBrace <=
      firstBrace
  ) {
    throw new Error(
      "AI response did not contain a JSON object."
    );
  }

  const candidate =
    clean.slice(
      firstBrace,
      lastBrace + 1
    );

  try {
    return JSON.parse(
      candidate
    );
  } catch (err) {
    throw new Error(
      `AI returned invalid JSON: ${err.message}`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AI RESPONSE SAFETY
// ─────────────────────────────────────────────────────────────────────────────

function validateMealSafety(
  meal,
  profile
) {
  const dietType =
    normalizeText(
      profile.dietType
    );

  if (
    mealViolatesDiet(
      meal,
      dietType
    )
  ) {
    throw new Error(
      `AI generated a meal incompatible with the user's ${dietType} diet: ${meal.mealName}`
    );
  }

  if (
    mealViolatesAllergies(
      meal,
      profile.allergies
    )
  ) {
    throw new Error(
      `AI generated an allergen-containing meal: ${meal.mealName}`
    );
  }
}

function validateAllMeals(
  validated,
  profile
) {
  for (
    const mealType of MEAL_TYPES
  ) {
    const meals =
      validated[
        mealType
      ];

    if (
      !Array.isArray(
        meals
      ) ||
      meals.length !==
        1
    ) {
      throw new Error(
        `AI must return exactly one ${mealType} meal.`
      );
    }

    for (
      const meal of meals
    ) {
      validateMealSafety(
        meal,
        profile
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CALORIE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function getMealBudget(
  targetCalories,
  mealType
) {
  return Math.round(
    targetCalories *
      CALORIE_SPLIT[
        mealType
      ]
  );
}

function calculateDailyCalories(
  plan
) {
  return MEAL_TYPES.reduce(
    (
      total,
      mealType
    ) => {
      const meal =
        plan[
          mealType
        ][0];

      return (
        total +
        Number(
          meal.calories
        )
      );
    },
    0
  );
}

function calculateDailyMacros(
  plan
) {
  return MEAL_TYPES.reduce(
    (
      totals,
      mealType
    ) => {
      const meal =
        plan[
          mealType
        ][0];

      totals.protein +=
        Number(
          meal.protein
        );

      totals.carbs +=
        Number(
          meal.carbs
        );

      totals.fats +=
        Number(
          meal.fats
        );

      totals.fiber +=
        Number(
          meal.fiber
        );

      return totals;
    },
    {
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
    }
  );
}

/**
 * The model may be a little above/below the requested target.
 *
 * We normalize only when the difference is small enough that
 * the correction is reasonable.
 *
 * We DO NOT blindly scale food quantities to arbitrary values.
 */
function normalizeMealCalories(
  meal,
  targetCalories
) {
  const current =
    Number(
      meal.calories
    );

  const difference =
    current -
    targetCalories;

  if (
    Math.abs(
      difference
    ) <=
    MEAL_TOLERANCE_KCAL
  ) {
    return meal;
  }

  /*
   * If the model is wildly wrong, reject it rather than
   * pretending we can fix the food nutrition with a multiplier.
   */
  if (
    current <= 0 ||
    Math.abs(
      difference
    ) >
      targetCalories *
        0.30
  ) {
    throw new Error(
      `AI meal "${meal.mealName}" is too far from its calorie target. Expected ~${Math.round(
        targetCalories
      )} kcal but received ${Math.round(
        current
      )} kcal.`
    );
  }

  /*
   * For small deviations, normalize the reported calorie value
   * to the requested budget.
   *
   * We deliberately do NOT alter macros or item quantities here.
   *
   * The meal is still subject to the final consistency checks.
   */
  meal.calories =
    Math.round(
      targetCalories
    );

  return meal;
}

function validateMealCalories(
  plan,
  targetCalories
) {
  let dailyCalories = 0;

  for (
    const mealType of MEAL_TYPES
  ) {
    const meal =
      plan[
        mealType
      ][0];

    const budget =
      getMealBudget(
        targetCalories,
        mealType
      );

    const calories =
      Number(
        meal.calories
      );

    if (
      Math.abs(
        calories -
          budget
      ) >
      MEAL_TOLERANCE_KCAL
    ) {
      throw new Error(
        `${mealType} calories are outside the allowed range. Expected approximately ${budget} kcal but received ${Math.round(
          calories
        )} kcal.`
      );
    }

    dailyCalories +=
      calories;
  }

  if (
    Math.abs(
      dailyCalories -
        targetCalories
    ) >
    DAILY_TOLERANCE_KCAL
  ) {
    throw new Error(
      `AI daily calories are outside the allowed range. Expected approximately ${Math.round(
        targetCalories
      )} kcal but received ${Math.round(
        dailyCalories
      )} kcal.`
    );
  }

  return Math.round(
    dailyCalories
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MACRO VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

function validateMacroConsistency(
  plan
) {
  const totals =
    calculateDailyMacros(
      plan
    );

  /*
   * Approximate calories implied by macros.
   *
   * This is not a replacement for a food database, but it
   * catches obviously impossible AI outputs.
   */
  const impliedCalories =
    totals.protein * 4 +
    totals.carbs * 4 +
    totals.fats * 9;

  const reportedCalories =
    calculateDailyCalories(
      plan
    );

  /*
   * Fiber isn't added to the basic 4/4/9 estimate because
   * actual fiber energy depends on digestion and food source.
   */
  const allowedDifference =
    Math.max(
      150,
      reportedCalories *
        0.25
    );

  if (
    Math.abs(
      impliedCalories -
        reportedCalories
    ) >
    allowedDifference
  ) {
    throw new Error(
      `AI macro values are inconsistent with reported calories. Reported calories: ${Math.round(
        reportedCalories
      )}, macro-derived calories: ${Math.round(
        impliedCalories
      )}.`
    );
  }

  return totals;
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTION SANITY
// ─────────────────────────────────────────────────────────────────────────────

function validatePortions(
  plan
) {
  for (
    const mealType of MEAL_TYPES
  ) {
    const meal =
      plan[
        mealType
      ][0];

    for (
      const item of meal.items
    ) {
      const amount =
        Number(
          item.amount
        );

      if (
        !Number.isFinite(
          amount
        ) ||
        amount <= 0
      ) {
        throw new Error(
          `Invalid portion for ${item.name}.`
        );
      }

      if (
        amount >
        MAX_ITEM_AMOUNT
      ) {
        throw new Error(
          `Unrealistic portion for ${item.name}: ${amount}${item.unit}.`
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WARNINGS
// ─────────────────────────────────────────────────────────────────────────────

function buildBackendWarnings(
  profile,
  validated
) {
  const warnings =
    Array.isArray(
      validated.warnings
    )
      ? [
          ...validated.warnings,
        ]
      : [];

  const diseases =
    normalizeList(
      profile.diseases
    );

  const allergies =
    normalizeList(
      profile.allergies
    );

  /*
   * Backend warnings are additive.
   *
   * We don't trust the AI to remember to mention the presence
   * of a restriction.
   */
  if (
    allergies.length
  ) {
    warnings.push(
      `Plan generated with allergy restrictions: ${allergies.join(
        ", "
      )}.`
    );
  }

  if (
    diseases.length
  ) {
    warnings.push(
      `Medical conditions supplied to the nutrition engine: ${diseases.join(
        ", "
      )}.`
    );
  }

  /*
   * Remove duplicates while preserving order.
   */
  return [
    ...new Set(
      warnings
        .map(
          (warning) =>
            String(
              warning
            ).trim()
        )
        .filter(Boolean)
    ),
  ].slice(
    0,
    20
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

function normalizeResponse(
  validated,
  targetCalories
) {
  const result = {
    ...validated,
  };

  /*
   * Normalize meal calories to their exact requested budget when
   * the model is within tolerance.
   *
   * This ensures the final four meal values sum to the intended
   * target because the four ratios sum to 1.00.
   */
  for (
    const mealType of MEAL_TYPES
  ) {
    const meal =
      result[
        mealType
      ][0];

    const budget =
      getMealBudget(
        targetCalories,
        mealType
      );

    normalizeMealCalories(
      meal,
      budget
    );
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE AI REQUEST
// ─────────────────────────────────────────────────────────────────────────────

async function requestAiPlan(
  prompt
) {
  const result =
    await model.generateContent(
      prompt
    );

  if (
    !result?.response
  ) {
    throw new Error(
      "Gemini returned no response."
    );
  }

  const raw =
    result.response.text();

  if (
    typeof raw !==
      "string" ||
    !raw.trim()
  ) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

async function generateAiMealPlan(
  profile,
  targetCalories,
  macros
) {
  if (!profile) {
    throw new Error(
      "Profile is required for AI meal generation."
    );
  }

  const calories =
    Number(
      targetCalories
    );

  if (
    !Number.isFinite(
      calories
    ) ||
    calories < 1000 ||
    calories > 10000
  ) {
    throw new Error(
      "Invalid target calorie value."
    );
  }

  if (
    !macros ||
    !Number.isFinite(
      Number(
        macros.proteinG
      )
    ) ||
    !Number.isFinite(
      Number(
        macros.carbsG
      )
    ) ||
    !Number.isFinite(
      Number(
        macros.fatsG
      )
    )
  ) {
    throw new Error(
      "Invalid macro targets."
    );
  }

  const prompt =
    buildPrompt(
      profile,
      calories,
      macros
    );

  let lastError =
    null;

  for (
    let attempt = 1;
    attempt <=
      MAX_RETRIES;
    attempt += 1
  ) {
    try {
      const raw =
        await requestAiPlan(
          prompt
        );

      const parsed =
        extractJson(
          raw
        );

      /*
       * Validate shape BEFORE performing any calculations.
       */
      const validated =
        AiMealPlanSchema.parse(
          parsed
        );

      /*
       * Backend safety validation.
       *
       * Prompt instructions are not a security boundary.
       */
      validateAllMeals(
        validated,
        profile
      );

      /*
       * Normalize only small calorie deviations.
       * Large deviations are rejected.
       */
      const normalized =
        normalizeResponse(
          validated,
          calories
        );

      /*
       * Validate portions before accepting the result.
       */
      validatePortions(
        normalized
      );

      /*
       * Validate per-meal and daily calories.
       */
      validateMealCalories(
        normalized,
        calories
      );

      /*
       * Validate macro/calorie mathematical consistency.
       */
      validateMacroConsistency(
        normalized
      );

      /*
       * Add backend-generated warnings.
       */
      normalized.warnings =
        buildBackendWarnings(
          profile,
          normalized
        );

      return normalized;
    } catch (err) {
      lastError =
        err;

      /*
       * Zod/schema/safety failures are not necessarily transient.
       *
       * However, retrying once can help if the model generated
       * an otherwise malformed response.
       */
      if (
        attempt <
        MAX_RETRIES
      ) {
        continue;
      }
    }
  }

  throw new Error(
    `AI meal plan generation failed after ${MAX_RETRIES} attempts: ${
      lastError?.message ||
      "Unknown error"
    }`
  );
}

module.exports = {
  generateAiMealPlan,
};