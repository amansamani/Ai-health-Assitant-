const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    /*
     * Password is optional because Google-only accounts
     * authenticate through Google.
     */
    password: {
      type: String,
      required: false,
      select: true,
    },

    googleId: {
      type: String,
      default: undefined,
      sparse: true,
      index: true,
    },

    picture: {
      type: String,
      default: undefined,
    },

    // -------------------------------------------------------------------------
    // Password recovery
    // -------------------------------------------------------------------------

    /*
     * Raw OTP is NEVER stored.
     * otpCode contains a bcrypt hash.
     */
    otpCode: {
      type: String,
      default: undefined,
    },

    otpAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    otpExpires: {
      type: Date,
      default: undefined,
    },

    /*
     * Kept for backward compatibility with older documents.
     *
     * Password reset authorization MUST NOT rely on this field.
     * The resetTokenHash + resetTokenExpires pair is authoritative.
     */
    otpVerified: {
      type: Boolean,
      default: false,
    },

    /*
     * SHA-256 hash of the temporary password-reset token.
     *
     * The raw token is returned only after successful OTP
     * verification and is never stored in MongoDB.
     */
    resetTokenHash: {
      type: String,
      default: undefined,
    },

    resetTokenExpires: {
      type: Date,
      default: undefined,
    },

    // -------------------------------------------------------------------------
    // Basic profile
    // -------------------------------------------------------------------------

    age: {
      type: Number,
      min: 10,
      max: 100,
    },

    height: {
      type: Number,
      min: 100,
      max: 250,
    },

    weight: {
      type: Number,
      min: 20,
      max: 300,
    },

    goal: {
      type: String,
      enum: ["bulk", "lean", "fit"],
      default: "fit",
    },

    // -------------------------------------------------------------------------
    // Device / notifications
    // -------------------------------------------------------------------------

    pushToken: {
      type: String,
      default: undefined,
    },

    /*
     * IANA timezone.
     *
     * Examples:
     *
     * Asia/Kolkata
     * Asia/Dubai
     * America/New_York
     */
    timezone: {
      type: String,
      default: "UTC",
      trim: true,
    },

    // -------------------------------------------------------------------------
    // Social
    // -------------------------------------------------------------------------

    /*
     * Generated lazily for the friend-code system.
     *
     * sparse = users without a friendCode do not collide.
     */
    friendCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      minlength: 4,
      maxlength: 12,
    },

    // -------------------------------------------------------------------------
    // Authorization
    // -------------------------------------------------------------------------

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  {
    timestamps: true,
  }
);

/*
 * Normalize email before validation/save.
 */
userSchema.pre("validate", function (next) {
  if (this.email) {
    this.email = String(this.email)
      .trim()
      .toLowerCase();
  }

  next();
});

module.exports =
  mongoose.models.User ||
  mongoose.model("User", userSchema);