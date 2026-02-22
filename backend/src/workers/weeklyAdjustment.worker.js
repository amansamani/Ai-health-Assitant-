const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const weeklyAdjustmentService = require('../services/weeklyAdjustment.service');

const worker = new Worker(
  'weeklyAdjustment',
  async (job) => {
    console.log(`🔄 Processing job ${job.id}:`, job.name);

    switch (job.name) {
      case 'adjustNutritionPlans':
        await weeklyAdjustmentService.adjustAllUserPlans(job.data);
        break;
      default:
        throw new Error(`Unknown job name: ${job.name}`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

worker.on('completed', (job) => console.log(`✅ Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`❌ Job ${job.id} failed:`, err.message));

module.exports = worker;