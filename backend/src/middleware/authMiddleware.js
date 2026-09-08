"use strict";

const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const User = require("../models/User");
const AuthSession = require("../models/AuthSession");
const { isValidTimeZone, DEFAULT_TIMEZONE } = require("../utils/date");

const protect = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authorization.slice(7).trim();
    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    if (!process.env.JWT_SECRET) {
      logger.error("JWT_SECRET is not configured");
      return res.status(500).json({ message: "Authentication service is not configured" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: "fitlip-api",
        audience: "fitlip-mobile",
      });
    } catch {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    if (!decoded?.id || !decoded?.sid) {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    const session = await AuthSession.findOne({
      _id: decoded.sid,
      user: user._id,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
      tokenVersion: user.tokenVersion ?? 0,
    });

    if (!session) {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }

    session.lastUsedAt = new Date();
    session.save().catch((error) => logger.error({ err: error }, "Failed to update auth session activity"));

    req.user = user;
    req.authSession = session;
    req.authSessionId = session._id;

    const requestedTimezone = req.headers["x-timezone"];
    if (requestedTimezone && isValidTimeZone(requestedTimezone)) {
      if (requestedTimezone !== user.timezone) {
        user.timezone = requestedTimezone;
        User.updateOne({ _id: user._id }, { $set: { timezone: requestedTimezone } }).catch((error) => {
          logger.error({ err: error }, "Failed to persist user timezone");
        });
      }
    } else if (!isValidTimeZone(user.timezone)) {
      user.timezone = DEFAULT_TIMEZONE;
    }

    return next();
  } catch (error) {
    logger.error({ err: error }, "Authentication middleware error");
    return res.status(401).json({ message: "Not authorized" });
  }
};

module.exports = protect;
