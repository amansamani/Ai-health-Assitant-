const router = require('express').Router();
const protect = require('../middleware/authMiddleware');
const isAdmin = require('../middleware/isAdmin');
const weeklyAdjustmentQueue = require('../queues/weeklyAdjustment.queue');
const logger = require('../config/logger');

router.post('/trigger-weekly', protect, isAdmin, async (req, res) => {
  try {
    const job = await weeklyAdjustmentQueue.add('adjustNutritionPlans', {
      triggeredBy: req.user.email,
      date: new Date(),
    });
    res.json({ message: 'Job queued', jobId: job.id });
  } catch (err) {
    logger.error({ err }, 'Trigger weekly job error');
    res.status(500).json({ message: 'Failed to queue job' });
  }
});

module.exports = router;