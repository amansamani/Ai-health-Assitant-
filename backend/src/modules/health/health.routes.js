const express = require("express");
const router = express.Router();
const auth = require("../../middleware/authMiddleware");
const controller = require("./health.controller");

router.post("/", auth, controller.createOrUpdateHealthProfile);
router.get("/", auth, controller.getHealthProfile);

module.exports = router;