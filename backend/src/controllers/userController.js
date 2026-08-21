"use strict";

const logger = require("../config/logger");

const User = require(
  "../models/User"
);

const HealthProfile =
  require(
    "../modules/health/health.model"
  );

const {
  mapUserGoalToHealthGoal,
} = require(
  "../modules/health/health.service"
);

/**
 * GET PROFILE
 */
const getProfile =
  async (
    req,
    res
  ) => {
    /*
     * req.user is already populated by authMiddleware.
     *
     * Password is excluded by the middleware query.
     */
    return res
      .status(200)
      .json(req.user);
  };

/**
 * UPDATE USER GOAL
 *
 * User-facing goals:
 *
 *   bulk
 *   lean
 *   fit
 *
 * Health-profile goals:
 *
 *   gain
 *   lose
 *   maintain
 *
 * They are intentionally mapped instead of writing the
 * UI value directly into the HealthProfile enum.
 */
const updateGoal =
  async (
    req,
    res
  ) => {
    try {
      const goal =
        String(
          req.body.goal || ""
        )
          .trim()
          .toLowerCase();

      const userId =
        req.user.id;

      const validGoals = [
        "bulk",
        "lean",
        "fit",
      ];

      if (
        !validGoals.includes(
          goal
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid goal. Use bulk, lean or fit.",
        });
      }

      /*
       * Update the User-level goal.
       */
      req.user.goal =
        goal;

      await req.user.save();

      /*
       * Map it to the health engine's representation.
       */
      const healthGoal =
        mapUserGoalToHealthGoal(
          goal
        );

      /*
       * Only update an existing health profile.
       *
       * We do NOT create an incomplete profile here because
       * the health profile requires age, height, weight,
       * gender, activity level and diet type.
       */
      const healthProfile =
        await HealthProfile.findOne({
          user: userId,
        });

      if (healthProfile) {
        healthProfile.goal =
          healthGoal;

        /*
         * Recalculate the calorie/macronutrient values.
         *
         * We intentionally load the health service here rather
         * than simply changing the goal and leaving stale
         * calorie targets in MongoDB.
         */
        const {
          generateCalorieProfile,
        } = require(
          "../modules/health/health.service"
        );

        const calorieData =
          generateCalorieProfile({
            age:
              healthProfile.age,

            gender:
              healthProfile.gender,

            height:
              healthProfile.height,

            weight:
              healthProfile.weight,

            activityLevel:
              healthProfile.activityLevel,

            goal:
              healthGoal,

            dietType:
              healthProfile.dietType,
          });

        healthProfile.bmr =
          calorieData.bmr;

        healthProfile.maintenanceCalories =
          calorieData.maintenanceCalories;

        healthProfile.targetCalories =
          calorieData.targetCalories;

        healthProfile.activeCalorieGoal =
          calorieData.activeCalorieGoal;

        healthProfile.proteinTarget =
          calorieData.proteinTarget;

        healthProfile.carbTarget =
          calorieData.carbTarget;

        healthProfile.fatTarget =
          calorieData.fatTarget;

        await healthProfile.save();
      }

      return res
        .status(200)
        .json({
          message:
            "Goal updated successfully",

          goal:
            req.user.goal,

          healthGoal,
        });
    } catch (error) {
      logger.error(
        { err: error },
        "Update goal error"
      );

      return res.status(500).json({
        message:
          "Failed to update goal",
      });
    }
  };

/**
 * REGISTER PUSH TOKEN
 */
const registerPushToken =
  async (
    req,
    res
  ) => {
    try {
      const pushToken =
        String(
          req.body.pushToken ||
            ""
        ).trim();

      if (
        !pushToken
      ) {
        return res.status(400).json({
          message:
            "pushToken is required",
        });
      }

      /*
       * Expo push tokens are reasonably short but should
       * still have a hard upper bound.
       */
      if (
        pushToken.length >
        500
      ) {
        return res.status(400).json({
          message:
            "Invalid push token",
        });
      }

      req.user.pushToken =
        pushToken;

      await req.user.save();

      return res
        .status(200)
        .json({
          message:
            "Push token registered",
        });
    } catch (error) {
      logger.error(
        { err: error },
        "Register push token error"
      );

      return res.status(500).json({
        message:
          "Failed to register push token",
      });
    }
  };

module.exports = {
  getProfile,
  updateGoal,
  registerPushToken,
};