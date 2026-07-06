const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const validate = require("../../middleware/validate");
const { healthProfileSchema } = require("../../validation/schemas");
const controller = require("./health.controller");

router.post("/", auth, validate(healthProfileSchema), controller.createOrUpdateHealthProfile);
router.get("/", auth, controller.getHealthProfile);
router.put("/", auth, validate(healthProfileSchema), controller.createOrUpdateHealthProfile);

module.exports = router;