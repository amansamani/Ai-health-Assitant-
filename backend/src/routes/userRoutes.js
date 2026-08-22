const express = require("express");
const protect = require("../middleware/authMiddleware");
const { getProfile, updateGoal, registerPushToken } = require("../controllers/userController");
const { updateSocialProfile, uploadProfilePhoto, getProfilePhoto, ensureUsername } = require("../modules/social/socialProfile.controller");

const router = express.Router();

router.get("/profile", protect, async (req, res, next) => {
  try { await ensureUsername(req.user); return getProfile(req, res); }
  catch (err) { return next(err); }
});
router.put("/profile", protect, updateSocialProfile);
router.put("/profile/photo", protect, uploadProfilePhoto);
router.get("/profile/photo/:userId", protect, getProfilePhoto);
router.put("/goal", protect, updateGoal);
router.post("/push-token", protect, registerPushToken);

module.exports = router;
