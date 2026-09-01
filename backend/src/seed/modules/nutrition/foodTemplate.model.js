"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// FOOD TEMPLATE ITEM
// ─────────────────────────────────────────────────────────────────────────────

const foodTemplateItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    minAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    maxAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    scalable: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MACRO RANGE
// ─────────────────────────────────────────────────────────────────────────────

const macroRangeSchema = new mongoose.Schema(
  {
    calories: {
      type: [Number],
      default: [],
    },

    protein: {
      type: [Number],
      default: [],
    },

    carbs: {
      type: [Number],
      default: [],
    },

    fats: {
      type: [Number],
      default: [],
    },

    fiber: {
      type: [Number],
      default: [],
    },
  },
  {
    _id: false,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// MEAL SCORE
// ─────────────────────────────────────────────────────────────────────────────

const mealScoreSchema = new mongoose.Schema(
  {
    realism: {
      type: Number,
      default: 0,
      min: 0,
    },

    satiety: {
      type: Number,
      default: 0,
      min: 0,
    },

    goalFit: {
      type: Number,
      default: 0,
      min: 0,
    },

    proteinQuality: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// FOOD TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

const foodTemplateSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    mealType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,

      enum: [
        "breakfast",
        "lunch",
        "snack",
        "dinner",
      ],
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    dietType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,

      enum: [
        "veg",
        "vegan",
        "eggetarian",
        "non-veg",
      ],
    },

    goal: {
      type: [String],
      default: [],
    },

    cuisine: {
      type: String,
      default: "",
      trim: true,
    },

    difficulty: {
      type: String,
      default: "",
      trim: true,
    },

    prepTime: {
      type: Number,
      default: null,
      min: 0,
    },

    budget: {
      type: String,
      default: "",
      trim: true,
    },

    mealScore: {
      type: mealScoreSchema,
      default: () => ({}),
    },

    items: {
      type: [foodTemplateItemSchema],
      default: [],
    },

    macroRange: {
      type: macroRangeSchema,
      default: () => ({}),
    },

    tags: {
      type: [String],
      default: [],
    },

    /*
     * Your MongoDB export contains this object.
     *
     * Example:
     *
     * _meta: {
     *   version: "2.0",
     *   app: "fitlip",
     *   goals: [...],
     *   dietTypes: [...],
     *   mealTypes: [...]
     * }
     *
     * We intentionally keep it flexible because it is metadata,
     * not something the nutrition algorithm needs to calculate meals.
     */
    _meta: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
  },

  {
    /*
     * IMPORTANT:
     *
     * Keep strict:false because this is an existing MongoDB
     * collection that already contains imported documents.
     *
     * This allows future metadata/additional fields to survive
     * without Mongoose stripping them.
     */
    strict: false,

    collection: "foodtemplate",

    timestamps: false,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

foodTemplateSchema.index({
  mealType: 1,
  dietType: 1,
});

foodTemplateSchema.index({
  mealType: 1,
  dietType: 1,
  goal: 1,
});

// ─────────────────────────────────────────────────────────────────────────────
// MODEL
// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model(
  "FoodTemplate",
  foodTemplateSchema
);