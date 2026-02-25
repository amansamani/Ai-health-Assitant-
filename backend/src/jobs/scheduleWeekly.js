const weeklyAdjustmentQueue = require('../queues/weeklyAdjustment.queue');

const scheduleWeeklyJob = async () => {
  const repeatableJobs = await weeklyAdjustmentQueue.getRepeatableJobs();

  for (const job of repeatableJobs) {
    await weeklyAdjustmentQueue.removeRepeatableByKey(job.key);
    console.log(`🗑️ Removed old repeatable job: ${job.key}`);
  }

  await weeklyAdjustmentQueue.add(
    'weekly-adjustment-job',
    { triggeredAt: new Date() },
    {
      repeat: { cron: '0 0 * * 0' }, // Sunday 00:00 UTC
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );

  console.log('📅 Weekly job scheduled (Sunday 00:00 UTC)');
};

module.exports = scheduleWeeklyJob;