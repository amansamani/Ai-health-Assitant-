const { Queue } = require("bullmq");
const connection = require("../config/redis");

const weeklyQueue = new Queue("weekly-adjustment", {
  connection
});

module.exports = weeklyQueue;