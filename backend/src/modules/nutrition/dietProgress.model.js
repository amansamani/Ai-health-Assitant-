"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CALORIES_CONSUMED = 20000;

const MAX_WEIGHT_KG = 500;

const MAX_NOTES_LENGTH = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// DATE VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DietProgress stores calendar dates rather than timestamps.
 *
 * Required format:
 *
 * YYYY-MM-DD
 *
 * Example:
 *
 * 2026-08-21
 */
function isValidDateKey(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00Z`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  /*
   * This catches impossible dates such as:
   *
   * 2026-02-31
   */
  return (
    date
      .toISOString()
      .slice(0, 10) ===
    value
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MEALS COMPLETED SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const mealsCompletedSchema =
  new mongoose.Schema(
    {
      breakfast: {
        type: Boolean,
        default: false,
      },

      lunch: {
        type: Boolean,
        default: false,
      },

      snack: {
        type: Boolean,
        default: false,
      },

      dinner: {
        type: Boolean,
        default: false,
      },
    },
    {
      /*
       * Prevent arbitrary fields from being stored inside
       * mealsCompleted.
       */
      _id: false,

      strict: true,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const dietProgressSchema =
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
       * Calendar date in the user's local timezone.
       *
       * Example:
       *
       * 2026-08-21
       */
      date: {
        type: String,

        required: true,

        trim: true,

        validate: {
          validator:
            isValidDateKey,

          message:
            "Date must be a valid YYYY-MM-DD date.",
        },
      },

      mealsCompleted: {
        type:
          mealsCompletedSchema,

        required: true,

        default: () => ({
          breakfast: false,
          lunch: false,
          snack: false,
          dinner: false,
        }),
      },

      caloriesConsumed: {
        type: Number,

        default: 0,

        min: [
          0,
          "Calories consumed cannot be negative.",
        ],

        max: [
          MAX_CALORIES_CONSUMED,
          `Calories consumed cannot exceed ${MAX_CALORIES_CONSUMED}.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Calories consumed must be a finite number.",
        },
      },

      weight: {
        type: Number,

        min: [
          0.1,
          "Weight must be greater than zero.",
        ],

        max: [
          MAX_WEIGHT_KG,
          `Weight cannot exceed ${MAX_WEIGHT_KG} kg.`,
        ],

        validate: {
          validator(value) {
            return (
              value ===
                undefined ||
              value === null ||
              Number.isFinite(
                value
              )
            );
          },

          message:
            "Weight must be a finite number.",
        },
      },

      notes: {
        type: String,

        trim: true,

        maxlength: [
          MAX_NOTES_LENGTH,
          `Notes cannot exceed ${MAX_NOTES_LENGTH} characters.`,
        ],

        default: "",
      },
    },
    {
      timestamps: true,

      /*
       * Do not silently store arbitrary fields.
       */
      strict: true,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

/*
 * CRITICAL:
 *
 * One progress record per user per calendar day.
 *
 * This protects against:
 *
 * User A
 *   ├── 2026-08-21 record 1
 *   └── 2026-08-21 record 2
 */
dietProgressSchema.index(
  {
    user: 1,
    date: 1,
  },
  {
    unique: true,

    name:
      "unique_user_daily_diet_progress",
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PRE-VALIDATE
// ─────────────────────────────────────────────────────────────────────────────

dietProgressSchema.pre(
  "validate",
  function (next) {
    /*
     * Normalize date whitespace.
     */
    if (
      typeof this.date ===
      "string"
    ) {
      this.date =
        this.date.trim();
    }

    /*
     * Make sure mealsCompleted always exists.
     *
     * This is particularly useful for older documents and
     * partially-created records.
     */
    if (
      !this.mealsCompleted
    ) {
      this.mealsCompleted =
        {
          breakfast: false,
          lunch: false,
          snack: false,
          dinner: false,
        };
    }

    next();
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

module.exports =
  mongoose.model(
    "DietProgress",
    dietProgressSchema
  );