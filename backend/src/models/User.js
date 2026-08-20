const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: false, // Google users have no password
    },
    googleId:  { type: String },
    picture:   { type: String },
    otpCode:        { type: String },
    otpAttempts: { type: Number, default: 0 },
    otpExpires:     { type: Date },
    otpVerified:    { type: Boolean, default: false },
    age: Number,
    height: Number,
    weight: Number,
    goal: {
      type: String,
      enum: ["bulk", "lean", "fit"],
      default: "fit",
    },
    pushToken: { type: String }, // Expo push token, set via /user/push-token
    // Shareable code for the friend-connect flow (e.g. "AX7K2M") — generated
    // lazily on first request rather than backfilled for every existing
    // user. Sparse index so users without one yet don't collide on null.
    friendCode: { type: String, unique: true, sparse: true },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);