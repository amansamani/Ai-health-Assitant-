const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const controller = require("./health.controller");
const HealthProfile = require("./health.model");

router.post("/", auth, controller.createOrUpdateHealthProfile);
router.get("/", auth, controller.getHealthProfile);
router.put("/", auth, async (req, res) => {
  const profile = await HealthProfile.findOneAndUpdate(
    { user: req.user.id },
    { ...req.body },
    { new: true }
  );
  res.json(profile);
});
module.exports = router;