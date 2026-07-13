const { Redis } = require('ioredis');
const logger = require('./logger');

const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Previously returned `null` after 5 tries, which permanently kills
  // reconnection for the life of the process — a single transient Redis
  // blip meant every redis-dependent feature stayed dead until a manual
  // restart. Keep retrying forever instead, capped at 10s between attempts,
  // so the app self-heals once Redis is reachable again.
  retryStrategy: (times) => {
    const delay = Math.min(times * 500, 10_000);
    if (times % 10 === 0) {
      logger.warn({ times }, "Redis: still retrying connection");
    }
    return delay;
  },
});

redisConnection.on('connect', () => logger.info('Redis connected'));
redisConnection.on('error', (err) => logger.error({ err }, 'Redis error'));

module.exports = redisConnection;