"use strict";

const HealthProfile = require("./health.model");

const {
  generateCalorieProfile,
  mapUserGoalToHealthGoal,
} = require("./health.service");

const ALLOWED_HEALTH_FIELDS = [
  "age",
  "gender",
  "height",
  "weight",
  "activityLevel",
  "goal",
  "dietType",
  "diseases",
  "allergies",
];

/**
 * Only copy fields that are explicitly allowed from req.body.
 *
 * Never allow the client to submit:
 *
 * user
 * bmr
 * maintenanceCalories
 * targetCalories
 * activeCalorieGoal
 * proteinTarget
 * carbTarget
 * fatTarget
 */
function pickAllowedFields(
  body = {}
) {
  const result = {};

  for (const key of ALLOWED_HEALTH_FIELDS) {
    if (
      body[key] !== undefined
    ) {
      result[key] =
        body[key];
    }
  }

  return result;
}

/**
 * Normalize array fields.
 */
function normalizeArray(
  value
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) =>
          String(item)
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    ),
  ];
}

/**
 * Create or update the user's health profile.
 *
 * POST:
 *   Requires a complete profile because no existing
 *   profile is assumed.
 *
 * PUT:
 *   Allows partial updates because the route validation
 *   already permits partial fields.
 */
exports.createOrUpdateHealthProfile =
  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        req.user.id;

      const incoming =
        pickAllowedFields(
          req.body
        );

      /*
       * Fetch existing profile.
       */
      const existing =
        await HealthProfile.findOne({
          user: userId,
        }).lean();

      /*
       * Merge old and new values.
       *
       * This is necessary for PUT requests where the
       * user changes only one field, such as weight.
       */
      const merged = {
        ...(existing || {}),
        ...incoming,
      };

      const validHealthGoals = [
  "lose",
  "maintain",
  "gain",
];

if (
  !validHealthGoals.includes(merged.goal)
) {
  const mappedGoal =
    mapUserGoalToHealthGoal(
      merged.goal
    ) ||
    mapUserGoalToHealthGoal(
      req.user.goal
    );

  if (mappedGoal) {
    merged.goal = mappedGoal;
  }
}

      /*
       * Normalize arrays before calculation/storage.
       */
      if (
        merged.diseases !==
        undefined
      ) {
        merged.diseases =
          normalizeArray(
            merged.diseases
          );
      }

      if (
        merged.allergies !==
        undefined
      ) {
        merged.allergies =
          normalizeArray(
            merged.allergies
          );
      }

      /*
       * The controller should never try to calculate
       * a profile without the required fields.
       */
      const requiredFields = [
        "age",
        "gender",
        "height",
        "weight",
        "activityLevel",
        "goal",
        "dietType",
      ];

      const missingFields =
        requiredFields.filter(
          (field) =>
            merged[field] ===
              undefined ||
            merged[field] ===
              null ||
            merged[field] === ""
        );

      if (
        missingFields.length
      ) {
        return res.status(400).json({
          message:
            "Incomplete health profile",
          missingFields,
        });
      }

      /*
       * Recalculate all derived values.
       *
       * The client can never provide its own BMR/macros/
       * targetCalories and have them trusted.
       */
      const calorieData =
        generateCalorieProfile(
          merged
        );

      /*
       * Keep the ownership field server-controlled.
       */
      const updateData = {
        ...incoming,

        diseases:
          merged.diseases || [],

        allergies:
          merged.allergies || [],

        /*
         * Always use the canonical HealthProfile goal.
         */
        goal: merged.goal,

        ...calorieData,
      };

      const profile =
        await HealthProfile.findOneAndUpdate(
          {
            user: userId,
          },
          {
            $set: updateData,

            /*
             * Explicitly restore ownership on upsert.
             */
            $setOnInsert: {
              user: userId,
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        );

      return res
        .status(existing ? 200 : 201)
        .json(profile);
    } catch (error) {
      next(error);
    }
  };

/**
 * GET health profile.
 */
exports.getHealthProfile =
  async (
    req,
    res,
    next
  ) => {
    try {
      const userId =
        req.user.id;

      const profile =
        await HealthProfile.findOne({
          user: userId,
        });

      if (!profile) {
        return res.status(404).json({
          message:
            "Health profile not found",
        });
      }

      return res
        .status(200)
        .json(profile);
    } catch (error) {
      next(error);
    }
  };