"use strict";

const DietProgress = require("../nutrition/dietProgress.model");
const DietPlan = require("../nutrition/dietPlan.model");

const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

const MAX_NOTES_LENGTH = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// DATE / TIMEZONE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a calendar date in exactly:
 *
 * YYYY-MM-DD
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

  return (
    date.toISOString().slice(
      0,
      10
    ) === value
  );
}

/**
 * Get a validated IANA timezone from the request.
 *
 * Mobile frontend should send:
 *
 * X-Timezone: Asia/Kolkata
 */
function getRequestTimezone(req) {
  const timezone =
    req.headers[
      "x-timezone"
    ];

  if (
    typeof timezone !==
      "string" ||
    !timezone.trim()
  ) {
    return "UTC";
  }

  try {
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          timezone,
      }
    ).format();

    return timezone;
  } catch {
    return "UTC";
  }
}

/**
 * Return today's date according to the user's timezone.
 *
 * Example:
 *
 * UTC:
 *   2026-08-20 18:45
 *
 * India:
 *   2026-08-20 00:15
 *
 * These can belong to different calendar days.
 */
function todayStr(
  timezone = "UTC"
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(
    new Date()
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normalizeMealType(
  mealType
) {
  const value =
    String(
      mealType || ""
    )
      .trim()
      .toLowerCase();

  /*
   * The DietPlan representation is singular:
   *
   * snack
   *
   * Some older frontend code may send:
   *
   * snacks
   */
  if (
    value === "snacks"
  ) {
    return "snack";
  }

  return value;
}

function normalizeMealsCompleted(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !==
      "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const normalized = {};

  /*
   * Only accept known meal types.
   *
   * This prevents arbitrary client-controlled keys from
   * being persisted into the MongoDB document.
   */
  for (
    const mealType of MEAL_TYPES
  ) {
    normalized[
      mealType
    ] = false;
  }

  for (
    const [
      key,
      valueForMeal,
    ] of Object.entries(
      value
    )
  ) {
    const normalizedKey =
      normalizeMealType(
        key
      );

    if (
      !MEAL_TYPES.includes(
        normalizedKey
      )
    ) {
      continue;
    }

    /*
     * We intentionally coerce only booleans.
     *
     * "false" should not become true just because it's a
     * non-empty string.
     */
    if (
      typeof valueForMeal ===
      "boolean"
    ) {
      normalized[
        normalizedKey
      ] = valueForMeal;
    } else if (
      valueForMeal ===
        1 ||
      valueForMeal ===
        "1"
    ) {
      normalized[
        normalizedKey
      ] = true;
    } else if (
      valueForMeal ===
        0 ||
      valueForMeal ===
        "0"
    ) {
      normalized[
        normalizedKey
      ] = false;
    }
  }

  return normalized;
}

function toNonNegativeNumber(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    number
  );
}

function validateWeight(
  value
) {
  const weight =
    Number(value);

  if (
    !Number.isFinite(
      weight
    ) ||
    weight <= 0 ||
    weight > 500
  ) {
    return null;
  }

  return weight;
}

function normalizeNotes(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return String(
    value
  ).trim().slice(
    0,
    MAX_NOTES_LENGTH
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CALORIE CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate calories from the meals that are currently marked
 * completed.
 *
 * IMPORTANT:
 *
 * We calculate only from the meal slots that are true.
 *
 * Example:
 *
 * breakfast = true  → +500
 * lunch     = true  → +700
 * dinner    = false
 *
 * total = 1200
 */
function calculateCompletedPlanCalories(
  plan,
  mealsCompleted
) {
  if (
    !plan?.meals ||
    !mealsCompleted
  ) {
    return 0;
  }

  let total = 0;

  for (
    const mealType of MEAL_TYPES
  ) {
    if (
      !mealsCompleted[
        mealType
      ]
    ) {
      continue;
    }

    const mealArr =
      plan.meals[
        mealType
      ];

    if (
      !Array.isArray(
        mealArr
      )
    ) {
      continue;
    }

    for (
      const combo of mealArr
    ) {
      const calories =
        Number(
          combo?.calories
        );

      if (
        Number.isFinite(
          calories
        ) &&
        calories > 0
      ) {
        total +=
          calories;
      }
    }
  }

  return Math.round(
    total
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /nutrition/log
// ─────────────────────────────────────────────────────────────────────────────

const logDailyDiet = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.id;

    const {
      date,
      mealsCompleted,
      caloriesConsumed,
      weight,
      notes,
    } = req.body;

    // ────────────────────────────────────────────────────────────────────────
    // DATE
    // ────────────────────────────────────────────────────────────────────────

    const timezone =
      getRequestTimezone(
        req
      );

    const logDate =
      date ||
      todayStr(
        timezone
      );

    if (
      !isValidDateKey(
        logDate
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid date. Expected YYYY-MM-DD.",
        });
    }

    // ────────────────────────────────────────────────────────────────────────
    // MEAL COMPLETION
    // ────────────────────────────────────────────────────────────────────────

    let normalizedMeals =
      null;

    if (
      mealsCompleted !==
      undefined &&
      mealsCompleted !==
        null
    ) {
      normalizedMeals =
        normalizeMealsCompleted(
          mealsCompleted
        );

      if (
        !normalizedMeals
      ) {
        return res
          .status(400)
          .json({
            message:
              "mealsCompleted must be an object containing boolean meal states.",
          });
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // FIND ACTIVE PLAN WHEN NEEDED
    // ────────────────────────────────────────────────────────────────────────

    let activePlan =
      null;

    if (
      normalizedMeals
    ) {
      activePlan =
        await DietPlan.findOne(
          {
            user:
              userId,

            isActive:
              true,
          }
        )
          .select(
            "meals targetCalories summary"
          )
          .lean();
    }

    // ────────────────────────────────────────────────────────────────────────
    // CALORIES
    // ────────────────────────────────────────────────────────────────────────

    let resolvedCalories =
      null;

    let caloriesSource =
      "none";

    /*
     * If the client explicitly supplied calories, validate them
     * and respect the manual value.
     *
     * This is useful when the user ate something different from
     * the planned meal.
     */
    if (
      caloriesConsumed !==
        undefined &&
      caloriesConsumed !==
        null
    ) {
      const manualCalories =
        toNonNegativeNumber(
          caloriesConsumed
        );

      if (
        manualCalories ===
        null
      ) {
        return res
          .status(400)
          .json({
            message:
              "caloriesConsumed must be a valid non-negative number.",
          });
      }

      if (
        manualCalories >
        20000
      ) {
        return res
          .status(400)
          .json({
            message:
              "caloriesConsumed is unrealistically high.",
          });
      }

      resolvedCalories =
        Math.round(
          manualCalories
        );

      caloriesSource =
        "manual";
    } else if (
      normalizedMeals
    ) {
      /*
       * No manual calorie override:
       * calculate from the active plan.
       */
      resolvedCalories =
        calculateCompletedPlanCalories(
          activePlan,
          normalizedMeals
        );

      caloriesSource =
        activePlan
          ? "plan"
          : "none";
    }

    // ────────────────────────────────────────────────────────────────────────
    // WEIGHT
    // ────────────────────────────────────────────────────────────────────────

    let normalizedWeight =
      null;

    if (
      weight !==
        undefined &&
      weight !==
        null
    ) {
      normalizedWeight =
        validateWeight(
          weight
        );

      if (
        normalizedWeight ===
        null
      ) {
        return res
          .status(400)
          .json({
            message:
              "Weight must be a valid value between 0 and 500 kg.",
          });
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // NOTES
    // ────────────────────────────────────────────────────────────────────────

    const normalizedNotes =
      normalizeNotes(
        notes
      );

    // ────────────────────────────────────────────────────────────────────────
    // BUILD UPDATE
    // ────────────────────────────────────────────────────────────────────────

    const update = {};

    if (
      normalizedMeals !==
      null
    ) {
      update.mealsCompleted =
        normalizedMeals;
    }

    if (
      resolvedCalories !==
      null
    ) {
      update.caloriesConsumed =
        resolvedCalories;
    }

    if (
      normalizedWeight !==
      null
    ) {
      update.weight =
        normalizedWeight;
    }

    if (
      normalizedNotes !==
      null
    ) {
      update.notes =
        normalizedNotes;
    }

    /*
     * If nothing useful was supplied, don't create an empty
     * progress record.
     */
    if (
      Object.keys(
        update
      ).length === 0
    ) {
      return res
        .status(400)
        .json({
          message:
            "At least one progress field is required.",
        });
    }

    // ────────────────────────────────────────────────────────────────────────
    // UPSERT
    // ────────────────────────────────────────────────────────────────────────

    const log =
      await DietProgress.findOneAndUpdate(
        {
          user:
            userId,

          date:
            logDate,
        },
        {
          $set:
            update,
        },
        {
          new: true,

          upsert: true,

          setDefaultsOnInsert:
            true,

          runValidators:
            true,
        }
      );

    res.json({
      ...log.toObject(),

      date:
        logDate,

      timezone,

      caloriesSource,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /nutrition/log
// ─────────────────────────────────────────────────────────────────────────────

const getDailyDietLog = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.id;

    const timezone =
      getRequestTimezone(
        req
      );

    const date =
      req.query.date ||
      todayStr(
        timezone
      );

    if (
      !isValidDateKey(
        date
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid date. Expected YYYY-MM-DD.",
        });
    }

    const [
      log,
      plan,
    ] =
      await Promise.all([
        DietProgress.findOne(
          {
            user:
              userId,

            date,
          }
        ).lean(),

        DietPlan.findOne(
          {
            user:
              userId,

            isActive:
              true,
          }
        )
          .select(
            "meals summary targetCalories"
          )
          .lean(),
      ]);

    // ────────────────────────────────────────────────────────────────────────
    // BUILD PER-MEAL CONTEXT
    // ────────────────────────────────────────────────────────────────────────

    const mealContext =
      {};

    if (
      plan?.meals
    ) {
      for (
        const mealType of MEAL_TYPES
      ) {
        const combos =
          Array.isArray(
            plan.meals[
              mealType
            ]
          )
            ? plan.meals[
                mealType
              ]
            : [];

        const plannedCalories =
          combos.reduce(
            (
              sum,
              combo
            ) => {
              const calories =
                Number(
                  combo?.calories
                );

              if (
                !Number.isFinite(
                  calories
                ) ||
                calories < 0
              ) {
                return sum;
              }

              return (
                sum +
                calories
              );
            },
            0
          );

        mealContext[
          mealType
        ] = {
          plannedCalories:
            Math.round(
              plannedCalories
            ),

          mealName:
            combos[0]
              ?.mealName ||
            null,

          completed:
            Boolean(
              log
                ?.mealsCompleted?.[
                mealType
              ]
            ),
        };
      }
    }

    const targetCalories =
      plan
        ? Number(
            plan.summary
              ?.targetCalories ??
              plan.targetCalories
          )
        : null;

    res.json({
      date,

      timezone,

      log:
        log || null,

      plan: plan
        ? {
            targetCalories:
              Number.isFinite(
                targetCalories
              )
                ? targetCalories
                : null,

            mealContext,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  logDailyDiet,

  getDailyDietLog,
};