"use strict";

const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const FOOD_CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "snacks", // kept temporarily for existing database records
  "beverages", // present in existing database records
  "fruits", // present in existing database records
];

const DIET_TYPES = [
  "veg",
  "non-veg",
  "nonveg", // kept temporarily for existing database records (no hyphen)
  "eggetarian",
  "vegan",
  "vegetarian",
];

const SERVING_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "piece",
  "pieces",
  "cup",
  "tbsp",
  "tsp",
];

const MAX_NAME_LENGTH = 200;

const MAX_CATEGORY_LENGTH = 50;

const MAX_DIET_TYPE_LENGTH = 50;

const MAX_TAG_LENGTH = 50;

const MAX_TAGS = 30;

const MAX_SERVING_GRAMS = 10000;

const MAX_CALORIES_PER_100G = 2000;

const MAX_MACRO_PER_100G = 500;

const MAX_FIBER_PER_100G = 200;

// ─────────────────────────────────────────────────────────────────────────────
// NUTRITION SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const nutritionSchema =
  new mongoose.Schema(
    {
      calories: {
        type: Number,

        required: true,

        min: [
          0,
          "Calories cannot be negative.",
        ],

        max: [
          MAX_CALORIES_PER_100G,
          `Calories cannot exceed ${MAX_CALORIES_PER_100G} kcal per 100g.`,
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

        required: true,

        min: [
          0,
          "Protein cannot be negative.",
        ],

        max: [
          MAX_MACRO_PER_100G,
          `Protein cannot exceed ${MAX_MACRO_PER_100G}g per 100g.`,
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

        required: true,

        min: [
          0,
          "Carbohydrates cannot be negative.",
        ],

        max: [
          MAX_MACRO_PER_100G,
          `Carbohydrates cannot exceed ${MAX_MACRO_PER_100G}g per 100g.`,
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

        required: true,

        min: [
          0,
          "Fats cannot be negative.",
        ],

        max: [
          MAX_MACRO_PER_100G,
          `Fats cannot exceed ${MAX_MACRO_PER_100G}g per 100g.`,
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

        required: true,

        min: [
          0,
          "Fiber cannot be negative.",
        ],

        max: [
          MAX_FIBER_PER_100G,
          `Fiber cannot exceed ${MAX_FIBER_PER_100G}g per 100g.`,
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
    },

    {
      _id: false,

      strict: true,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// SERVING SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const servingSchema =
  new mongoose.Schema(
    {
      unit: {
        type: String,

        required: true,

        trim: true,

        lowercase: true,

        enum: {
          values:
            SERVING_UNITS,

          message:
            "Invalid serving unit.",
        },

        default: "g",
      },

      /*
       * Despite the property name "grams", your actual export
       * also uses it for ml-based foods.
       *
       * Example from the real database:
       *
       * Aam Panna:
       * unit = "ml"
       * grams = 200
       *
       * Therefore we preserve the existing field name exactly.
       */
      grams: {
        type: Number,

        required: true,

        min: [
          0.1,
          "Serving size must be greater than zero.",
        ],

        max: [
          MAX_SERVING_GRAMS,
          `Serving size cannot exceed ${MAX_SERVING_GRAMS}.`,
        ],

        validate: {
          validator(value) {
            return Number.isFinite(
              value
            );
          },

          message:
            "Serving size must be a finite number.",
        },
      },
    },

    {
      _id: false,

      strict: true,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FOOD ITEM SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const foodItemSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,

        required: true,

        trim: true,

        minlength: 1,

        maxlength:
          MAX_NAME_LENGTH,
      },

      category: {
        type: String,

        required: true,

        trim: true,

        lowercase: true,

        enum: {
          values:
            FOOD_CATEGORIES,

          message:
            "Invalid food category.",
        },
      },

      dietType: {
        type: String,

        required: true,

        trim: true,

        lowercase: true,

        enum: {
          values:
            DIET_TYPES,

          message:
            "Invalid diet type.",
        },
      },

      isIndian: {
        type: Boolean,

        required: true,

        default: true,
      },

      per100g: {
        type:
          nutritionSchema,

        required: true,
      },

      serving: {
        type:
          servingSchema,

        required: true,
      },

      tags: {
        type: [
          {
            type: String,

            trim: true,

            lowercase: true,

            maxlength:
              MAX_TAG_LENGTH,
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
                MAX_TAGS
            );
          },

          message: `A food item cannot have more than ${MAX_TAGS} tags.`,
        },
      },
    },

    {
      /*
       * CRITICAL:
       *
       * Your old model used:
       *
       * strict: false
       *
       * We now define the actual MongoDB structure instead.
       */
      strict: true,

      collection:
        "fooditems",

      timestamps: false,
    }
  );

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

/*
 * Food search commonly starts with the name.
 */
foodItemSchema.index(
  {
    name: 1,
  },
  {
    name:
      "fooditems_name_index",
  }
);

/*
 * Your diet engine can filter foods by:
 *
 * category + dietType
 *
 * Example:
 *
 * breakfast + veg
 * dinner + vegan
 */
foodItemSchema.index(
  {
    category: 1,

    dietType: 1,
  },
  {
    name:
      "fooditems_category_diet_index",
  }
);

/*
 * Useful when your application specifically requests Indian foods.
 */
foodItemSchema.index(
  {
    isIndian: 1,

    category: 1,

    dietType: 1,
  },
  {
    name:
      "fooditems_indian_category_diet_index",
  }
);

/*
 * Tags are arrays, so MongoDB creates a multikey index.
 */
foodItemSchema.index(
  {
    tags: 1,
  },
  {
    name:
      "fooditems_tags_index",
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PRE-VALIDATE NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

foodItemSchema.pre(
  "validate",
  function () {
    if (
      typeof this.name ===
      "string"
    ) {
      this.name =
        this.name.trim();
    }

    if (
      typeof this.category ===
      "string"
    ) {
      this.category =
        this.category
          .trim()
          .toLowerCase();
    }

    if (
      typeof this.dietType ===
      "string"
    ) {
      this.dietType =
        this.dietType
          .trim()
          .toLowerCase();
    }

    if (
      this.serving &&
      typeof this.serving
        .unit ===
        "string"
    ) {
      this.serving.unit =
        this.serving.unit
          .trim()
          .toLowerCase();
    }

    if (
      Array.isArray(
        this.tags
      )
    ) {
      this.tags =
        [
          ...new Set(
            this.tags
              .map(
                (tag) =>
                  String(
                    tag
                  )
                    .trim()
                    .toLowerCase()
              )
              .filter(Boolean)
          ),
        ];
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────

module.exports =
  mongoose.model(
    "FoodItem",
    foodItemSchema
  );