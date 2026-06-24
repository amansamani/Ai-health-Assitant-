const express    = require("express");
const router     = express.Router();
const auth       = require("../../middleware/authMiddleware");
const controller = require("./nutrition.controller");
const { aiChat, clearChatSession } = require("./ai.chat.controller");

// ── Diet Plan ─────────────────────────────────────────────────────────────────
router.post("/generate",       auth, controller.generatePlan);
router.get("/current",         auth, controller.getCurrentPlan);
router.post("/log",            auth, controller.logDailyDiet);
router.get("/log",             auth, controller.getDailyDietLog);
router.post("/weekly-adjust",  auth, controller.runWeeklyAdjustment);

// ── Swap ──────────────────────────────────────────────────────────────────────
router.post("/swap", auth, (req, res, next) => {
  console.log("✅ /swap route hit", req.body);
  next();
}, controller.swapFood);
router.get("/swap-options",    auth, controller.getSwapOptions);

// ── Meal Logging ──────────────────────────────────────────────────────────────
router.post("/log-meal",       auth, controller.logMeal);
router.get("/today-log",       auth, controller.getTodayLog);
router.delete("/meal/:id",     auth, controller.deleteMeal);
router.get("/history",         auth, controller.getMealHistory);

// ── Food Search ───────────────────────────────────────────────────────────────
router.get("/foods",           auth, controller.getFoods);

// ── AI Chat ───────────────────────────────────────────────────────────────────
router.post("/ai-chat",        auth, aiChat);
router.delete("/ai-chat",      auth, clearChatSession);   // optional: clear on logout

module.exports = router;