"use strict";

const logger = require(
  "../config/logger"
);

const DailyLog = require(
  "../models/DailyLog"
);

const User = require(
  "../models/User"
);
const HealthProfile = require(
  "../modules/health/health.model"
);

const {
  checkAndAwardStreakAchievements,
} = require(
  "../modules/social/achievement.service"
);

const { awardXp } = require(
  "../modules/social/gamification.service"
);

const {
  getDayRange,
  getRelativeDateKey,
  getDateKeyRange,
  getTimezone,
} = require(
  "../utils/date"
);

/**
 * Get today's local calendar range for the authenticated user.
 */
const getTodayRange = (
  req
) => {
  const timezone =
    getTimezone(req);

  const {
    start,
    end,
  } = getDayRange(
    new Date(),
    timezone
  );

  return {
    startOfToday: start,
    endOfToday: end,
    timezone,
  };
};

/**
 * Add estimated calories for today.
 *
 * IMPORTANT FIX:
 *
 * The old implementation attempted to use `req` inside this
 * helper even though `req` was not passed into the function.
 *
 * This function now:
 *
 *   1. receives userId
 *   2. optionally receives timezone
 *   3. falls back to the user's stored timezone
 *
 * This function is used by workoutController.js, which only
 * passes userId + calories.
 */
const addEstimatedCaloriesForToday =
  async (
    userId,
    kcalToAdd,
    timezone = null,
    sourceKind = "activity"
  ) => {
    try {
      const numericKcal =
        Number(kcalToAdd);

      if (
        !Number.isFinite(
          numericKcal
        ) ||
        numericKcal <= 0
      ) {
        return null;
      }

      /*
       * If the caller did not provide a timezone,
       * get it from the user record.
       */
      let resolvedTimezone =
        timezone;

      if (
        !resolvedTimezone
      ) {
        const user =
          await User.findById(
            userId
          )
            .select("timezone")
            .lean();

        resolvedTimezone =
          user?.timezone ||
          "UTC";
      }

      const {
        start,
        end,
      } = getDayRange(
        new Date(),
        resolvedTimezone
      );

      let track =
        await DailyLog.findOne({
          user: userId,
          date: {
            $gte: start,
            $lte: end,
          },
        });

      /*
       * A real device reading is authoritative for the device portion, but
       * completed in-app runs/workouts must still be allowed to add their
       * calories on top. A manual headline override also remains intact.
       */

      if (!track) {
        track = await DailyLog.create({
          user: userId,
          date: start,
          steps: 0,
          water: 0,
          sleep: 0,
          caloriesBurned: 0,
          source: "estimated",
        });
      }

      const kindField =
        sourceKind === "exercise"
          ? "exerciseCaloriesBurned"
          : sourceKind === "steps"
          ? "stepsCaloriesBurned"
          : sourceKind === "manual"
          ? "manualCaloriesBurned"
          : "activityCaloriesBurned";

      track[kindField] =
        Number(track[kindField] || 0) + numericKcal;

      if (track.caloriesOverride != null) {
        track.caloriesOverride = Math.max(
          0,
          Number(track.caloriesOverride || 0) + numericKcal
        );
        track.caloriesBurned = Math.round(track.caloriesOverride);
      } else {
        track.caloriesBurned = Math.round(
          Number(track.stepsCaloriesBurned || 0) +
          Number(track.exerciseCaloriesBurned || 0) +
          Number(track.activityCaloriesBurned || 0) +
          Number(track.manualCaloriesBurned || 0)
        );
      }

      if (track.caloriesOverride != null) {
        track.caloriesSource = "manual";
        track.source = "manual";
      } else if (track.source === "device") {
        track.caloriesSource = "mixed";
      } else if (track.source !== "device") {
        track.source = "estimated";
      }
      await track.save();

      return track;
    } catch (error) {
      logger.error(
        {
          err: error,
          userId,
        },
        "Failed to add estimated calories"
      );

      /*
       * This is a helper called after workout completion.
       *
       * A tracking estimation failure should not make
       * the workout itself fail.
       */
      return null;
    }
  };

exports.addEstimatedCaloriesForToday =
  addEstimatedCaloriesForToday;

/**
 * GET /api/track/today
 */
exports.getTodayTracking =
  async (
    req,
    res
  ) => {
    try {
      const {
        startOfToday,
        endOfToday,
      } =
        getTodayRange(req);

      const todayLog =
        await DailyLog.findOne({
          user: req.user.id,

          date: {
            $gte: startOfToday,
            $lte: endOfToday,
          },
        });

      return res
        .status(200)
        .json(todayLog);
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "Get today tracking error"
      );

      return res.status(500).json({
        message:
          "Failed to fetch today tracking",
      });
    }
  };

/**
 * POST /api/track/today
 */
exports.saveTodayTracking =
  async (
    req,
    res
  ) => {
    try {
      const {
        steps,
        water,
        sleep,
        caloriesBurned,
        source,
        caloriesSource,
        activityType,
        activityLabel,
        activityMinutes,
        activityMet,
      } = req.body;

      if (
        steps ===
          undefined &&
        water ===
          undefined &&
        sleep ===
          undefined &&
        caloriesBurned ===
          undefined
      ) {
        return res.status(400).json({
          message:
            "At least one of steps, water, sleep or caloriesBurned is required",
        });
      }

      const {
        startOfToday,
        endOfToday,
      } =
        getTodayRange(req);

      let track =
        await DailyLog.findOneAndUpdate(
          {
            user: req.user.id,
            date: {
              $gte: startOfToday,
              $lte: endOfToday,
            },
          },
          {
            $setOnInsert: {
              user: req.user.id,
              date: startOfToday,
              steps: 0,
              water: 0,
              sleep: 0,
              caloriesBurned: 0,
              stepsCaloriesBurned: 0,
              exerciseCaloriesBurned: 0,
              activityCaloriesBurned: 0,
              manualCaloriesBurned: 0,
              caloriesSource: "manual",
              activityEntries: [],
              source: "manual",
            },
          },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );

      /*
       * Device data has priority over estimates/manual data.
       *
       * If a device has already supplied calories,
       * a later manual/estimated request must not replace
       * that device value.
       */
      const incomingSource =
        source || "manual";

      const incomingCaloriesSource =
        caloriesSource || incomingSource;

      const activityPayload = activityType
        ? {
            activityType: String(activityType).trim().toLowerCase(),
            label: String(activityLabel || activityType).trim().slice(0, 40),
            minutes: Math.max(0, Number(activityMinutes) || 0),
            met: Math.max(0, Number(activityMet) || 0),
            calories: Math.max(0, Number(caloriesBurned) || 0),
            loggedAt: new Date(),
          }
        : null;

      // Manual steps should produce the same step-calorie estimate as the
      // device fallback. Recompute that component from the entered step
      // count instead of leaving calories at zero.
      let manualStepCalories = null;
      if (steps !== undefined && incomingSource !== "device") {
        const profile = await HealthProfile.findOne({ user: req.user.id })
          .select("weight")
          .lean();
        const weightKg = Number(profile?.weight) || 70;
        const stepCount = Math.max(0, Number(steps) || 0);
        if (stepCount > 0) {
          // ~100 steps/min at 3.5 MET. kcal/min = MET * 3.5 * kg / 200.
          manualStepCalories = Math.round(
            ((3.5 * 3.5 * weightKg) / 200) * (stepCount / 100)
          );
        } else {
          manualStepCalories = 0;
        }
      }

      if (track) {
        /*
         * Steps
         */
        if (
          steps !==
          undefined
        ) {
          track.steps =
            steps;

          if (manualStepCalories !== null && track.source !== "device") {
            track.stepsCaloriesBurned = manualStepCalories;
          }
        }

        /*
         * Water
         */
        if (
          water !==
          undefined
        ) {
          track.water =
            water;
        }

        /*
         * Sleep
         */
        if (
          sleep !==
          undefined
        ) {
          track.sleep =
            sleep;
        }

        /*
         * Calories
         *
         * Device is authoritative.
         */
        if (
          caloriesBurned !==
            undefined
        ) {
          const existingIsDevice =
            track.source ===
            "device";

          const incomingIsDevice =
            incomingSource ===
            "device";

          if (
            !existingIsDevice ||
            incomingIsDevice
          ) {
            if (incomingIsDevice && track.caloriesOverride != null) {
              // Keep the user's explicit Active Burn override.
            } else {
              track.caloriesBurned = Math.max(0, Number(caloriesBurned) || 0);
              if (incomingIsDevice) track.caloriesOverride = null;
            }
          }
        }

        if (caloriesBurned !== undefined && !activityPayload) {
          if (incomingCaloriesSource === "device" || incomingCaloriesSource === "estimated" || incomingCaloriesSource === "manual") {
            if (track.caloriesOverride == null || incomingSource === "manual") {
              track.caloriesSource = incomingCaloriesSource;
            }
          }
        }

        /*
         * Source priority:
         *
         * device > estimated > manual
         */
        const sourcePriority = {
          manual: 1,
          estimated: 2,
          device: 3,
        };

        const existingPriority =
          sourcePriority[
            track.source ||
              "manual"
          ] || 1;

        const incomingPriority =
          sourcePriority[
            incomingSource
          ] || 1;

        if (track.caloriesOverride == null && incomingPriority >= existingPriority) {
          track.source = incomingSource;
        } else if (track.caloriesOverride != null) {
          track.source = "manual";
        }

        if (activityPayload && track.caloriesOverride == null && track.source !== "device") {
          track.source = "estimated";
          track.caloriesSource = "estimated";
        }

        if (caloriesBurned !== undefined && !activityPayload && track.caloriesOverride == null) {
          track.caloriesSource = incomingCaloriesSource;
        }

        if (activityPayload && activityPayload.calories > 0) {
          track.activityEntries = Array.isArray(track.activityEntries) ? track.activityEntries : [];
          track.activityEntries.push(activityPayload);
          track.activityCaloriesBurned = Number(track.activityCaloriesBurned || 0) + activityPayload.calories;

          // A quick-add activity is an explicit extra burn. It is allowed
          // on top of device calories and on top of a manual headline value.
          if (track.caloriesOverride != null) {
            track.caloriesOverride = Math.round(
              Number(track.caloriesOverride || 0) + activityPayload.calories
            );
            track.caloriesBurned = track.caloriesOverride;
            track.source = "manual";
          } else if (track.source === "device") {
            track.caloriesSource = "mixed";
            track.caloriesBurned = Math.round(
              Number(track.caloriesBurned || 0) + activityPayload.calories
            );
          }
        }

        if (caloriesBurned !== undefined && incomingSource === "manual" && !activityPayload) {
          // An explicit Active Burn edit is a headline override. It is not
          // re-summed from component fields, which prevents double-counting.
          track.caloriesOverride = Math.max(0, Number(caloriesBurned) || 0);
          track.caloriesBurned = track.caloriesOverride;
          track.manualCaloriesBurned = 0;
          track.caloriesSource = "manual";
          track.source = "manual";
        } else if (track.caloriesOverride == null && track.source !== "device") {
          track.caloriesBurned = Math.round(
            Number(track.stepsCaloriesBurned || 0) +
            Number(track.exerciseCaloriesBurned || 0) +
            Number(track.activityCaloriesBurned || 0) +
            Number(track.manualCaloriesBurned || 0)
          );
        }

        await track.save();
      }

      /*
       * Achievement processing must never block
       * the tracking response.
       */
      checkAndAwardStreakAchievements(
        req.user.id
      ).catch(
        () => {}
      );

      const profile = await HealthProfile.findOne({ user: req.user.id }).select("activeCalorieGoal").lean();
      const activeGoal = Number(profile?.activeCalorieGoal) || 400;
      const dateKey = startOfToday.toISOString().slice(0, 10);

      if (Number(track.steps || 0) >= 10000) {
        awardXp(
          req.user.id,
          "stepsGoal",
          `steps-goal:${dateKey}`,
          { value: Number(track.steps || 0) }
        ).catch(() => {});
      }

      if (Number(track.caloriesBurned || 0) >= activeGoal) {
        awardXp(
          req.user.id,
          "activeBurnGoal",
          `active-burn-goal:${dateKey}`,
          { value: Number(track.caloriesBurned || 0), goal: activeGoal }
        ).catch(() => {});
      }

      return res
        .status(200)
        .json(track);
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "Save today tracking error"
      );

      return res.status(500).json({
        message:
          "Failed to save today tracking",
      });
    }
  };

/**
 * GET /api/track/recent/:days
 *
 * Returns previous calendar days, excluding today.
 */
exports.getRecentLogs =
  async (
    req,
    res
  ) => {
    try {
      const requestedDays =
        Number(
          req.params.days
        );

      const days =
        Number.isFinite(
          requestedDays
        )
          ? Math.min(
              Math.max(
                Math.floor(
                  requestedDays
                ),
                1
              ),
              30
            )
          : 3;

      const timezone =
        getTimezone(req);

      const todayKey =
        getRelativeDateKey(
          new Date(),
          0,
          timezone
        );

      /*
       * `days` previous calendar days.
       */
      const fromKey =
        getRelativeDateKey(
          new Date(),
          -days,
          timezone
        );

      const {
        start: fromDate,
      } =
        getDateKeyRange(
          fromKey,
          timezone
        );

      const {
        start: todayStart,
      } =
        getDateKeyRange(
          todayKey,
          timezone
        );

      const logs =
        await DailyLog.find({
          user: req.user.id,

          date: {
            $gte: fromDate,
            $lt: todayStart,
          },
        }).sort({
          date: -1,
        });

      return res
        .status(200)
        .json(logs);
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "Recent logs error"
      );

      return res.status(500).json({
        message:
          "Failed to fetch recent logs",
      });
    }
  };

/**
 * GET /api/track/weekly
 *
 * Last seven local calendar days, including today.
 */
exports.getWeeklySummary =
  async (
    req,
    res
  ) => {
    try {
      const timezone =
        getTimezone(req);

      const todayKey =
        getRelativeDateKey(
          new Date(),
          0,
          timezone
        );

      const sevenDaysAgoKey =
        getRelativeDateKey(
          new Date(),
          -6,
          timezone
        );

      const {
        start:
          startOfWeek,
      } =
        getDateKeyRange(
          sevenDaysAgoKey,
          timezone
        );

      const {
        end:
          endOfToday,
      } =
        getDateKeyRange(
          todayKey,
          timezone
        );

      const logs =
        await DailyLog.find({
          user: req.user.id,

          date: {
            $gte: startOfWeek,
            $lte: endOfToday,
          },
        }).sort({
          date: 1,
        });

      if (!logs.length) {
        return res.status(200).json({
          message:
            "No data",
          avgSteps: 0,
          avgWater: 0,
          avgSleep: 0,
          avgCalories: 0,
          bestDay: null,
          daysTracked: 0,
        });
      }

      let totalSteps = 0;
      let totalWater = 0;
      let totalSleep = 0;
      let totalCalories = 0;

      let bestDay = null;

      for (
        const log of logs
      ) {
        totalSteps +=
          Number(
            log.steps || 0
          );

        totalWater +=
          Number(
            log.water || 0
          );

        totalSleep +=
          Number(
            log.sleep || 0
          );

        totalCalories +=
          Number(
            log.caloriesBurned ||
              0
          );

        if (
          !bestDay ||
          Number(
            log.steps || 0
          ) >
            Number(
              bestDay.steps || 0
            )
        ) {
          bestDay =
            log;
        }
      }

      return res
        .status(200)
        .json({
          avgSteps:
            Math.round(
              totalSteps /
                logs.length
            ),

          avgWater:
            Number(
              (
                totalWater /
                logs.length
              ).toFixed(1)
            ),

          avgSleep:
            Number(
              (
                totalSleep /
                logs.length
              ).toFixed(1)
            ),

          avgCalories:
            Math.round(
              totalCalories /
                logs.length
            ),

          bestDay:
            bestDay
              ? bestDay.date
              : null,

          daysTracked:
            logs.length,
        });
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "Weekly summary error"
      );

      return res.status(500).json({
        message:
          "Weekly summary failed",
      });
    }
  };