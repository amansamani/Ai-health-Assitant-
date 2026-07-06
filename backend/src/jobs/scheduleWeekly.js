const weeklyAdjustmentQueue = require('../queues/weeklyAdjustment.queue');
const logger = require('../config/logger');

const scheduleWeeklyJob = async () => {
  const repeatableJobs = await weeklyAdjustmentQueue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    await weeklyAdjustmentQueue.removeRepeatableByKey(job.key);
    logger.info({ jobKey: job.key }, "Removed old repeatable job");
  }

  await weeklyAdjustmentQueue.add(
    'weekly-adjustment-job',
    { triggeredAt: new Date() },
    {
      repeat: { cron: '0 0 * * 0' },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );

  logger.info("Weekly job scheduled (Sunday 00:00 UTC)");
};

module.exports = scheduleWeeklyJob;