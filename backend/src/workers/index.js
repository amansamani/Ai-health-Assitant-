const connectDB = require('../config/db');

connectDB()
  .then(() => {
    require('./weeklyAdjustment.worker'); // start worker after DB ready
    console.log('👷 Worker service started');
  })
  .catch((err) => {
    console.error('❌ Worker failed to connect to DB:', err.message);
    process.exit(1);
  });