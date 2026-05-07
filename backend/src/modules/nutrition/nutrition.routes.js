const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const controller = require("./nutrition.controller");

// ── Diet Plan ─────────────────────────────────────────────────────────────────
router.post("/generate",       auth, controller.generatePlan);
router.get("/current",         auth, controller.getCurrentPlan);
router.post("/log",            auth, controller.logDailyDiet);
router.get("/log",             auth, controller.getDailyDietLog);
router.post("/weekly-adjust",  auth, controller.runWeeklyAdjustment);

// Change these two lines:
router.post("/swap",        auth, controller.swapFood);      // was patch("/swap-food")
router.get("/swap-options", auth, controller.getSwapOptions); // already correct

// ── Meal Logging ──────────────────────────────────────────────────────────────
router.post("/log-meal",       auth, controller.logMeal);
router.get("/today-log",       auth, controller.getTodayLog);
router.delete("/meal/:id",     auth, controller.deleteMeal);
router.get("/history",         auth, controller.getMealHistory);

// ── Food Search & Filter ───────────────────────────────────────────────────
router.get("/foods",           auth, controller.getFoods);   // GET /api/nutrition/foods?tags=high-protein,gym


module.exports = router;