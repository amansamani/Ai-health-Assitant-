const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const controller = require("./nutrition.controller");

router.post("/generate", auth, controller.generatePlan);
router.get("/current", auth, controller.getCurrentPlan);
router.post("/log", auth, controller.logDailyDiet);
router.get("/log", auth, controller.getDailyDietLog);
router.post("/weekly-adjust", auth, controller.runWeeklyAdjustment);

module.exports = router;