"use strict";

const jwt = require("jsonwebtoken");

const User = require(
  "../models/User"
);

const {
  isValidTimeZone,
  DEFAULT_TIMEZONE,
} = require(
  "../utils/date"
);

const protect = async (
  req,
  res,
  next
) => {
  try {
    const authorization =
      req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        message:
          "Not authorized, no token",
      });
    }

    const token =
      authorization
        .slice(7)
        .trim();

    if (!token) {
      return res.status(401).json({
        message:
          "Not authorized, no token",
      });
    }

    if (
      !process.env.JWT_SECRET
    ) {
      console.error(
        "JWT_SECRET is not configured"
      );

      return res.status(500).json({
        message:
          "Authentication service is not configured",
      });
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    if (
      !decoded ||
      !decoded.id
    ) {
      return res.status(401).json({
        message:
          "Not authorized, invalid token",
      });
    }

    const user =
      await User.findById(
        decoded.id
      ).select(
        "-password"
      );

    if (!user) {
      return res.status(401).json({
        message:
          "User not found",
      });
    }

    /*
     * Mobile app sends its current IANA timezone
     * on every authenticated request.
     *
     * Example:
     *
     * X-Timezone: Asia/Kolkata
     */
    const requestedTimezone =
      req.headers[
        "x-timezone"
      ];

    if (
      requestedTimezone &&
      isValidTimeZone(
        requestedTimezone
      )
    ) {
      if (
        requestedTimezone !==
        user.timezone
      ) {
        /*
         * Update the in-memory user immediately so THIS request
         * uses the current timezone.
         */
        user.timezone =
          requestedTimezone;

        /*
         * Persist asynchronously.
         *
         * We intentionally don't block every API request on
         * a timezone-only database write.
         */
        User.updateOne(
          {
            _id: user._id,
          },
          {
            $set: {
              timezone:
                requestedTimezone,
            },
          }
        ).catch((error) => {
          console.error(
            "Failed to persist user timezone:",
            error.message
          );
        });
      }
    } else if (
      !isValidTimeZone(
        user.timezone
      )
    ) {
      /*
       * Older users may have been created before timezone support.
       */
      user.timezone =
        DEFAULT_TIMEZONE;
    }

    req.user = user;

    return next();
  } catch (error) {
    if (
      error.name ===
        "TokenExpiredError" ||
      error.name ===
        "JsonWebTokenError" ||
      error.name ===
        "NotBeforeError"
    ) {
      return res.status(401).json({
        message:
          "Not authorized, token failed",
      });
    }

    console.error(
      "Authentication middleware error:",
      error
    );

    return res.status(500).json({
      message:
        "Authentication failed",
    });
  }
};

module.exports =
  protect;