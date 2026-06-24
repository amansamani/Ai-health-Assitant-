require('../config/db'); // connect DB
require('./weeklyAdjustment.worker'); // start worker

console.log('👷 Worker service started');