const express = require("express");
const protect = require("../middleware/authMiddleware");
const { getProfile, updateGoal } = require("../controllers/userController");

const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/goal", protect, updateGoal);

module.exports = router;
