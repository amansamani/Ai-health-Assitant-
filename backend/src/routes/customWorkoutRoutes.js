const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const controller = require("../controllers/customWorkoutController");

router.use(auth);
router.get("/plans", controller.getPlans);
router.get("/active", controller.getActivePlan);
router.post("/plans", controller.createPlan);
router.put("/plans/:id", controller.updatePlan);
router.post("/plans/:id/activate", controller.activatePlan);
router.delete("/plans/:id", controller.deletePlan);
router.get("/plans/:id/days/:day", controller.getPlanDay);

module.exports = router;
