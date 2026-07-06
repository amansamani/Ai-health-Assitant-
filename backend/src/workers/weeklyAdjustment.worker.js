const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../config/logger');
const { runSmartWeeklyAdjustmentForAllUsers } = require('../modules/nutrition/nutrition.service');

const worker = new Worker(
  'weeklyAdjustment',
  async (job) => {
    logger.info({ jobId: job.id }, "Processing weekly adjustment job");
    await runSmartWeeklyAdjustmentForAllUsers();
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

worker.on('completed', (job) =>
  logger.info({ jobId: job.id }, "Weekly job completed")
);

worker.on('failed', (job, err) =>
  logger.error({ err, jobId: job.id }, "Weekly job failed")
);

logger.info("Weekly Adjustment Worker started");

module.exports = worker;