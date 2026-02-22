const { Worker } = require("bullmq");
const connection = require("../config/redis");
const runWeeklyAdjustments = require("../services/weeklyAdjustment.service");

const worker = new Worker(
  "weekly-adjustment",
  async job => {
    console.log("🔄 Running weekly adjustment job...");
    await runWeeklyAdjustments();
  },
  { connection }
);

worker.on("completed", () => {
  console.log("✅ Weekly job completed");
});

worker.on("failed", (job, err) => {
  console.error("❌ Weekly job failed:", err);
});