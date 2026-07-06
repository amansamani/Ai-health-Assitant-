const connectDB = require('../config/db');
const logger = require('../config/logger');

connectDB()
  .then(() => {
    require('./weeklyAdjustment.worker');
    logger.info('Worker service started');
  })
  .catch((err) => {
    logger.error({ err }, 'Worker failed to connect to DB');
    process.exit(1);
  });