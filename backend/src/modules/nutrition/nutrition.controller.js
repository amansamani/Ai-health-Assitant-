"use strict";

const logger = require("../../config/logger");

const HealthProfile = require("../health/health.model");
const DietPlan = require("./dietPlan.model");
const DietProgress = require("./dietProgress.model");
const MealLog = require("./mealLog.model");
const FoodItem = require("./foodItem.model");

const {
  analyzeMealPhoto,
} = require("./mealPhoto.service");

const {
  generateDietPlan,
  getTemplateMealSwaps,
  getTemplate,
  runSmartWeeklyAdjustment,
  getLatestWeeklyInsight,
  getWeeklyInsightHistory,
  isMealAllowed,
  normalizeGoal,
  scaleMealToCalories,
} = require("./nutrition.service");

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

const MAX_FOOD_LIMIT = 50;
const MAX_HISTORY_DAYS = 90;

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isValidObjectId(value) {
  return /^[a-f\d]{24}$/i.test(
    String(value || "")
  );
}

function normalizeMealType(value) {
  const normalized = String(
    value || ""
  )
    .trim()
    .toLowerCase();

  /*
   * The database uses "snacks", while DietPlan uses "snack".
   *
   * Normalize requests to the DietPlan representation first.
   */
  if (
    normalized === "snacks"
  ) {
    return "snack";
  }

  return normalized;
}

function normalizeLogMealType(value) {
  const normalized =
    normalizeMealType(value);

  return normalized === "snack"
    ? "snacks"
    : normalized;
}

function isValidMealType(value) {
  return MEAL_TYPES.includes(
    normalizeMealType(value)
  );
}

/**
 * Only accept:
 *
 * YYYY-MM-DD
 *
 * This avoids Date.parse() accepting values such as:
 *
 * 08/20/2026
 * Aug 20 2026
 * 20 Aug 2026
 *
 * which can create inconsistent daily records.
 */
function isValidDateKey(value) {
  if (
    typeof value !==
      "string" ||
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
 * Get the timezone sent by the mobile app.
 *
 * Example:
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
    /*
     * Validate IANA timezone.
     */
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
 * Get the user's current calendar date in their timezone.
 */
function getTodayDateKey(
  timezone
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
  ).format(new Date());
}

/**
 * Convert a local date key + timezone to UTC boundaries.
 *
 * This is used for MealLog because MealLog stores loggedAt as
 * a Date, while the user thinks in calendar days.
 */
function getUtcDayRange(
  dateKey,
  timezone
) {
  /*
   * Find the UTC instant corresponding approximately to
   * the requested local midnight.
   *
   * We then use Intl formatting to verify the local date.
   */
  const targetDate =
    new Date(
      `${dateKey}T00:00:00Z`
    );

  /*
   * Start with the UTC candidate and iteratively correct
   * the timezone offset.
   */
  let candidate =
    targetDate;

  for (
    let i = 0;
    i < 3;
    i += 1
  ) {
    const parts =
      new Intl.DateTimeFormat(
        "en-US",
        {
          timeZone:
            timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }
      ).formatToParts(
        candidate
      );

    const map = {};

    for (
      const part of parts
    ) {
      map[part.type] =
        part.value;
    }

    const actualLocal =
      Date.UTC(
        Number(map.year),
        Number(map.month) -
          1,
        Number(map.day),
        Number(map.hour),
        Number(map.minute),
        Number(map.second)
      );

    const desiredLocal =
      Date.UTC(
        Number(
          dateKey.slice(
            0,
            4
          )
        ),
        Number(
          dateKey.slice(
            5,
            7
          )
        ) - 1,
        Number(
          dateKey.slice(
            8,
            10
          )
        ),
        0,
        0,
        0
      );

    const offset =
      actualLocal -
      candidate.getTime();

    candidate = new Date(
      desiredLocal -
        offset
    );
  }

  const start =
    candidate;

  const end =
    new Date(
      start.getTime() +
        24 *
          60 *
          60 *
          1000
    );

  return {
    start,
    end,
  };
}

/**
 * Clamp numeric nutrition values.
 */
function nonNegativeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return fallback;
  }

  return Math.max(
    0,
    number
  );
}

function clampInteger(
  value,
  min,
  max,
  fallback
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      min,
      Math.round(number)
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN GENERATION
// ─────────────────────────────────────────────────────────────────────────────

const generatePlan = async (
  req,
  res,
  next
) => {
  try {
    const userId =
      req.user.id;

    const profile =
      await HealthProfile.findOne(
        {
          user: userId,
        }
      );

    if (!profile) {
      return res.status(400).json(
        {
          message:
            "Health profile not found",
        }
      );
    }

    /*
     * IMPORTANT:
     *
     * DO NOT:
     *
     *   delete profile.targetCalories
     *
     * The weekly adjustment system deliberately stores an
     * adaptive targetCalories on the health profile.
     *
     * generateDietPlan() now preserves that value.
     */
    profile.goal =
      normalizeGoal(
        profile.goal
      );

    const {
      meals,
      summary,
    } =
      await generateDietPlan(
        profile
      );

    /*
     * Deactivate the previous plan.
     */
    await DietPlan.updateMany(
      {
        user: userId,
        isActive: true,
      },
      {
        $set: {
          isActive: false,
        },
      }
    );

    const latest =
      await DietPlan.findOne({
        user: userId,
      }).sort({
        version: -1,
      });

    const version =
      latest
        ? latest.version + 1
        : 1;

    const newPlan =
      await DietPlan.create({
        user: userId,

        version,

        targetCalories:
          summary.targetCalories,

        // macroSplit stores the canonical protein/carbs/fats keys
        // (see dietPlan.model.js macroSplitSchema) — summary.macroTargets
        // uses proteinG/carbsG/fatsG, so it must be remapped here rather
        // than passed straight through.
        macroSplit: {
          protein:
            summary.macroTargets.proteinG,
          carbs:
            summary.macroTargets.carbsG,
          fats:
            summary.macroTargets.fatsG,
        },

        meals,

        summary,

        isActive: true,
      });

    res
      .status(201)
      .json(
        newPlan
      );
  } catch (err) {
    logger.error(
      {
        err,
        userId:
          req.user?.id,
      },
      "generatePlan error"
    );

    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CURRENT PLAN
// ─────────────────────────────────────────────────────────────────────────────

const getCurrentPlan = async (
  req,
  res,
  next
) => {
  try {
    const plan =
      await DietPlan.findOne(
        {
          user:
            req.user.id,

          isActive:
            true,
        }
      );

    res
      .status(200)
      .json(
        plan || null
      );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY DAILY DIET LOGGER
// ─────────────────────────────────────────────────────────────────────────────
//
// NOTE:
// nutrition.routes.js currently imports logDailyDiet from
// mealCompletion.controller.js.
//
// This function is retained for backwards compatibility if
// another route imports it directly.
// ─────────────────────────────────────────────────────────────────────────────

const logDailyDiet = async (
  req,
  res,
  next
) => {
  try {
    const {
      date,
      mealsCompleted,
      caloriesConsumed,
      weight,
      notes,
    } = req.body;

    const timezone =
      getRequestTimezone(
        req
      );

    const logDate =
      date ||
      getTodayDateKey(
        timezone
      );

    if (
      !isValidDateKey(
        logDate
      )
    ) {
      return res.status(400).json(
        {
          message:
            "Invalid date. Expected YYYY-MM-DD.",
        }
      );
    }

    const update = {};

    if (
      mealsCompleted !==
      undefined
    ) {
      update.mealsCompleted =
        mealsCompleted;
    }

    if (
      caloriesConsumed !==
      undefined
    ) {
      update.caloriesConsumed =
        nonNegativeNumber(
          caloriesConsumed
        );
    }

    if (
      weight !==
      undefined
    ) {
      const normalizedWeight =
        nonNegativeNumber(
          weight
        );

      if (
        normalizedWeight <=
        0
      ) {
        return res.status(400).json(
          {
            message:
              "Weight must be greater than zero.",
          }
        );
      }

      update.weight =
        normalizedWeight;
    }

    if (
      notes !==
      undefined
    ) {
      update.notes =
        String(
          notes
        ).slice(
          0,
          1000
        );
    }

    const log =
      await DietProgress.findOneAndUpdate(
        {
          user:
            req.user.id,

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
        }
      );

    res.json(
      log
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SWAP OPTIONS
// ─────────────────────────────────────────────────────────────────────────────

const getSwapOptions =
  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        mealType,
        excludeId,
      } = req.query;

      const normalizedMealType =
        normalizeMealType(
          mealType
        );

      if (
        !isValidMealType(
          normalizedMealType
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid mealType. Use breakfast, lunch, dinner, or snack.",
          });
      }

     const profile =
  await HealthProfile.findOne({
    user: req.user.id,
  }).lean();

      if (!profile) {
        return res
          .status(400)
          .json({
            message:
              "Health profile not found",
          });
      }

      const plan =
        await DietPlan.findOne(
          {
            user:
              req.user.id,

            isActive:
              true,
          }
        ).lean();

      /*
       * Use the actual meal calorie budget from the active plan
       * rather than asking the service to guess.
       */
      const targetMealCals =
        plan
          ? Number(
              plan.targetCalories
            ) *
            (
              CALORIE_SPLIT[
                normalizedMealType
              ] || 0.25
            )
          : null;

      const options =
        await getTemplateMealSwaps(
          normalizedMealType,

          normalizeGoal(
            profile.goal
          ),

          profile.dietType,

          excludeId ||
            null,

          targetMealCals,

          profile
        );

      res.json({
        data:
          options,
      });
    } catch (err) {
      next(err);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// SWAP MEAL
// ─────────────────────────────────────────────────────────────────────────────

const swapFood = async (
  req,
  res,
  next
) => {
  try {
    const {
      mealType,
      newMealId,
    } = req.body;

    const normalizedMealType =
      normalizeMealType(
        mealType
      );

    if (
      !isValidMealType(
        normalizedMealType
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid mealType.",
        });
    }

    if (
      !newMealId ||
      typeof newMealId !==
        "string"
    ) {
      return res
        .status(400)
        .json({
          message:
            "mealType and newMealId required",
        });
    }

    const plan =
      await DietPlan.findOne(
        {
          user:
            req.user.id,

          isActive:
            true,
        }
      );

    if (!plan) {
      return res
        .status(404)
        .json({
          message:
            "No active plan found",
        });
    }

    const profile =
      await HealthProfile.findOne(
        {
          user:
            req.user.id,
        }
      );

    if (!profile) {
      return res
        .status(400)
        .json({
          message:
            "Health profile not found",
        });
    }

    const allMeals =
      await getTemplate();

    const newCombo =
      allMeals.find(
        (meal) =>
          String(
            meal.id
          ) ===
          String(
            newMealId
          )
      );

    if (!newCombo) {
      return res
        .status(404)
        .json({
          message:
            "Meal template not found",
        });
    }

    /*
     * CRITICAL SECURITY / SAFETY CHECK
     *
     * Never trust the frontend to decide whether a meal is
     * compatible with the user's diet.
     */
    if (
      !isMealAllowed(
        newCombo,
        profile
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "This meal is not compatible with your diet or allergy restrictions.",
        });
    }

    const calBudget =
      Number(
        plan.targetCalories
      ) *
      (
        CALORIE_SPLIT[
          normalizedMealType
        ] || 0.25
      );

    if (
      !Number.isFinite(
        calBudget
      ) ||
      calBudget <= 0
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid calorie target in active plan.",
        });
    }

    /*
     * Reuse the same scaling logic as the nutrition service.
     *
     * This prevents the controller and service from having
     * two different implementations of meal scaling.
     */
    const scaled =
      scaleMealToCalories(
        newCombo,
        calBudget
      );

    /*
     * Final safety check after scaling as well.
     */
    if (
      !isMealAllowed(
        newCombo,
        profile
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Meal rejected by nutrition safety validation.",
        });
    }

    plan.meals[
      normalizedMealType
    ] = [scaled];

    // ── Recalculate plan totals ──────────────────────────────────────────────

    let totalCals = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFats = 0;
    let totalFiber = 0;

    for (
      const mealArr of Object.values(
        plan.meals
      )
    ) {
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
        totalCals +=
          nonNegativeNumber(
            combo.calories
          );

        totalProtein +=
          nonNegativeNumber(
            combo.protein
          );

        totalCarbs +=
          nonNegativeNumber(
            combo.carbs
          );

        totalFats +=
          nonNegativeNumber(
            combo.fats
          );

        totalFiber +=
          nonNegativeNumber(
            combo.fiber
          );
      }
    }

    if (
      !plan.summary
    ) {
      plan.summary = {};
    }

    plan.summary.plannedCalories =
      Math.round(
        totalCals
      );

    plan.summary.actualMacros =
      {
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
      };

    plan.markModified(
      "meals"
    );

    plan.markModified(
      "summary"
    );

    await plan.save();

    res.json(
      plan
    );
  } catch (err) {
    logger.error(
      {
        err,
        userId:
          req.user?.id,
      },
      "swapFood error"
    );

    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// FOOD SEARCH
// ─────────────────────────────────────────────────────────────────────────────

function escapeRegex(
  value
) {
  return String(
    value || ""
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

const getFoods = async (
  req,
  res,
  next
) => {
  try {
    const {
      search,
      q,
      tags,
      dietType,
      limit = 20,
    } = req.query;

    const searchTerm =
      search || q;

    const safeLimit =
      clampInteger(
        limit,
        1,
        MAX_FOOD_LIMIT,
        20
      );

    const query = {};

    if (
      searchTerm &&
      String(
        searchTerm
      ).trim()
    ) {
      /*
       * Escape regex metacharacters.
       *
       * Before:
       *
       *   ?search=.*
       *
       * could match essentially everything.
       *
       * Now the user's search is treated as literal text.
       */
      const escaped =
        escapeRegex(
          String(
            searchTerm
          ).trim()
        );

      query.name = {
        $regex:
          escaped,

        $options:
          "i",
      };
    }

    if (
      tags &&
      typeof tags ===
        "string"
    ) {
      const tagArr =
        tags
          .split(",")
          .map(
            (tag) =>
              tag.trim()
          )
          .filter(Boolean)
          .slice(0, 20);

      if (
        tagArr.length
      ) {
        query.tags = {
          $in:
            tagArr,
        };
      }
    }

    if (
      dietType &&
      typeof dietType ===
        "string"
    ) {
      const normalized =
        dietType
          .trim()
          .toLowerCase();

      if (
        ![
          "veg",
          "non-veg",
          "vegan",
        ].includes(
          normalized
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid dietType.",
          });
      }

      query.dietType =
        normalized;
    }

    const foods =
      await FoodItem.find(
        query
      )
        .limit(
          safeLimit
        )
        .lean();

    res.json({
      success:
        true,

      count:
        foods.length,

      data:
        foods,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL MEAL LOGGING
// ─────────────────────────────────────────────────────────────────────────────

const logMeal = async (
  req,
  res,
  next
) => {
  try {
    const {
      mealType,
      food,
    } = req.body;

    if (
      !mealType ||
      !food
    ) {
      return res
        .status(400)
        .json({
          message:
            "mealType and food are required",
        });
    }

    const normalizedMealType =
      normalizeLogMealType(
        mealType
      );

    if (
      ![
        "breakfast",
        "lunch",
        "dinner",
        "snacks",
      ].includes(
        normalizedMealType
      )
    ) {
      return res
        .status(400)
        .json({
          message:
            "Invalid mealType.",
        });
    }

    if (
      !food.name ||
      typeof food.name !==
        "string"
    ) {
      return res
        .status(400)
        .json({
          message:
            "food.name is required.",
        });
    }

    const quantity =
      nonNegativeNumber(
        food.quantity,
        100
      );

    if (
      quantity <= 0
    ) {
      return res
        .status(400)
        .json({
          message:
            "Food quantity must be greater than zero.",
        });
    }

    const log =
      await MealLog.create({
        user:
          req.user.id,

        mealType:
          normalizedMealType,

        food: {
          name:
            String(
              food.name
            ).trim(),

          brand:
            String(
              food.brand ||
                ""
            ).trim(),

          quantity,

          unit:
            food.unit ||
            "g",

          calories:
            nonNegativeNumber(
              food.calories
            ),

          protein:
            nonNegativeNumber(
              food.protein
            ),

          carbs:
            nonNegativeNumber(
              food.carbs
            ),

          fats:
            nonNegativeNumber(
              food.fats
            ),

          fiber:
            nonNegativeNumber(
              food.fiber
            ),

          sugar:
            nonNegativeNumber(
              food.sugar
            ),

          sodium:
            nonNegativeNumber(
              food.sodium
            ),
        },
      });

    res
      .status(201)
      .json({
        message:
          "Meal logged",

        data:
          log,
      });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TODAY MEAL LOG
// ─────────────────────────────────────────────────────────────────────────────

const getTodayLog =
  async (
    req,
    res,
    next
  ) => {
    try {
      const timezone =
        getRequestTimezone(
          req
        );

      const dateKey =
        getTodayDateKey(
          timezone
        );

      const {
        start,
        end,
      } =
        getUtcDayRange(
          dateKey,
          timezone
        );

      const logs =
        await MealLog.find(
          {
            user:
              req.user.id,

            loggedAt: {
              $gte:
                start,

              $lt:
                end,
            },
          }
        )
          .sort({
            loggedAt:
              -1,
          })
          .lean();

      const grouped = {
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: [],
      };

      for (
        const log of logs
      ) {
        if (
          grouped[
            log.mealType
          ]
        ) {
          grouped[
            log.mealType
          ].push(
            log
          );
        }
      }

      const totals =
        logs.reduce(
          (
            acc,
            log
          ) => ({
            calories:
              acc.calories +
              nonNegativeNumber(
                log.food
                  ?.calories
              ),

            protein:
              acc.protein +
              nonNegativeNumber(
                log.food
                  ?.protein
              ),

            carbs:
              acc.carbs +
              nonNegativeNumber(
                log.food?.carbs
              ),

            fats:
              acc.fats +
              nonNegativeNumber(
                log.food?.fats
              ),

            fiber:
              acc.fiber +
              nonNegativeNumber(
                log.food?.fiber
              ),
          }),
          {
            calories:
              0,

            protein:
              0,

            carbs:
              0,

            fats:
              0,

            fiber:
              0,
          }
        );

      res.json({
        date:
          dateKey,

        timezone,

        data:
          grouped,

        totals,

        count:
          logs.length,
      });
    } catch (err) {
      next(err);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY DAILY DIET GETTER
// ─────────────────────────────────────────────────────────────────────────────
//
// The real route currently uses mealCompletion.controller.js.
// This is kept as a safe fallback for direct imports.
// ─────────────────────────────────────────────────────────────────────────────

const getDailyDietLog =
  async (
    req,
    res,
    next
  ) => {
    try {
      const timezone =
        getRequestTimezone(
          req
        );

      const date =
        req.query.date ||
        getTodayDateKey(
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
                req.user.id,

              date,
            }
          ).lean(),

          DietPlan.findOne(
            {
              user:
                req.user.id,

              isActive:
                true,
            }
          )
            .select(
              "meals summary targetCalories"
            )
            .lean(),
        ]);

      const mealContext =
        {};

      if (
        plan?.meals
      ) {
        for (
          const mealType of MEAL_TYPES
        ) {
          const combos =
            plan.meals[
              mealType
            ] || [];

          const plannedCalories =
            combos.reduce(
              (
                sum,
                combo
              ) =>
                sum +
                nonNegativeNumber(
                  combo.calories
                ),
              0
            );

          mealContext[
            mealType
          ] = {
            plannedCalories,

            mealName:
              combos[0]
                ?.mealName ||
              null,

            completed:
              log
                ?.mealsCompleted?.[
                mealType
              ] ??
              false,
          };
        }
      }

      res.json({
        date,

        timezone,

        log:
          log ||
          null,

        plan: plan
          ? {
              targetCalories:
                plan.summary
                  ?.targetCalories ??
                plan.targetCalories,

              mealContext,
            }
          : null,
      });
    } catch (err) {
      next(err);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// DELETE MEAL
// ─────────────────────────────────────────────────────────────────────────────

const deleteMeal =
  async (
    req,
    res,
    next
  ) => {
    try {
      const id =
        req.params.id;

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid meal id",
          });
      }

      const log =
        await MealLog.findOneAndDelete(
          {
            _id:
              id,

            user:
              req.user.id,
          }
        );

      if (!log) {
        return res
          .status(404)
          .json({
            message:
              "Meal not found",
          });
      }

      res.json({
        message:
          "Meal deleted",

        data:
          log,
      });
    } catch (err) {
      next(err);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// MEAL HISTORY
// ─────────────────────────────────────────────────────────────────────────────

const getMealHistory =
  async (
    req,
    res,
    next
  ) => {
    try {
      const timezone =
        getRequestTimezone(
          req
        );

      const days =
        clampInteger(
          req.query.days,
          1,
          MAX_HISTORY_DAYS,
          7
        );

      const todayKey =
        getTodayDateKey(
          timezone
        );

      /*
       * Start from the beginning of the day `days - 1`
       * days ago.
       */
      const startDate =
        new Date(
          `${todayKey}T00:00:00Z`
        );

      startDate.setUTCDate(
        startDate.getUTCDate() -
          (days - 1)
      );

      const startDateKey =
        startDate
          .toISOString()
          .slice(
            0,
            10
          );

      const {
        start,
      } =
        getUtcDayRange(
          startDateKey,
          timezone
        );

      const logs =
        await MealLog.find(
          {
            user:
              req.user.id,

            loggedAt: {
              $gte:
                start,
            },
          }
        )
          .sort({
            loggedAt:
              -1,
          })
          .lean();

      res.json({
        success:
          true,

        days,

        timezone,

        count:
          logs.length,

        data:
          logs,
      });
    } catch (err) {
      next(err);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY ADJUSTMENT
// ─────────────────────────────────────────────────────────────────────────────

const runWeeklyAdjustment =
  async (
    req,
    res,
    next
  ) => {
    try {
      const result =
        await runSmartWeeklyAdjustment(
          req.user.id
        );

      res.json(
        result
      );
    } catch (err) {
      logger.error(
        {
          err,

          userId:
            req.user?.id,
        },
        "runWeeklyAdjustment error"
      );

      next(err);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// WEEKLY INSIGHTS
// ─────────────────────────────────────────────────────────────────────────────

const getWeeklyInsight =
  async (
    req,
    res,
    next
  ) => {
    try {
      const insight =
        await getLatestWeeklyInsight(
          req.user.id
        );

      res.json(
        insight ||
          null
      );
    } catch (err) {
      next(err);
    }
  };

const getWeeklyInsightLog =
  async (
    req,
    res,
    next
  ) => {
    try {
      const limit =
        clampInteger(
          req.query.limit,
          1,
          26,
          8
        );

      const history =
        await getWeeklyInsightHistory(
          req.user.id,
          limit
        );

      res.json(
        history
      );
    } catch (err) {
      next(err);
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// MEAL PHOTO ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

const analyzeMealPhotoCtrl =
  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        imageBase64,
        images,
        mimeType,
        hasReferenceObject,
      } = req.body;

      const imageList =
        Array.isArray(
          images
        ) &&
        images.length
          ? images
          : imageBase64
            ? [
                imageBase64,
              ]
            : [];

      if (
        imageList.length ===
        0
      ) {
        return res
          .status(400)
          .json({
            message:
              "At least one meal image is required.",
          });
      }

      const result =
        await analyzeMealPhoto(
          imageList,
          mimeType,
          {
            hasReferenceObject:
              Boolean(
                hasReferenceObject
              ),
          }
        );

      res.json(
        result
      );
    } catch (err) {
      logger.error(
        {
          err,
          userId:
            req.user?.id,
        },
        "Meal photo analysis error"
      );

      /*
       * The old implementation always returned 500.
       *
       * If the service explicitly supplies a useful client
       * error, preserve it.
       */
      const status =
        Number(
          err.statusCode ||
            err.status
        );

      if (
        Number.isInteger(
          status
        ) &&
        status >= 400 &&
        status < 500
      ) {
        return res
          .status(status)
          .json({
            message:
              err.message ||
              "Invalid meal photo request.",
          });
      }

      res
        .status(500)
        .json({
          message:
            "Failed to analyze meal photo. Try a clearer photo or log manually.",
        });
    }
  };

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  generatePlan,

  getCurrentPlan,

  /*
   * Kept for backwards compatibility.
   * The current route imports the newer implementation from
   * mealCompletion.controller.js.
   */
  logDailyDiet,

  getDailyDietLog,

  runWeeklyAdjustment,

  getWeeklyInsight,

  getWeeklyInsightLog,

  getSwapOptions,

  swapFood,

  logMeal,

  getTodayLog,

  deleteMeal,

  getMealHistory,

  getFoods,

  analyzeMealPhotoCtrl,
};