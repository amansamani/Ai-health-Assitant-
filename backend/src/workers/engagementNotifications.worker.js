const { Worker } = require('bullmq');
const redisConnection = require('../config/redis');
const logger = require('../config/logger');
const { runMomentForAllUsers } = require('../notifications/engagement.service');

const worker = new Worker(
  'engagementNotifications',
  async (job) => {
    const { moment } = job.data;
    logger.info({ jobId: job.id, moment }, "Processing engagement notification job");
    return runMomentForAllUsers(moment);
  },
  {
    connection: redisConnection,
    concurrency: 1,
  }
);

worker.on('completed', (job, result) =>
  logger.info({ jobId: job.id, moment: job.data.moment, ...result }, "Engagement job completed")
);

worker.on('failed', (job, err) =>
  logger.error({ err, jobId: job.id, moment: job.data?.moment }, "Engagement job failed")
);

logger.info("Engagement Notifications Worker started");

module.exports = worker;
