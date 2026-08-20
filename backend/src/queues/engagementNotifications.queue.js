const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const engagementNotificationsQueue = new Queue('engagementNotifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

module.exports = engagementNotificationsQueue;
