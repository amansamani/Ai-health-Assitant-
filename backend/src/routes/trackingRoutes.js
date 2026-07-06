const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const { trackingSchema } = require("../validation/schemas");
const {
  getTodayTracking,
  saveTodayTracking,
  getWeeklySummary,
  getRecentLogs,
} = require("../controllers/trackingController");

router.get("/today", authMiddleware, getTodayTracking);
router.post("/today", authMiddleware, validate(trackingSchema), saveTodayTracking);
router.get("/weekly", authMiddleware, getWeeklySummary);
router.get("/recent/:days", authMiddleware, getRecentLogs);

module.exports = router;