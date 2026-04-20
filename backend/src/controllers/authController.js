const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail");

// ─────────────────────────────────────────
// REGISTER USER
// ─────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

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

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
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
        goal: user.goal,
      },
    });

  } catch (error) {
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
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
        goal: user.goal,
      },
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────
// 1️⃣ FORGOT PASSWORD → SEND OTP
// ─────────────────────────────────────────
const forgotPassword = async (req, res) => {

  const { email } = req.body;

  try {

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otpCode = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    user.otpVerified = false;

    await user.save();

    await sendEmail(email, otp);

    res.status(200).json({
      message: "OTP sent to your email."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────
// 2️⃣ VERIFY OTP
// ─────────────────────────────────────────
const verifyOtp = async (req, res) => {

  const { email, otp } = req.body;

  try {

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.otpCode !== otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: "OTP has expired. Please try again." });
    }

    user.otpVerified = true;
    await user.save();

    res.status(200).json({
      message: "OTP verified successfully."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────
// 3️⃣ RESET PASSWORD
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

    await user.save();

    res.status(200).json({
      message: "Password reset successful."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ─────────────────────────────────────────
// EXPORT CONTROLLERS
// ─────────────────────────────────────────
module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  verifyOtp,
  resetPassword
};