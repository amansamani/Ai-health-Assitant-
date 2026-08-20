const {
  Worker,
} = require("bullmq");

const redisConnection = require("../config/redis");

const logger = require("../config/logger");

const {
  runSmartWeeklyAdjustmentForAllUsers,
} = require("../modules/nutrition/nutrition.service");

/*
 * Only one weekly adjustment job should execute at a time
 * inside this worker process.
 *
 * This is particularly important because the operation:
 *
 *   - reads every health profile
 *   - evaluates weekly progress
 *   - may change calorie targets
 *   - generates new diet plans
 *   - creates new DietPlan documents
 *
 * Running multiple users simultaneously could put unnecessary
 * pressure on MongoDB and Gemini.
 */
const worker = new Worker(
  "weeklyAdjustment",

  async (job) => {
    const startedAt = Date.now();

    logger.info(
      {
        jobId: job.id,
        jobName: job.name,
        triggeredAt: job.data?.triggeredAt,
      },
      "Processing weekly adjustment job"
    );

    try {
      const results =
        await runSmartWeeklyAdjustmentForAllUsers();

      const adjustedUsers = results.filter(
        (result) => result.adjusted === true
      ).length;

      const skippedUsers = results.filter(
        (result) => result.adjusted === false
      ).length;

      const failedUsers = results.filter(
        (result) =>
          result.reason &&
          String(result.reason)
            .toLowerCase()
            .includes("failed")
      ).length;

      const durationMs =
        Date.now() - startedAt;

      logger.info(
        {
          jobId: job.id,
          totalUsers: results.length,
          adjustedUsers,
          skippedUsers,
          failedUsers,
          durationMs,
        },
        "Weekly adjustment processing completed"
      );

      /*
       * Returning the result allows BullMQ to store useful
       * completion information for debugging.
       */
      return {
        success: true,
        totalUsers: results.length,
        adjustedUsers,
        skippedUsers,
        failedUsers,
        durationMs,
      };
    } catch (error) {
      logger.error(
        {
          err: error,
          jobId: job.id,
        },
        "Weekly adjustment job failed"
      );

      /*
       * Re-throwing is important.
       *
       * BullMQ needs the promise to reject so the configured
       * retry policy can run.
       */
      throw error;
    }
  },

  {
    connection: redisConnection,

    /*
     * Never run multiple global weekly adjustment jobs
     * concurrently in the same worker process.
     */
    concurrency: 1,

    /*
     * Lock the job long enough for a large user base.
     *
     * The worker can still heartbeat/extend the lock while
     * processing.
     */
    lockDuration: 10 * 60 * 1000,
  }
);

/*
 * Worker-level error.
 *
 * This does not necessarily mean the application has crashed.
 * BullMQ emits this for connection/worker-level problems.
 */
worker.on(
  "error",
  (error) => {
    logger.error(
      { err: error },
      "Weekly adjustment worker error"
    );
  }
);

/*
 * Job completed successfully.
 */
worker.on(
  "completed",
  (job, result) => {
    logger.info(
      {
        jobId: job.id,
        result,
      },
      "Weekly adjustment job completed"
    );
  }
);

/*
 * Job exhausted its attempts or otherwise failed.
 */
worker.on(
  "failed",
  (job, error) => {
    logger.error(
      {
        err: error,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
      },
      "Weekly adjustment job failed"
    );
  }
);

logger.info(
  "Weekly Adjustment Worker started"
);

module.exports = worker;