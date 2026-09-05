const express = require("express");
const auth = require("../middleware/authMiddleware");
const controller = require("../controllers/notificationController");
const router = express.Router();
router.get("/", auth, controller.listNotifications);
router.post("/:id/read", auth, controller.markRead);
router.post("/read-all", auth, controller.markAllRead);
module.exports = router;
