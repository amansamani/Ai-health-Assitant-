"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAX_QUANTITY = 10000;

const MAX_CALORIES = 20000;

const MAX_MACRO = 5000;

const MAX_NAME_LENGTH = 150;

const MAX_BRAND_LENGTH = 100;

const MAX_UNIT_LENGTH = 30;

// ─────────────────────────────────────────────────────────────────────────────
// FOOD ITEM SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const foodItemSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,

        required: true,

        trim: true,

        minlength: 1,

        maxlength: MAX_NAME_LENGTH,
      },

      brand: {
        type: String,

        default: "",

        trim: true,

        maxlength: MAX_BRAND_LENGTH,
      },

      /*
       * Quantity is normally grams, but the unit field is retained
       * because your frontend may log ml / pieces for certain foods.
       */
      quantity: {
        type: Number,

        required: true,

        min: [
          0.1,
          "Food quantity must be greater than zero.",
        ],

        max: [
          MAX_QUANTITY,
          `Food quantity cannot exceed ${MAX_QUANTITY}.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Food quantity must be a finite number.",
        },
      },

      unit: {
        type: String,

        default: "g",

        trim: true,

        minlength: 1,

        maxlength: MAX_UNIT_LENGTH,
      },

      calories: {
        type: Number,

        required: true,

        min: [
          0,
          "Calories cannot be negative.",
        ],

        max: [
          MAX_CALORIES,
          `Calories cannot exceed ${MAX_CALORIES}.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Calories must be a finite number.",
        },
      },

      protein: {
        type: Number,

        default: 0,

        min: [
          0,
          "Protein cannot be negative.",
        ],

        max: [
          MAX_MACRO,
          `Protein cannot exceed ${MAX_MACRO}g.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Protein must be a finite number.",
        },
      },

      carbs: {
        type: Number,

        default: 0,

        min: [
          0,
          "Carbohydrates cannot be negative.",
        ],

        max: [
          MAX_MACRO,
          `Carbohydrates cannot exceed ${MAX_MACRO}g.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Carbohydrates must be a finite number.",
        },
      },

      fats: {
        type: Number,

        default: 0,

        min: [
          0,
          "Fats cannot be negative.",
        ],

        max: [
          MAX_MACRO,
          `Fats cannot exceed ${MAX_MACRO}g.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Fats must be a finite number.",
        },
      },

      fiber: {
        type: Number,

        default: 0,

        min: [
          0,
          "Fiber cannot be negative.",
        ],

        max: [
          MAX_MACRO,
          `Fiber cannot exceed ${MAX_MACRO}g.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Fiber must be a finite number.",
        },
      },

      sugar: {
        type: Number,

        default: 0,

        min: [
          0,
          "Sugar cannot be negative.",
        ],

        max: [
          MAX_MACRO,
          `Sugar cannot exceed ${MAX_MACRO}g.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Sugar must be a finite number.",
        },
      },

      sodium: {
        type: Number,

        default: 0,

        min: [
          0,
          "Sodium cannot be negative.",
        ],

        max: [
          MAX_MACRO,
          `Sodium cannot exceed ${MAX_MACRO}mg.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Sodium must be a finite number.",
        },
      },
    },
    {
      /*
       * We don't need an independent MongoDB _id for the embedded
       * food object.
       */
      _id: false,

      strict: true,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// MEAL LOG SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const mealLogSchema =
  new mongoose.Schema(
    {
      user: {
        type: mongoose.Schema
          .Types.ObjectId,

        ref: "User",

        required: true,

        index: true,
      },

      /*
       * IMPORTANT:
       *
       * Your existing application uses "snacks" in MealLog,
       * while DietPlan uses "snack".
       *
       * We keep "snacks" here for backwards compatibility with
       * existing MealLog documents and the current frontend.
       */
      mealType: {
        type: String,

        enum: {
          values: [
            "breakfast",
            "lunch",
            "snacks",
            "dinner",
          ],

          message:
            "Invalid meal type.",
        },

        required: true,

        trim: true,
      },

      food: {
        type: foodItemSchema,

        required: true,
      },

      loggedAt: {
        type: Date,

        default: Date.now,

        required: true,

        index: true,
      },
    },
    {
      timestamps: true,

      strict: true,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

/*
 * This is one of the most important indexes for this model.
 *
 * Your controller performs:
 *
 * MealLog.find({
 *   user: userId,
 *   loggedAt: {
 *     $gte: start,
 *     $lt: end
 *   }
 * })
 *
 * So MongoDB should be able to use:
 *
 * user + loggedAt
 */
mealLogSchema.index(
  {
    user: 1,
    loggedAt: -1,
  },
  {
    name:
      "meal_logs_user_logged_at",
  }
);

/*
 * Useful for filtering today's meals by type.
 */
mealLogSchema.index(
  {
    user: 1,
    mealType: 1,
    loggedAt: -1,
  },
  {
    name:
      "meal_logs_user_type_logged_at",
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PRE-VALIDATE
// ─────────────────────────────────────────────────────────────────────────────

// NOTE: no `next` param — see dietPlan.model.js for why (Mongoose 9
// runs a 0-arg document pre-hook synchronously; the old `function
// (next)` callback style no longer receives a real `next`).
mealLogSchema.pre(
  "validate",
  function () {
    /*
     * Normalize the meal type.
     */
    if (
      typeof this.mealType ===
      "string"
    ) {
      this.mealType =
        this.mealType
          .trim()
          .toLowerCase();
    }

    /*
     * Normalize food strings.
     */
    if (
      this.food
    ) {
      if (
        typeof this.food.name ===
        "string"
      ) {
        this.food.name =
          this.food.name.trim();
      }

      if (
        typeof this.food.brand ===
        "string"
      ) {
        this.food.brand =
          this.food.brand.trim();
      }

      if (
        typeof this.food.unit ===
        "string"
      ) {
        this.food.unit =
          this.food.unit
            .trim()
            .toLowerCase();
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

module.exports =
  mongoose.model(
    "MealLog",
    mealLogSchema
  );