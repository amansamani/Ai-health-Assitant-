const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const controller = require("./nutrition.controller");

// ── Existing Diet Plan Routes ─────────────────────────────────────────────────
router.post("/generate", auth, controller.generatePlan);
router.get("/current", auth, controller.getCurrentPlan);
router.post("/log", auth, controller.logDailyDiet);
router.get("/log", auth, controller.getDailyDietLog);
router.post("/weekly-adjust", auth, controller.runWeeklyAdjustment);

// ── Meal Logging Routes (NEW) ─────────────────────────────────────────────────
router.post("/log-meal", auth, controller.logMeal);         // POST /api/nutrition/log-meal
router.get("/today-log", auth, controller.getTodayLog);     // GET  /api/nutrition/today-log
router.delete("/meal/:id", auth, controller.deleteMeal);    // DELETE /api/nutrition/meal/:id
router.get("/history", auth, controller.getMealHistory);    // GET  /api/nutrition/history?days=7

module.exports = router;