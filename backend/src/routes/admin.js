const router = require('express').Router();
const protect = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');
const weeklyAdjustmentQueue = require('../queues/weeklyAdjustment.queue');

router.post('/trigger-weekly', protect, isAdmin, async (req, res) => {
  try {
    const job = await weeklyAdjustmentQueue.add('adjustNutritionPlans', {
      triggeredBy: req.user.email,
      date: new Date(),
    });
    res.json({ message: 'Job queued', jobId: job.id });
  } catch (err) {
    console.error('Trigger weekly job error:', err);
    res.status(500).json({ message: 'Failed to queue job' });
  }
});

module.exports = router;