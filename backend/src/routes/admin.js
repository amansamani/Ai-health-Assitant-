const router = require('express').Router();
const weeklyAdjustmentQueue = require('../queues/weeklyAdjustment.queue');

router.post('/trigger-weekly', async (req, res) => {
  const job = await weeklyAdjustmentQueue.add('adjustNutritionPlans', {
    triggeredBy: 'manual',
    date: new Date(),
  });
  res.json({ message: 'Job queued', jobId: job.id });
});

module.exports = router;