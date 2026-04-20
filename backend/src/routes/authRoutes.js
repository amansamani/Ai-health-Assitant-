const express = require("express");
const { registerUser , loginUser } = require("../controllers/authController");
const { forgotPassword, verifyOtp, resetPassword } = require("../controllers/authController");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);   // Step 1 - send OTP
router.post("/verify-otp",      verifyOtp);        // Step 2 - verify OTP
router.post("/reset-password",  resetPassword);    // Step 3 - new password

module.exports = router;
