"use strict";

const logger = require("../../config/logger");
const User = require("../../models/User");
const Follow = require("./follow.model");
const {
  isConfigured: cloudinaryConfigured,
  uploadImageBuffer,
  destroyImage,
} = require("../../utils/cloudinary");

const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "support", "fitlip", "official", "api", "help", "settings", "null", "undefined",
]);

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validUsername(value) {
  return /^[a-z0-9](?:[a-z0-9_.]{1,28}[a-z0-9])?$/.test(value);
}

function base36Random(length = 4) {
  return Math.random().toString(36).slice(2, 2 + length);
}

async function createUniqueUsername(name, excludeId = null) {
  const base = String(name || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20) || "user";

  let candidate = base;
  if (RESERVED_USERNAMES.has(candidate) || await User.exists({ username: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    candidate = `${base}_${base36Random(5)}`.slice(0, 30);
  }

  while (RESERVED_USERNAMES.has(candidate) || await User.exists({ username: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    candidate = `${base.slice(0, 24)}_${base36Random(5)}`.slice(0, 30);
  }
  return candidate;
}

exports.updateSocialProfile = async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const bio = String(req.body.bio ?? "").trim().slice(0, 160);
    const profileVisibility = String(req.body.profileVisibility || "private").trim().toLowerCase();

    if (username && (!validUsername(username) || RESERVED_USERNAMES.has(username))) {
      return res.status(400).json({
        message: "Username must be 3-30 characters using lowercase letters, numbers, _ or .",
      });
    }

    if (!["public", "private"].includes(profileVisibility)) {
      return res.status(400).json({ message: "Profile visibility must be public or private" });
    }

    if (username) {
      const collision = await User.findOne({ username, _id: { $ne: req.user.id } }).select("_id").lean();
      if (collision) return res.status(409).json({ message: "That username is already taken" });
      req.user.username = username;
    }

    req.user.bio = bio;
    req.user.profileVisibility = profileVisibility;
    await req.user.save();

    return res.status(200).json({
      message: "Social profile updated",
      profile: {
        id: req.user._id,
        name: req.user.name,
        username: req.user.username,
        bio: req.user.bio,
        picture: req.user.picture || null,
        profileVisibility: req.user.profileVisibility,
      },
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ message: "That username is already taken" });
    logger.error({ err }, "Update social profile error");
    return res.status(500).json({ message: "Failed to update social profile" });
  }
};

exports.ensureUsername = async (user) => {
  if (user.username) return user.username;
  const username = await createUniqueUsername(user.name, user._id);
  await User.updateOne({ _id: user._id, username: { $exists: false } }, { $set: { username } });
  user.username = username;
  return username;
};

exports.uploadProfilePhoto = async (req, res) => {
  try {
    if (!cloudinaryConfigured()) {
      return res.status(503).json({
        message: "Profile image storage is not configured on the server",
      });
    }

    const imageBase64 = String(req.body.imageBase64 || "").trim();
    const contentType = String(req.body.contentType || "image/jpeg").trim().toLowerCase();

    if (!imageBase64) return res.status(400).json({ message: "imageBase64 is required" });
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      return res.status(400).json({ message: "Only JPEG, PNG or WebP images are supported" });
    }

    const cleaned = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const imageBuffer = Buffer.from(cleaned, "base64");

    if (!imageBuffer.length || imageBuffer.length > 1_500_000) {
      return res.status(400).json({ message: "Profile photo must be under 1.5 MB" });
    }

    const previousPublicId = req.user.profileImagePublicId;
    const publicId = String(req.user._id);

    const result = await uploadImageBuffer(imageBuffer, {
      publicId,
      folder: "fitlip/profiles",
      contentType,
    });

    const updatedAt = new Date();

    await User.updateOne(
      { _id: req.user._id },
      {
        $set: {
          profileImageUrl: result.secure_url,
          profileImagePublicId: result.public_id,
          profileImageUpdatedAt: updatedAt,
        },
        $unset: {
          profileImageData: 1,
          profileImageContentType: 1,
        },
      }
    );

    // If the public ID somehow changes in the future, clean up the old asset
    // only after the new upload/database write has succeeded.
    if (previousPublicId && previousPublicId !== result.public_id) {
      try {
        await destroyImage(previousPublicId);
      } catch (cleanupError) {
        logger.warn({ err: cleanupError, publicId: previousPublicId }, "Old Cloudinary profile image cleanup failed");
      }
    }

    return res.status(200).json({
      message: "Profile photo updated",
      profileImageUpdatedAt: updatedAt,
      hasProfilePhoto: true,
    });
  } catch (err) {
    logger.error({ err }, "Upload profile photo error");
    return res.status(500).json({ message: "Failed to update profile photo" });
  }
};

exports.getProfilePhoto = async (req, res) => {
  try {
    const target = await User.findById(req.params.userId).select(
      "+profileImageUrl +profileImagePublicId +profileImageData +profileImageContentType +profileImageUpdatedAt profileVisibility"
    );

    if (!target) return res.status(404).end();

    if (target.profileVisibility === "private" && target._id.toString() !== req.user.id.toString()) {
      const accepted = await Follow.exists({
        follower: req.user.id,
        following: target._id,
        status: "accepted",
      });
      if (!accepted) return res.status(403).end();
    }

    // Preferred path: stream the Cloudinary asset through the API so a private
    // profile's storage URL is not exposed directly to other users.
    if (target.profileImageUrl) {
      const response = await fetch(target.profileImageUrl);
      if (!response.ok) {
        logger.warn({ status: response.status, userId: target._id }, "Cloudinary profile image fetch failed");
        return res.status(404).end();
      }

      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/jpeg";

      res.set({
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      });

      return res.status(200).send(Buffer.from(arrayBuffer));
    }

    // Backward-compatible fallback for an old binary image that hasn't been
    // migrated yet. Startup migration normally removes these fields.
    if (target.profileImageData) {
      res.set({
        "Content-Type": target.profileImageContentType || "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      });
      return res.status(200).send(target.profileImageData);
    }

    return res.status(404).end();
  } catch (err) {
    logger.error({ err }, "Get profile photo error");
    return res.status(500).end();
  }
};
