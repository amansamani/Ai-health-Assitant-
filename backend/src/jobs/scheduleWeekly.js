const weeklyQueue = require("../queues/weeklyAdjustment.queue");

async function scheduleWeeklyJob() {
  await weeklyQueue.add(
    "weekly-job",
    {},
    {
      repeat: {
        cron: "0 2 * * 0"
      },
      removeOnComplete: true,
      removeOnFail: true
    }
  );

  console.log("✅ Weekly job scheduled.");
}

scheduleWeeklyJob();