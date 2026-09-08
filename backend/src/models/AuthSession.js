"use strict";

const mongoose = require("mongoose");

const authSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 200,
    },
    tokenVersion: {
      type: Number,
      required: true,
      min: 0,
    },
    pushToken: {
      type: String,
      default: undefined,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ user: 1, deviceId: 1 }, { unique: true });

authSessionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.tokenHash;
    return ret;
  },
});

module.exports = mongoose.model("AuthSession", authSessionSchema);
