const weeklyAdjustmentQueue = require("../queues/weeklyAdjustment.queue");
const logger = require("../config/logger");

/*
 * Weekly nutrition adjustment schedule.
 *
 * Cron:
 *
 *   0 0 * * 0
 *
 * means:
 *
 *   Sunday
 *   00:00 UTC
 *
 * IMPORTANT:
 *
 * This is a GLOBAL schedule, not a per-user timezone schedule.
 *
 * The actual nutrition calculations should use each user's
 * timezone when evaluating their "week".
 */
const WEEKLY_CRON = "0 0 * * 0";

const JOB_NAME =
  "weekly-adjustment-job";

/**
 * Remove old repeatable weekly jobs and create exactly one
 * current schedule.
 *
 * This function is safe to call during application startup.
 */
const scheduleWeeklyJob = async () => {
  try {
    const repeatableJobs =
      await weeklyAdjustmentQueue.getRepeatableJobs();

    /*
     * Remove old versions of the schedule.
     *
     * This prevents accidentally accumulating multiple
     * Sunday jobs after every deployment/restart.
     */
    for (const job of repeatableJobs) {
      try {
        await weeklyAdjustmentQueue.removeRepeatableByKey(
          job.key
        );

        logger.info(
          {
            jobKey: job.key,
          },
          "Removed old weekly repeatable job"
        );
      } catch (error) {
        /*
         * If one stale schedule cannot be removed,
         * continue cleaning the remaining schedules.
         */
        logger.error(
          {
            err: error,
            jobKey: job.key,
          },
          "Failed to remove old weekly repeatable job"
        );
      }
    }

    /*
     * Create the single weekly schedule.
     */
    const job = await weeklyAdjustmentQueue.add(
      JOB_NAME,
      {
        triggeredAt:
          new Date().toISOString(),
      },
      {
        repeat: {
          cron: WEEKLY_CRON,
        },

        attempts: 3,

        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    logger.info(
      {
        jobId: job.id,
        cron: WEEKLY_CRON,
      },
      "Weekly nutrition adjustment scheduled"
    );

    return job;
  } catch (error) {
    logger.error(
      {
        err: error,
      },
      "Failed to schedule weekly nutrition adjustment"
    );

    /*
     * Do not hide the scheduling failure from the caller.
     *
     * server.js decides whether the scheduling problem should
     * be fatal or non-fatal.
     */
    throw error;
  }
};

module.exports = scheduleWeeklyJob;