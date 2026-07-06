const { Redis } = require('ioredis');
const logger = require('./logger');

const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 5) {
      logger.error("Redis: too many retries, giving up");
      return null;
    }
    return Math.min(times * 500, 3000);
  },
});

redisConnection.on('connect', () => logger.info('Redis connected'));
redisConnection.on('error', (err) => logger.error({ err }, 'Redis error'));

module.exports = redisConnection;