const { Queue } = require("bullmq");
const redisConnection = require("../config/redis");

const weeklyAdjustmentQueue = new Queue(
  "weeklyAdjustment",
  {
    connection: redisConnection,

    defaultJobOptions: {
      attempts: 3,

      backoff: {
        type: "exponential",
        delay: 5000,
      },

      /*
       * Keep a small history of completed jobs for debugging.
       */
      removeOnComplete: 100,

      /*
       * Keep failed jobs longer so failures can be inspected.
       */
      removeOnFail: 200,
    },
  }
);

weeklyAdjustmentQueue.on(
  "error",
  (error) => {
    console.error(
      "❌ Weekly adjustment queue error:",
      error
    );
  }
);

module.exports = weeklyAdjustmentQueue;