"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

const MAX_MEAL_ITEMS = 20;

const MAX_ITEM_AMOUNT = 2000;

const MAX_CALORIES = 10000;

const MAX_MACRO_GRAMS = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function nonNegativeNumberValidator(
  max = Number.MAX_SAFE_INTEGER
) {
  return {
    type: Number,

    min: [
      0,
      "Value cannot be negative.",
    ],

    max: [
      max,
      `Value cannot exceed ${max}.`,
    ],

    validate: {
      validator(value) {
        return Number.isFinite(
          value
        );
      },

      message:
        "Value must be a finite number.",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MEAL FOOD ITEM
// ─────────────────────────────────────────────────────────────────────────────

const foodItemSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,

        required: true,

        trim: true,

        minlength: 1,

        maxlength: 150,
      },

      amount: {
        type: Number,

        required: true,

        min: [
          0.1,
          "Food amount must be greater than zero.",
        ],

        max: [
          MAX_ITEM_AMOUNT,
          `Food amount cannot exceed ${MAX_ITEM_AMOUNT}.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Food amount must be a finite number.",
        },
      },

      unit: {
        type: String,

        required: true,

        trim: true,

        minlength: 1,

        maxlength: 30,
      },
    },

    {
      _id: false,

      strict: true,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// MEAL ITEM / MEAL TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

const mealItemSchema =
  new mongoose.Schema(
    {
      templateId: {
        type: String,

        trim: true,

        maxlength: 150,

        default: null,
      },

      mealName: {
        type: String,

        required: true,

        trim: true,

        minlength: 1,

        maxlength: 150,
      },

      cuisine: {
        type: String,

        trim: true,

        maxlength: 100,

        default: null,
      },

      difficulty: {
        type: String,

        trim: true,

        maxlength: 50,

        default: null,
      },

      prepTime: {
        type: Number,

        min: [
          0,
          "Preparation time cannot be negative.",
        ],

        max: [
          1440,
          "Preparation time cannot exceed 24 hours.",
        ],

        default: null,

        validate: {
          validator(value) {
            return (
              value === null ||
              value === undefined ||
              Number.isFinite(
                value
              )
            );
          },

          message:
            "Preparation time must be a finite number.",
        },
      },

      budget: {
        type: String,

        trim: true,

        maxlength: 50,

        default: null,
      },

      tags: {
        type: [
          {
            type: String,

            trim: true,

            maxlength: 50,
          },
        ],

        default: [],

        validate: {
          validator(value) {
            return (
              Array.isArray(
                value
              ) &&
              value.length <=
                30
            );
          },

          message:
            "A meal cannot contain more than 30 tags.",
        },
      },

      items: {
        type: [
          foodItemSchema,
        ],

        required: true,

        validate: [
          {
            validator(value) {
              return (
                Array.isArray(
                  value
                ) &&
                value.length >=
                  1
              );
            },

            message:
              "A meal must contain at least one food item.",
          },

          {
            validator(value) {
              return (
                Array.isArray(
                  value
                ) &&
                value.length <=
                  MAX_MEAL_ITEMS
              );
            },

            message: `A meal cannot contain more than ${MAX_MEAL_ITEMS} food items.`,
          },
        ],
      },

      calories:
        nonNegativeNumberValidator(
          MAX_CALORIES
        ),

      protein:
        nonNegativeNumberValidator(
          MAX_MACRO_GRAMS
        ),

      carbs:
        nonNegativeNumberValidator(
          MAX_MACRO_GRAMS
        ),

      fats:
        nonNegativeNumberValidator(
          MAX_MACRO_GRAMS
        ),

      fiber:
        nonNegativeNumberValidator(
          MAX_MACRO_GRAMS
        ),

      servingUnit: {
        type: String,

        trim: true,

        maxlength: 30,

        default: "g",
      },

      gramsPerPiece: {
        type: Number,

        min: [
          0,
          "gramsPerPiece cannot be negative.",
        ],

        max: [
          MAX_ITEM_AMOUNT,
          `gramsPerPiece cannot exceed ${MAX_ITEM_AMOUNT}.`,
        ],

        default: null,

        validate: {
          validator(value) {
            return (
              value === null ||
              value === undefined ||
              Number.isFinite(
                value
              )
            );
          },

          message:
            "gramsPerPiece must be a finite number.",
        },
      },

      pieces: {
        type: Number,

        min: [
          0,
          "pieces cannot be negative.",
        ],

        max: [
          1000,
          "pieces cannot exceed 1000.",
        ],

        default: null,

        validate: {
          validator(value) {
            return (
              value === null ||
              value === undefined ||
              Number.isFinite(
                value
              )
            );
          },

          message:
            "pieces must be a finite number.",
        },
      },
    },

    {
      _id: false,

      strict: true,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// MACRO SPLIT
// ─────────────────────────────────────────────────────────────────────────────
//
// The nutrition engine can use either:
//   protein / carbs / fats
//
// or target-style values:
//   proteinG / carbsG / fatsG
//
// We persist the canonical representation:
//   protein / carbs / fats
//
// ─────────────────────────────────────────────────────────────────────────────

const macroSplitSchema =
  new mongoose.Schema(
    {
      protein: {
        type: Number,

        required: true,

        min: [
          0,
          "Protein target cannot be negative.",
        ],

        max: [
          MAX_MACRO_GRAMS,
          `Protein target cannot exceed ${MAX_MACRO_GRAMS}g.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Protein target must be a finite number.",
        },
      },

      carbs: {
        type: Number,

        required: true,

        min: [
          0,
          "Carbohydrate target cannot be negative.",
        ],

        max: [
          MAX_MACRO_GRAMS,
          `Carbohydrate target cannot exceed ${MAX_MACRO_GRAMS}g.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Carbohydrate target must be a finite number.",
        },
      },

      fats: {
        type: Number,

        required: true,

        min: [
          0,
          "Fat target cannot be negative.",
        ],

        max: [
          MAX_MACRO_GRAMS,
          `Fat target cannot exceed ${MAX_MACRO_GRAMS}g.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Fat target must be a finite number.",
        },
      },
    },

    {
      _id: false,

      strict: true,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
//
// summary is kept flexible because your nutrition engine currently stores
// multiple pieces of derived information there.
//
// However, we still explicitly define the known fields so important
// nutrition values are validated.
// ─────────────────────────────────────────────────────────────────────────────

const summarySchema =
  new mongoose.Schema(
    {
      targetCalories: {
        type: Number,

        min: [
          0,
          "Target calories cannot be negative.",
        ],

        max: [
          MAX_CALORIES,
          `Target calories cannot exceed ${MAX_CALORIES}.`,
        ],
      },

      plannedCalories: {
        type: Number,

        min: [
          0,
          "Planned calories cannot be negative.",
        ],

        max: [
          MAX_CALORIES,
          `Planned calories cannot exceed ${MAX_CALORIES}.`,
        ],
      },

      actualMacros: {
        proteinG: {
          type: Number,

          min: 0,

          max: MAX_MACRO_GRAMS,
        },

        carbsG: {
          type: Number,

          min: 0,

          max: MAX_MACRO_GRAMS,
        },

        fatsG: {
          type: Number,

          min: 0,

          max: MAX_MACRO_GRAMS,
        },

        fiberG: {
          type: Number,

          min: 0,

          max: MAX_MACRO_GRAMS,
        },
      },

      macroTargets: {
        proteinG: {
          type: Number,

          min: 0,

          max: MAX_MACRO_GRAMS,
        },

        carbsG: {
          type: Number,

          min: 0,

          max: MAX_MACRO_GRAMS,
        },

        fatsG: {
          type: Number,

          min: 0,

          max: MAX_MACRO_GRAMS,
        },

        fiberG: {
          type: Number,

          min: 0,

          max: MAX_MACRO_GRAMS,
        },
      },

      aiAdvice: {
        type: String,

        trim: true,

        maxlength: 2000,
      },

      warnings: {
        type: [
          {
            type: String,

            trim: true,

            maxlength: 500,
          },
        ],

        default: [],
      },
    },

    {
      _id: false,

      strict: false,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// DIET PLAN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const dietPlanSchema =
  new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema
          .Types.ObjectId,

        ref: "User",

        required: true,

        index: true,
      },

      version: {
        type: Number,

        required: true,

        default: 1,

        min: [
          1,
          "Diet plan version must be at least 1.",
        ],

        validate: {
          validator(value) {
            return (
              Number.isInteger(
                value
              ) &&
              value >= 1
            );
          },

          message:
            "Diet plan version must be a positive integer.",
        },
      },

      targetCalories: {
        type: Number,

        required: true,

        min: [
          1000,
          "Target calories must be at least 1000 kcal.",
        ],

        max: [
          MAX_CALORIES,
          `Target calories cannot exceed ${MAX_CALORIES} kcal.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Target calories must be a finite number.",
        },
      },

      macroSplit: {
        type: macroSplitSchema,

        required: true,
      },

      meals: {
        breakfast: {
          type: [
            mealItemSchema,
          ],

          default: [],
        },

        lunch: {
          type: [
            mealItemSchema,
          ],

          default: [],
        },

        dinner: {
          type: [
            mealItemSchema,
          ],

          default: [],
        },

        snack: {
          type: [
            mealItemSchema,
          ],

          default: [],
        },
      },

      summary: {
        type: summarySchema,

        default: {},
      },

      isActive: {
        type: Boolean,

        required: true,

        default: true,

        index: true,
      },
    },

    {
      timestamps: true,

      strict: true,

      minimize: false,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

/*
 * Most of your nutrition queries look like:
 *
 * DietPlan.findOne({
 *   user: userId,
 *   isActive: true
 * })
 *
 * This index makes that lookup efficient.
 */
dietPlanSchema.index(
  {
    user: 1,
    isActive: 1,
  }
);

/*
 * Version history queries:
 *
 * DietPlan.findOne({
 *   user: userId
 * }).sort({
 *   version: -1
 * })
 */
dietPlanSchema.index(
  {
    user: 1,
    version: -1,
  }
);

/*
 * IMPORTANT:
 *
 * A user should have only ONE active diet plan.
 *
 * A partial unique index means:
 *
 * user A + active plan → allowed
 * user A + second active plan → rejected
 * user A + inactive plans → allowed
 *
 * This protects against two concurrent requests creating
 * two active plans.
 */
dietPlanSchema.index(
  {
    user: 1,
  },
  {
    unique: true,

    partialFilterExpression: {
      isActive: true,
    },

    name:
      "one_active_diet_plan_per_user",
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PRE-VALIDATE
// ─────────────────────────────────────────────────────────────────────────────

dietPlanSchema.pre(
  "validate",
  function (next) {
    /*
     * Keep summary.targetCalories synchronized with the
     * canonical top-level targetCalories.
     */
    if (
      !this.summary
    ) {
      this.summary = {};
    }

    this.summary.targetCalories =
      this.targetCalories;

    /*
     * Validate the meal structure.
     *
     * An active plan should contain all four meal slots.
     */
    if (
      this.isActive
    ) {
      for (
        const mealType of MEAL_TYPES
      ) {
        const meals =
          this.meals?.[
            mealType
          ];

        if (
          !Array.isArray(
            meals
          ) ||
          meals.length ===
            0
        ) {
          return next(
            new Error(
              `Active diet plan must contain at least one ${mealType} meal.`
            )
          );
        }
      }
    }

    next();
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

module.exports =
  mongoose.model(
    "DietPlan",
    dietPlanSchema
  );