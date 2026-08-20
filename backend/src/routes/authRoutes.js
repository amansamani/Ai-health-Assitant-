const express = require("express");
const rateLimit = require("express-rate-limit");

const {
  registerUser,
  loginUser,
  googleLogin,
  forgotPassword,
  verifyOtp,
  resetPassword,
} = require("../controllers/authController");

const router = express.Router();

/*
 * Login limiter.
 *
 * This is intentionally stricter than the global /api limiter.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    message:
      "Too many authentication attempts. Please try again later.",
  },
});

/*
 * Password recovery limiter.
 *
 * Applies separately to:
 *
 * forgot-password
 * verify-otp
 * reset-password
 *
 * This prevents OTP brute-force and reset abuse.
 */
const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many password-recovery attempts. Please try again later.",
  },
});

/*
 * Registration limiter.
 *
 * Registration should not be as permissive as ordinary API
 * endpoints because attackers can use it to create huge numbers
 * of accounts.
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many registration attempts. Please try again later.",
  },
});

// -----------------------------------------------------------------------------
// Registration / login
// -----------------------------------------------------------------------------

router.post(
  "/register",
  registerLimiter,
  registerUser
);

router.post(
  "/login",
  loginLimiter,
  loginUser
);

router.post(
  "/google",
  loginLimiter,
  googleLogin
);

// -----------------------------------------------------------------------------
// Password recovery
// -----------------------------------------------------------------------------

router.post(
  "/forgot-password",
  recoveryLimiter,
  forgotPassword
);

router.post(
  "/verify-otp",
  recoveryLimiter,
  verifyOtp
);

router.post(
  "/reset-password",
  recoveryLimiter,
  resetPassword
);

module.exports = router;