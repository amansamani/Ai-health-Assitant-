const { Redis } = require('ioredis');

const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,   // required for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times) => {
    if (times > 5) {
      console.error("❌ Redis: too many retries, giving up");
      return null; // stop retrying
    }
    return Math.min(times * 500, 3000);
  },
});

redisConnection.on('connect', () => console.log('✅ Redis connected'));
redisConnection.on('error', (err) => console.error('❌ Redis error:', err.message));

module.exports = redisConnection;