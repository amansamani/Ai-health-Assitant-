"use strict";

const User = require("../models/User");
const logger = require("../config/logger");
const { isConfigured, uploadImageBuffer } = require("../utils/cloudinary");

/**
 * One-time safe migration for legacy profile photos stored in MongoDB.
 *
 * Existing binary photos are uploaded to Cloudinary first. Only after the
 * upload succeeds are the binary fields removed from MongoDB.
 */
async function migrateProfileImagesToCloudinary() {
  if (!isConfigured()) {
    return { configured: false, migrated: 0, failed: 0, skipped: 0 };
  }

  let migrated = 0;
  let failed = 0;
  let skipped = 0;

  const cursor = User.find({
    profileImageData: { $exists: true, $ne: null },
    $or: [
      { profileImagePublicId: { $exists: false } },
      { profileImagePublicId: null },
      { profileImagePublicId: "" },
    ],
  })
    .select("+profileImageData +profileImageContentType +profileImagePublicId profileImageUpdatedAt")
    .cursor();

  for await (const user of cursor) {
    try {
      if (!user.profileImageData || !user.profileImageData.length) {
        skipped += 1;
        continue;
      }

      const publicId = String(user._id);
      const result = await uploadImageBuffer(user.profileImageData, {
        publicId,
        folder: "fitlip/profiles",
        contentType: user.profileImageContentType || "image/jpeg",
      });

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            profileImageUrl: result.secure_url,
            profileImagePublicId: result.public_id,
            profileImageUpdatedAt: user.profileImageUpdatedAt || new Date(),
          },
          $unset: {
            profileImageData: 1,
            profileImageContentType: 1,
          },
        }
      );

      migrated += 1;
    } catch (error) {
      failed += 1;
      logger.error(
        { err: error, userId: user._id },
        "Legacy profile photo Cloudinary migration failed"
      );
    }
  }

  return { configured: true, migrated, failed, skipped };
}

module.exports = { migrateProfileImagesToCloudinary };
