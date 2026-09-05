const express = require("express");
const rateLimit = require("express-rate-limit");
const auth = require("../middleware/authMiddleware");
const controller = require("../controllers/notificationController");

const router = express.Router();
const readLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
router.use(auth);
router.get("/", readLimiter, controller.list);
router.post("/:id/read", readLimiter, controller.markRead);
router.post("/read-all", readLimiter, controller.markAllRead);
module.exports = router;
