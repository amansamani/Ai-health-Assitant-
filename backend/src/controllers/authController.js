const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);
// ─────────────────────────────────────────
// REGISTER USER
// ─────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    const { name, email, password, goal } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const validGoals = ["bulk", "lean", "fit"];
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      goal: validGoals.includes(goal) ? goal : "fit",
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("❌ REGISTER ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────
// LOGIN USER
// ─────────────────────────────────────────
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });

  } catch (error) {
    console.error("❌ LOGIN ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────
// FORGOT PASSWORD → SEND OTP
// ─────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otpCode = await bcrypt.hash(otp, 10); // never store the raw code
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    user.otpVerified = false;
    user.otpAttempts = 0; // fresh OTP = fresh attempt budget
    await user.save();

    // ✅ Respond IMMEDIATELY, don't await email
    res.status(200).json({ message: "OTP sent to your email." });

    // Send email in background AFTER responding
    sendEmail(email, otp).catch(err => 
      console.error("❌ EMAIL ERROR:", err.message)
    );

  } catch (error) {
    console.error("❌ FORGOT PASSWORD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────
// VERIFY OTP
// ─────────────────────────────────────────
const MAX_OTP_ATTEMPTS = 5;

const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.otpCode || user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP expired." });
    }

    if (user.otpAttempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        message: "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    const isMatch = await bcrypt.compare(otp, user.otpCode);

    if (!isMatch) {
      user.otpAttempts += 1;
      await user.save();
      const remaining = MAX_OTP_ATTEMPTS - user.otpAttempts;
      return res.status(400).json({
        message: remaining > 0
          ? `Invalid OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Invalid OTP. Please request a new OTP.",
      });
    }

    user.otpVerified = true;
    user.otpAttempts = 0;
    await user.save();

    res.status(200).json({
      message: "OTP verified successfully."
    });

  } catch (err) {
    console.error("❌ VERIFY OTP ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────
// RESET PASSWORD
// ─────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters."
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.otpVerified) {
      return res.status(400).json({ message: "OTP not verified." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    user.password = hashed;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.otpVerified = false;
    user.otpAttempts = 0;

    await user.save();

    res.status(200).json({
      message: "Password reset successful."
    });

  } catch (err) {
    console.error("❌ RESET PASSWORD ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};
const googleLogin = async (req, res) => {
  const { idToken } = req.body;

  try {
    // 1. Verify token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_WEB_CLIENT_ID,
    });
    const { email, name, picture, sub: googleId } = ticket.getPayload();

    // 2. Find or create user in MongoDB
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name,
        picture,
        googleId,
        password: "GOOGLE_AUTH", // placeholder since password is required
      });
    }

    // 3. Return JWT
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      token,
      user: { name: user.name, email: user.email, picture: user.picture },
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ error: "Invalid Google token" });
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