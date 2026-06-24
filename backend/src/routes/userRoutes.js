const express = require("express");
const protect = require("../middleware/authMiddleware");
const { getProfile, updateGoal, registerPushToken } = require("../controllers/userController");

const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/goal", protect, updateGoal);
router.post("/push-token", protect, registerPushToken);

module.exports = router;
