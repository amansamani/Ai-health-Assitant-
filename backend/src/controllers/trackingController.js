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

const {
  checkAndAwardStreakAchievements,
} = require(
  "../modules/social/achievement.service"
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
    timezone = null
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
       * Tier 1 device data wins.
       *
       * If the wearable already reported today's
       * active calories, don't stack workout estimates
       * on top of it.
       */
      if (
        track?.source ===
        "device"
      ) {
        return track;
      }

      if (track) {
        track.caloriesBurned =
          Math.round(
            Number(
              track.caloriesBurned ||
                0
            ) +
              numericKcal
          );

        track.source =
          "estimated";

        await track.save();
      } else {
        track =
          await DailyLog.create({
            user: userId,

            date: start,

            steps: 0,

            water: 0,

            sleep: 0,

            caloriesBurned:
              Math.round(
                numericKcal
              ),

            source:
              "estimated",
          });
      }

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
        await DailyLog.findOne({
          user: req.user.id,

          date: {
            $gte: startOfToday,
            $lte: endOfToday,
          },
        });

      /*
       * Device data has priority over estimates/manual data.
       *
       * If a device has already supplied calories,
       * a later manual/estimated request must not replace
       * that device value.
       */
      const incomingSource =
        source || "manual";

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
            track.caloriesBurned =
              caloriesBurned;
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

        if (
          incomingPriority >=
          existingPriority
        ) {
          track.source =
            incomingSource;
        }

        await track.save();
      } else {
        track =
          await DailyLog.create({
            user: req.user.id,

            date: startOfToday,

            steps:
              steps ?? 0,

            water:
              water ?? 0,

            sleep:
              sleep ?? 0,

            caloriesBurned:
              caloriesBurned ??
              0,

            source:
              incomingSource,
          });
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