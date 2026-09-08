"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AuthSession = require("../models/AuthSession");

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_DEVICE_ID_LENGTH = 200;

const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const createOpaqueRefreshToken = () =>
  crypto.randomBytes(48).toString("base64url");

const normalizeDeviceId = (deviceId) => {
  const value = String(deviceId || "").trim();
  if (!value || value.length > MAX_DEVICE_ID_LENGTH) return null;
  return value;
};

const createAccessToken = (user, session) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: user._id,
      sid: session._id,
      tokenVersion: user.tokenVersion ?? 0,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: "fitlip-api",
      audience: "fitlip-mobile",
    }
  );
};

const createSession = async ({ user, deviceId, pushToken }) => {
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  if (!normalizedDeviceId) {
    const error = new Error("A valid deviceId is required");
    error.code = "INVALID_DEVICE_ID";
    throw error;
  }

  // One active refresh session per installation/device. Re-authentication
  // on the same device replaces that device's session rather than creating
  // unlimited persistent credentials.
  await AuthSession.deleteMany({
    user: user._id,
    deviceId: normalizedDeviceId,
  });

  const refreshToken = createOpaqueRefreshToken();
  const session = await AuthSession.create({
    user: user._id,
    tokenHash: hashRefreshToken(refreshToken),
    deviceId: normalizedDeviceId,
    tokenVersion: user.tokenVersion ?? 0,
    pushToken: pushToken || undefined,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  const accessToken = createAccessToken(user, session);

  return {
    accessToken,
    refreshToken,
    session,
  };
};

const refreshSession = async (refreshToken) => {
  if (!refreshToken) return null;

  const tokenHash = hashRefreshToken(refreshToken);
  const session = await AuthSession.findOne({ tokenHash });
  if (!session) return null;

  if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const User = require("../models/User");
  const user = await User.findById(session.user);
  if (!user || session.tokenVersion !== (user.tokenVersion ?? 0)) {
    session.revokedAt = new Date();
    await session.save();
    return null;
  }

  // Rotate the refresh credential on every use. If an old refresh token is
  // replayed later, it no longer matches the stored hash and cannot be reused.
  const nextRefreshToken = createOpaqueRefreshToken();
  session.tokenHash = hashRefreshToken(nextRefreshToken);
  session.lastUsedAt = new Date();
  await session.save();

  const accessToken = createAccessToken(user, session);

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    session,
    user,
  };
};

const revokeSession = async ({ sessionId, userId }) => {
  if (!sessionId || !userId) return false;

  const result = await AuthSession.updateOne(
    { _id: sessionId, user: userId, revokedAt: null },
    { $set: { revokedAt: new Date(), tokenHash: `revoked:${crypto.randomBytes(24).toString("hex")}` } }
  );

  return result.modifiedCount > 0;
};

const revokeAllSessions = async (userId) => {
  if (!userId) return 0;
  const result = await AuthSession.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount || 0;
};

module.exports = {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
  hashRefreshToken,
  normalizeDeviceId,
  createAccessToken,
  createSession,
  refreshSession,
  revokeSession,
  revokeAllSessions,
};
