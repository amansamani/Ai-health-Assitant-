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
      required: false, // 👈 changed from true (Google users have no password)
    },
    googleId:  { type: String },         // 👈 new
    picture:   { type: String },         // 👈 new
    otpCode:        { type: String },
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
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);