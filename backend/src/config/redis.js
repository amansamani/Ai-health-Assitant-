const { Redis } = require('ioredis');

const redisConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // REQUIRED for BullMQ
  enableReadyCheck: false,    // Recommended for Railway
});

redisConnection.on('connect', () => console.log('✅ Redis connected'));
redisConnection.on('error', (err) => console.error('❌ Redis error:', err));

module.exports = redisConnection;