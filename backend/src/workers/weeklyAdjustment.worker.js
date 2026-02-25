const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const runWeeklyAdjustments = require('../services/weeklyAdjustment.service');

const worker = new Worker(
  'weeklyAdjustment',
  async (job) => {
    console.log(`🔄 Processing weekly adjustment job ${job.id}`);

    await runWeeklyAdjustments();
  },
  {
    connection: redisConnection,
    concurrency: 1, // important: avoid parallel weekly execution
  }
);

worker.on('completed', (job) =>
  console.log(`✅ Weekly job ${job.id} completed`)
);

worker.on('failed', (job, err) =>
  console.error(`❌ Weekly job ${job.id} failed:`, err.message)
);

console.log("👷 Weekly Adjustment Worker started");

module.exports = worker;