// ── PASTE THESE ADDITIONS INTO nutrition.routes.js ───────────────────────────
//
// 1. Require the new controllers at the top of the file (alongside existing ones)
// 2. Add the route lines below into the router

// ── ADD to top of nutrition.routes.js ─────────────────────────────────────────
//
//   const { getWaterLog, addWater, undoLastWater, setWaterGoal } = require("./waterLog.controller");
//   const { logDailyDiet, getDailyDietLog } = require("./mealCompletion.controller");
//
// ── REPLACE existing /log routes and ADD water routes ─────────────────────────
//
//   // Diet Progress (meal completion — now wired to plan)
//   router.post("/log",      auth, logDailyDiet);      // replaces old stub
//   router.get("/log",       auth, getDailyDietLog);   // replaces old stub
//
//   // Water tracking
//   router.get("/water",          auth, getWaterLog);
//   router.post("/water",         auth, addWater);
//   router.delete("/water/last",  auth, undoLastWater);
//   router.put("/water/goal",     auth, setWaterGoal);
//
// ── Full updated nutrition.routes.js for reference ───────────────────────────

const express    = require("express");
const router     = express.Router();
const auth       = require("../../middleware/authMiddleware");
const controller = require("./nutrition.controller");
const { aiChat, clearChatSession } = require("./ai.chat.controller");
const { getWaterLog, addWater, undoLastWater, setWaterGoal } = require("./waterLog.controller");
const { logDailyDiet, getDailyDietLog } = require("./mealCompletion.controller");

// ── Diet Plan ─────────────────────────────────────────────────────────────────
router.post("/generate",       auth, controller.generatePlan);
router.get("/current",         auth, controller.getCurrentPlan);
router.post("/weekly-adjust",  auth, controller.runWeeklyAdjustment);
router.get("/weekly-insight",  auth, controller.getWeeklyInsight);
router.get("/weekly-insight-log", auth, controller.getWeeklyInsightLog);

// ── Diet Progress (now wired to plan — replaces old stubs) ───────────────────
router.post("/log", auth, logDailyDiet);
router.get("/log",  auth, getDailyDietLog);

// ── Swap ──────────────────────────────────────────────────────────────────────
router.post("/swap", auth, (req, res, next) => {
  console.log("✅ /swap route hit", req.body);
  next();
}, controller.swapFood);
router.get("/swap-options", auth, controller.getSwapOptions);

// ── Meal Logging ──────────────────────────────────────────────────────────────
router.post("/log-meal",      auth, controller.logMeal);
router.get("/today-log",      auth, controller.getTodayLog);
router.delete("/meal/:id",    auth, controller.deleteMeal);
router.get("/history",        auth, controller.getMealHistory);

// ── Food Search ───────────────────────────────────────────────────────────────
router.get("/foods", auth, controller.getFoods);

// ── Water Tracking ────────────────────────────────────────────────────────────
router.get("/water",         auth, getWaterLog);
router.post("/water",        auth, addWater);
router.delete("/water/last", auth, undoLastWater);
router.put("/water/goal",    auth, setWaterGoal);

// ── AI Chat ───────────────────────────────────────────────────────────────────
router.post("/ai-chat",  auth, aiChat);
router.delete("/ai-chat", auth, clearChatSession);

module.exports = router;