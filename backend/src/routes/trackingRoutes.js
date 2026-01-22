const express = require("express");
const protect = require("../middleware/authMiddleware");
const {
  updateDailyLog,
  getTodayLog,
} = require("../controllers/trackingController");

const router = express.Router();

router.post("/today", protect, updateDailyLog);
router.get("/today", protect, getTodayLog);

module.exports = router;
