const User = require("../models/User");
const HealthProfile = require("../modules/health/health.model");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(
  process.env.GOOGLE_WEB_CLIENT_ID
);

const MAX_OTP_ATTEMPTS = 5;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Normalize an email address consistently across all auth flows.
 */
const normalizeEmail = (email) =>
  String(email || "").trim().toLowerCase();

/**
 * Basic email validation.
 */
const isValidEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Create the application's JWT.
 */
const createAuthToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
};

/**
 * Safely compare two SHA-256 hex hashes.
 *
 * crypto.timingSafeEqual requires buffers with identical lengths.
 * This helper prevents a length mismatch from throwing.
 */
const safeHashCompare = (a, b) => {
  if (!a || !b) {
    return false;
  }

  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

/**
 * REGISTER USER
 */
const registerUser = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const goal = req.body.goal;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({
        message: "Name must be between 2 and 100 characters",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({
        message: "Password must be between 6 and 128 characters",
      });
    }

    const validGoals = ["bulk", "lean", "fit"];

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      goal: validGoals.includes(goal) ? goal : "fit",
    });

    const token = createAuthToken(user._id);

    return res.status(201).json({
      message: "User registered successfully",
      token,
      hasHealthProfile: false,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("❌ REGISTER ERROR:", error);

    /*
     * MongoDB unique-index race condition protection.
     */
    if (error?.code === 11000) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    return res.status(500).json({
      message: "Registration failed",
    });
  }
};

/**
 * LOGIN USER
 */
const loginUser = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    /*
     * Google-only users do not have a password.
     * Never allow the old "GOOGLE_AUTH" placeholder or an empty
     * password to authenticate.
     */
    if (!user || !user.password) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = createAuthToken(user._id);

    const healthProfile = await HealthProfile.findOne({
      user: user._id,
    })
      .select("_id")
      .lean();

    return res.status(200).json({
      message: "Login successful",
      token,
      hasHealthProfile: Boolean(healthProfile),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture || null,
      },
    });
  } catch (error) {
    console.error("❌ LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Login failed",
    });
  }
};

/**
 * FORGOT PASSWORD
 *
 * Creates a one-time OTP.
 *
 * Important:
 * - Raw OTP is never stored.
 * - OTP is hashed using bcrypt.
 * - OTP expires after 10 minutes.
 * - Attempts are limited.
 * - Any previous reset authorization is invalidated.
 */
const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        message: "Valid email is required",
      });
    }

    const user = await User.findOne({ email });

    /*
     * Do not reveal whether an email belongs to an account.
     *
     * This prevents account enumeration.
     */
    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists for this email, an OTP has been sent.",
      });
    }

    /*
     * Google-only users don't have a password to recover.
     */
    if (!user.password) {
      return res.status(200).json({
        message:
          "If an account exists for this email, an OTP has been sent.",
      });
    }

    const otp = crypto
      .randomInt(100000, 1000000)
      .toString();

    user.otpCode = await bcrypt.hash(otp, 12);

    user.otpExpires = new Date(
      Date.now() + OTP_EXPIRY_MS
    );

    user.otpAttempts = 0;
    user.otpVerified = false;

    /*
     * Any old password-reset authorization must be destroyed
     * when a new OTP is requested.
     */
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;

    await user.save();

    /*
     * Respond immediately so a slow email provider does not
     * make the mobile request time out.
     */
    res.status(200).json({
      message:
        "If an account exists for this email, an OTP has been sent.",
    });

    sendEmail(email, otp).catch((error) => {
      console.error(
        "❌ PASSWORD RESET EMAIL ERROR:",
        error.message
      );
    });
  } catch (error) {
    console.error(
      "❌ FORGOT PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to process password recovery",
    });
  }
};

/**
 * VERIFY OTP
 *
 * A successful OTP verification creates a short-lived,
 * single-use reset token.
 *
 * The OTP itself is destroyed immediately after successful
 * verification.
 */
const verifyOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || "").trim();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        message: "Valid email is required",
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "OTP must be 6 digits",
      });
    }

    const user = await User.findOne({ email });

    /*
     * Keep the response generic to reduce account enumeration.
     */
    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    if (
      !user.otpCode ||
      !user.otpExpires ||
      user.otpExpires.getTime() <= Date.now()
    ) {
      user.otpCode = undefined;
      user.otpExpires = undefined;
      user.otpAttempts = 0;
      user.otpVerified = false;

      await user.save();

      return res.status(400).json({
        message: "OTP expired. Please request a new OTP.",
      });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        message:
          "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    const isMatch = await bcrypt.compare(
      otp,
      user.otpCode
    );

    if (!isMatch) {
      user.otpAttempts += 1;

      await user.save();

      const remaining =
        MAX_OTP_ATTEMPTS - user.otpAttempts;

      return res.status(400).json({
        message:
          remaining > 0
            ? `Invalid OTP. ${remaining} attempt${
                remaining === 1 ? "" : "s"
              } remaining.`
            : "Invalid OTP. Please request a new OTP.",
      });
    }

    /*
     * Create a cryptographically secure reset token.
     *
     * Only the hash is stored in MongoDB.
     */
    const resetToken = crypto
      .randomBytes(32)
      .toString("hex");

    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetTokenHash = resetTokenHash;

    user.resetTokenExpires = new Date(
      Date.now() + RESET_TOKEN_EXPIRY_MS
    );

    /*
     * OTP becomes single-use.
     */
    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;

    /*
     * Kept for backward compatibility with older documents,
     * but resetPassword never relies on this boolean.
     */
    user.otpVerified = true;

    await user.save();

    return res.status(200).json({
      message: "OTP verified successfully.",
      resetToken,
    });
  } catch (error) {
    console.error(
      "❌ VERIFY OTP ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to verify OTP",
    });
  }
};

/**
 * RESET PASSWORD
 *
 * Authorization requires:
 *
 * email
 * +
 * valid resetToken
 * +
 * unexpired resetToken
 *
 * The reset token is single-use.
 */
const resetPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const resetToken = String(
      req.body.resetToken || ""
    ).trim();

    const newPassword = String(
      req.body.newPassword || ""
    );

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        message: "Valid email is required",
      });
    }

    if (!resetToken) {
      return res.status(400).json({
        message:
          "Password reset authorization is missing or expired.",
      });
    }

    if (
      newPassword.length < 6 ||
      newPassword.length > 128
    ) {
      return res.status(400).json({
        message:
          "Password must be between 6 and 128 characters.",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message:
          "Password reset authorization is invalid or expired.",
      });
    }

    if (
      !user.resetTokenHash ||
      !user.resetTokenExpires
    ) {
      return res.status(400).json({
        message:
          "Password reset authorization is invalid or expired.",
      });
    }

    if (
      user.resetTokenExpires.getTime() <= Date.now()
    ) {
      user.resetTokenHash = undefined;
      user.resetTokenExpires = undefined;
      user.otpVerified = false;

      await user.save();

      return res.status(400).json({
        message:
          "Password reset authorization has expired. Please request a new OTP.",
      });
    }

    const suppliedHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const validToken = safeHashCompare(
      suppliedHash,
      user.resetTokenHash
    );

    if (!validToken) {
      return res.status(400).json({
        message:
          "Invalid password reset authorization.",
      });
    }

    /*
     * Hash the new password before storing it.
     */
    const hashedPassword = await bcrypt.hash(
      newPassword,
      12
    );

    user.password = hashedPassword;

    /*
     * IMPORTANT:
     * Destroy the reset authorization immediately.
     * This makes the token single-use.
     */
    user.resetTokenHash = undefined;
    user.resetTokenExpires = undefined;

    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    user.otpVerified = false;

    await user.save();

    return res.status(200).json({
      message: "Password reset successful.",
    });
  } catch (error) {
    console.error(
      "❌ RESET PASSWORD ERROR:",
      error
    );

    return res.status(500).json({
      message: "Unable to reset password",
    });
  }
};

/**
 * GOOGLE LOGIN
 *
 * The mobile application must send an actual Google ID token.
 *
 * The backend verifies the token cryptographically against
 * GOOGLE_WEB_CLIENT_ID before creating/logging in the user.
 */
const googleLogin = async (req, res) => {
  try {
    const idToken = String(
      req.body.idToken || ""
    ).trim();

    if (!idToken) {
      return res.status(400).json({
        message: "Google ID token is required",
      });
    }

    if (!process.env.GOOGLE_WEB_CLIENT_ID) {
      console.error(
        "GOOGLE_WEB_CLIENT_ID is not configured"
      );

      return res.status(503).json({
        message:
          "Google authentication is not configured",
      });
    }

    const ticket =
      await googleClient.verifyIdToken({
        idToken,
        audience:
          process.env.GOOGLE_WEB_CLIENT_ID,
      });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        message: "Invalid Google token",
      });
    }

    const {
      email,
      name,
      picture,
      sub: googleId,
      email_verified: emailVerified,
    } = payload;

    if (
      !email ||
      !googleId ||
      emailVerified !== true
    ) {
      return res.status(401).json({
        message: "Invalid Google account",
      });
    }

    const normalizedEmail =
      normalizeEmail(email);

    let user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name:
          String(name || "FitLip User").trim() ||
          "FitLip User",
        picture: picture || undefined,
        googleId,
        /*
         * Google users intentionally do not receive a
         * local password.
         */
        password: undefined,
      });
    } else {
      /*
       * Existing account:
       *
       * - If it already has a Google ID, it must match.
       * - If it doesn't, safely link this verified Google
       *   identity to the existing email account.
       */
      if (
        user.googleId &&
        user.googleId !== googleId
      ) {
        return res.status(409).json({
          message:
            "This email is already linked to another Google account.",
        });
      }

      if (!user.googleId) {
        user.googleId = googleId;
      }

      if (picture && !user.picture) {
        user.picture = picture;
      }

      if (
        (!user.name || user.name === "FitLip User") &&
        name
      ) {
        user.name = String(name).trim();
      }

      await user.save();
    }

    const healthProfile =
      await HealthProfile.findOne({
        user: user._id,
      })
        .select("_id")
        .lean();

    const token = createAuthToken(user._id);

    return res.status(200).json({
      message: "Google login successful",
      token,
      hasHealthProfile: Boolean(
        healthProfile
      ),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture || null,
      },
    });
  } catch (error) {
    console.error(
      "❌ GOOGLE AUTH ERROR:",
      error
    );

    return res.status(401).json({
      message: "Invalid Google token",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
  googleLogin,
};