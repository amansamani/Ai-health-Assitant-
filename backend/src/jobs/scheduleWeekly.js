const { QueueScheduler } = require('bullmq'); // only if BullMQ v1
const weeklyAdjustmentQueue = require('../queues/weeklyAdjustment.queue');
const redisConnection = require('../config/redis');

const scheduleWeeklyJob = async () => {
  // Remove existing repeatable jobs to avoid duplicates
  const repeatableJobs = await weeklyAdjustmentQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await weeklyAdjustmentQueue.removeRepeatableByKey(job.key);
    console.log(`🗑️ Removed old repeatable job: ${job.key}`);
  }

  // Schedule: every Sunday at midnight UTC
  await weeklyAdjustmentQueue.add(
    'adjustNutritionPlans',
    { triggeredBy: 'scheduler', date: new Date() },
    {
      repeat: { cron: '0 0 * * 0' }, // every Sunday 00:00 UTC
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );

  console.log('📅 Weekly job scheduled (every Sunday 00:00 UTC)');
};

module.exports = scheduleWeeklyJob;