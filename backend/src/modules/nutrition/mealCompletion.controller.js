"use strict";

const DietProgress = require("../nutrition/dietProgress.model");
const DietPlan = require("../nutrition/dietPlan.model");
const MealLog = require("../nutrition/mealLog.model");
const { awardXp } = require("../social/gamification.service");

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

async function getUtcDayRangeForRequest(dateKey, timezone) {
  const targetDate = new Date(`${dateKey}T00:00:00Z`);
  let candidate = targetDate;
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(candidate);
    const map = {};
    for (const part of parts) map[part.type] = part.value;
    const actualLocal = Date.UTC(
      Number(map.year), Number(map.month) - 1, Number(map.day),
      Number(map.hour), Number(map.minute), Number(map.second)
    );
    const desiredLocal = Date.UTC(
      Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1,
      Number(dateKey.slice(8, 10)), 0, 0, 0
    );
    candidate = new Date(candidate.getTime() + (desiredLocal - actualLocal));
  }
  return { start: candidate, end: new Date(candidate.getTime() + 24 * 60 * 60 * 1000) };
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
    // CALORIES + DIET-PLAN QUICK MEAL LOGS
    // ────────────────────────────────────────────────────────────────────────

    let resolvedCalories = null;
    let caloriesSource = "none";

    /*
     * One source of truth:
     *
     *   MealLog = actual calories eaten
     *
     * Completing a plan meal creates a `diet_plan` MealLog placeholder.
     * Later, a manual/photo entry for that meal deletes the placeholder
     * first, so the user never gets double-counted.
     */
    if (normalizedMeals) {
      const { start, end } = await getUtcDayRangeForRequest(logDate, timezone);

      const existingLogs = await MealLog.find({
        user: userId,
        loggedAt: { $gte: start, $lt: end },
      })
        .select("mealType source")
        .lean();

      for (const mealType of MEAL_TYPES) {
        const logMealType = mealType === "snack" ? "snacks" : mealType;
        const slotCompleted = Boolean(normalizedMeals[mealType]);

        const hasActualLog = existingLogs.some(
          (entry) =>
            entry.mealType === logMealType &&
            (entry.source === "manual" || entry.source === "photo")
        );

        if (!slotCompleted || hasActualLog) {
          await MealLog.deleteMany({
            user: userId,
            mealType: logMealType,
            source: "diet_plan",
            loggedAt: { $gte: start, $lt: end },
          });
          continue;
        }

        const mealArr = Array.isArray(activePlan?.meals?.[mealType])
          ? activePlan.meals[mealType]
          : [];

        if (!mealArr.length) continue;

        const sourceKey = `${activePlan._id}:${mealType}`;

        const calories = Math.round(
          mealArr.reduce((sum, combo) => sum + (Number(combo?.calories) > 0 ? Number(combo.calories) : 0), 0)
        );
        const protein = Number(
          mealArr.reduce((sum, combo) => sum + (Number(combo?.protein) > 0 ? Number(combo.protein) : 0), 0).toFixed(1)
        );
        const carbs = Number(
          mealArr.reduce((sum, combo) => sum + (Number(combo?.carbs) > 0 ? Number(combo.carbs) : 0), 0).toFixed(1)
        );
        const fats = Number(
          mealArr.reduce((sum, combo) => sum + (Number(combo?.fats) > 0 ? Number(combo.fats) : 0), 0).toFixed(1)
        );

        await MealLog.findOneAndUpdate(
          {
            user: userId,
            source: "diet_plan",
            sourceKey,
            loggedAt: { $gte: start, $lt: end },
          },
          {
            $set: {
              mealType: logMealType,
              food: {
                name: String(mealArr[0]?.mealName || `${mealType} from diet plan`).trim(),
                brand: "",
                quantity: 1,
                unit: "serving",
                calories,
                protein,
                carbs,
                fats,
                fiber: 0,
                sugar: 0,
                sodium: 0,
              },
              loggedAt: start,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );
      }

      const mealLogs = await MealLog.find({
        user: userId,
        loggedAt: { $gte: start, $lt: end },
      })
        .select("mealType food.calories source")
        .lean();

      const actualCalories = mealLogs.reduce(
        (sum, item) => sum + (Number(item.food?.calories) > 0 ? Number(item.food.calories) : 0),
        0
      );

      resolvedCalories = Math.round(actualCalories);
      caloriesSource = mealLogs.some((item) => item.source === "diet_plan")
        ? mealLogs.some((item) => item.source === "manual" || item.source === "photo")
          ? "mixed"
          : "plan"
        : actualCalories > 0
          ? "logged"
          : "none";
    } else if (caloriesConsumed !== undefined && caloriesConsumed !== null) {
      const manualCalories = toNonNegativeNumber(caloriesConsumed);
      if (manualCalories === null) {
        return res.status(400).json({
          message: "caloriesConsumed must be a valid non-negative number.",
        });
      }
      if (manualCalories > 20000) {
        return res.status(400).json({
          message: "caloriesConsumed is unrealistically high.",
        });
      }
      resolvedCalories = Math.round(manualCalories);
      caloriesSource = "manual";
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

    if (resolvedCalories !== null) {
      update.caloriesConsumed = resolvedCalories;
      update.quickMealCalories = {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        snack: 0,
      };
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

    if (resolvedCalories > 0) {
      awardXp(
        userId,
        "mealLogged",
        `meal-log:${logDate}`,
        { calories: resolvedCalories }
      ).catch(() => {});
    }

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