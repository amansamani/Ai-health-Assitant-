"use strict";

const logger = require("../../config/logger");
const RunLog = require("./run.model");
const { sendEventNotification } = require("../../notifications/engagement.service");
const Follow = require("../social/follow.model");

const {
  isConfigured: cloudinaryConfigured,
  uploadImageBuffer,
  destroyImage,
} = require("../../utils/cloudinary");

const { getTimezone } = require("../../utils/date");

const {
  addEstimatedCaloriesForToday,
} = require("../../controllers/trackingController");

const { awardXp } = require("../social/gamification.service");

const {
  checkAndAwardStreakAchievements,
} = require("../social/achievement.service");

// A GPS breadcrumb every ~4-5m of movement over a 2 hour run is still
// well under this — it's a sanity ceiling against a buggy/malicious
// client, not a real-world limit.
const MAX_ROUTE_POINTS = 20000;

const PUBLIC_USER_FIELDS = "name username picture profileImageUrl profileImageUpdatedAt";

function computePaceSecPerKm(distanceMeters, durationSeconds) {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  const km = distanceMeters / 1000;
  return Math.round(durationSeconds / km);
}

function haversineMeters(a, b) {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function routeDistanceMeters(route) {
  if (!Array.isArray(route) || route.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < route.length; i += 1) total += haversineMeters(route[i - 1], route[i]);
  return total;
}

function plausibleActivitySpeed(activityType, distanceMeters, durationSeconds) {
  if (!durationSeconds) return distanceMeters <= 1000;
  const speed = distanceMeters / durationSeconds;
  const maxMetersPerSecond = activityType === "walk" ? 6 : activityType === "run" ? 12 : 40;
  return speed <= maxMetersPerSecond;
}

async function uploadRunPhotoIfPresent(userId, photoBase64) {
  if (!photoBase64) return { photoUrl: null, photoPublicId: null };

  if (!cloudinaryConfigured()) {
    logger.warn("Cloudinary not configured — skipping run photo upload");
    return { photoUrl: null, photoPublicId: null };
  }

  const cleaned = String(photoBase64).replace(/^data:[^;]+;base64,/, "");
  if (cleaned.length > 2_500_000) {
    throw new Error("Run photo is too large");
  }
  const buffer = Buffer.from(cleaned, "base64");
  if (!buffer.length || buffer.length > 1_500_000) {
    throw new Error("Run photo is too large");
  }

  const result = await uploadImageBuffer(buffer, {
    folder: "fitlip/runs",
    contentType: "image/jpeg",
  });

  return {
    photoUrl: result.secure_url || result.url || null,
    photoPublicId: result.public_id || null,
  };
}

/**
 * POST /api/runs
 *
 * Saves a completed GPS-tracked activity. The client does all live
 * tracking/math on-device (see mobile RunTrackingScreen) — this endpoint
 * just persists the finished result and fans it out into the rest of the
 * app (today's calorie tracker, XP, streaks).
 */
exports.createRun = async (req, res) => {
  try {
    const {
      activityType = "run",
      route = [],
      distanceMeters,
      durationSeconds,
      caloriesBurned = 0,
      startedAt,
      endedAt,
      caption = "",
      visibility = "followers",
      photoBase64 = null,
    } = req.body;

    if (
      !Number.isFinite(Number(distanceMeters)) ||
      !Number.isFinite(Number(durationSeconds)) ||
      !startedAt ||
      !endedAt
    ) {
      return res.status(400).json({
        message:
          "distanceMeters, durationSeconds, startedAt and endedAt are required",
      });
    }

    if (!Array.isArray(route)) {
      return res.status(400).json({ message: "route must be an array" });
    }

    // Downsample rather than reject — a long run on a chatty GPS interval
    // shouldn't fail to save. Evenly-spaced sampling keeps the polyline shape.
    let safeRoute = route;
    if (route.length > MAX_ROUTE_POINTS) {
      const step = Math.ceil(route.length / MAX_ROUTE_POINTS);
      safeRoute = route.filter((_, i) => i % step === 0);
    }

    const normalizedDistanceMeters = Math.max(0, Number(distanceMeters));
    const normalizedDurationSeconds = Math.max(0, Number(durationSeconds));
    const routeDistance = routeDistanceMeters(safeRoute);

    // Prevent easy client-side gamification cheating. A run may legitimately
    // have a sparse/incomplete GPS trace, so we only reject obviously
    // inconsistent claims rather than requiring an exact route match.
    if (routeDistance > 500) {
      const allowedMax = routeDistance * 1.75 + 2500;
      const allowedMin = Math.max(0, routeDistance * 0.35 - 2500);
      if (normalizedDistanceMeters > allowedMax || normalizedDistanceMeters < allowedMin) {
        return res.status(400).json({ message: "Activity distance does not match the GPS route" });
      }
    }

    if (!plausibleActivitySpeed(activityType, normalizedDistanceMeters, normalizedDurationSeconds)) {
      return res.status(400).json({ message: "Activity speed is not plausible for the selected activity" });
    }

    if (photoBase64 && String(photoBase64).length > 2_500_000) {
      return res.status(400).json({ message: "Run photo is too large" });
    }

    const { photoUrl, photoPublicId } = await uploadRunPhotoIfPresent(
      req.user.id,
      photoBase64
    );

    const run = await RunLog.create({
      user: req.user.id,
      activityType,
      route: safeRoute,
      distanceMeters: normalizedDistanceMeters,
      durationSeconds: normalizedDurationSeconds,
      avgPaceSecPerKm: computePaceSecPerKm(
        Number(distanceMeters),
        Number(durationSeconds)
      ),
      caloriesBurned: Math.max(0, Math.round(Number(caloriesBurned) || 0)),
      startedAt: new Date(startedAt),
      endedAt: new Date(endedAt),
      caption: String(caption).slice(0, 280),
      visibility,
      photoUrl,
      photoPublicId,
    });

    // Feed calories into the same daily tracker steps/workouts use.
    // "estimated" tier — a real wearable reading (source: "device")
    // still wins, addEstimatedCaloriesForToday already enforces that.
    if (run.caloriesBurned > 0) {
      await addEstimatedCaloriesForToday(
        req.user.id,
        run.caloriesBurned,
        getTimezone(req),
        "activity"
      );
    }

    const distanceKm = run.distanceMeters / 1000;

    awardXp(req.user.id, "runCompleted", `run:${run._id}`, {
      distanceMeters: run.distanceMeters,
    }).catch(() => {});

    // A run >= 5km gets a bit more, same idempotency-key pattern as the
    // rest of gamification.service (per-run key, so this can't double-fire).
    if (distanceKm >= 5) {
      awardXp(req.user.id, "runFiveKPlus", `run-5k:${run._id}`, {
        distanceMeters: run.distanceMeters,
      }).catch(() => {});
    }

    checkAndAwardStreakAchievements(req.user.id).catch(() => {});

    return res.status(201).json(run);
  } catch (error) {
    logger.error({ err: error }, "Create run error");
    return res.status(500).json({ message: "Failed to save run" });
  }
};

/**
 * GET /api/runs/me?page=1&limit=20
 */
exports.getMyRuns = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const [runs, total] = await Promise.all([
      RunLog.find({ user: req.user.id })
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean({ virtuals: true }),
      RunLog.countDocuments({ user: req.user.id }),
    ]);

    return res.status(200).json({
      runs: runs.map((run) => ({
        ...run,
        likesCount: Array.isArray(run.likes) ? run.likes.length : 0,
        likedByMe: (run.likes || []).some((id) => String(id) === String(req.user.id)),
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    logger.error({ err: error }, "Get my runs error");
    return res.status(500).json({ message: "Failed to fetch runs" });
  }
};

/**
 * GET /api/runs/:id
 */
/**
 * GET /api/runs/user/:userId?page=1&limit=12
 *
 * Activity history for a profile. Owners see all of their runs; other users
 * see public activities, plus follower-only activities when the follow
 * relationship is accepted.
 */
exports.getUserRuns = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const viewerId = String(req.user.id);
    const targetId = String(req.params.userId);

    const isOwner = viewerId === targetId;
    let visibilityQuery = { visibility: "public" };

    if (isOwner) {
      visibilityQuery = {};
    } else {
      const accepted = await Follow.exists({
        follower: req.user.id,
        following: req.params.userId,
        status: "accepted",
      });
      if (accepted) visibilityQuery = { visibility: { $in: ["public", "followers"] } };
    }

    const filter = { user: req.params.userId, ...visibilityQuery };
    const [runs, total] = await Promise.all([
      RunLog.find(filter)
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", PUBLIC_USER_FIELDS)
        .lean({ virtuals: true }),
      RunLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      runs: runs.map((run) => ({
        ...run,
        likesCount: Array.isArray(run.likes) ? run.likes.length : 0,
        likedByMe: (run.likes || []).some((id) => String(id) === viewerId),
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    logger.error({ err: error }, "Get user runs error");
    return res.status(500).json({ message: "Failed to fetch user activities" });
  }
};

exports.getRunById = async (req, res) => {
  try {
    const run = await RunLog.findById(req.params.id)
      .populate("user", PUBLIC_USER_FIELDS)
      .lean({ virtuals: true });

    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    const isOwner = String(run.user._id) === String(req.user.id);

    if (!isOwner && run.visibility === "private") {
      return res.status(403).json({ message: "This run is private" });
    }

    if (!isOwner && run.visibility === "followers") {
      const relation = await Follow.findOne({
        follower: req.user.id,
        following: run.user._id,
        status: "accepted",
      }).lean();

      if (!relation) {
        return res
          .status(403)
          .json({ message: "This run is only visible to followers" });
      }
    }

    return res.status(200).json({
      ...run,
      likesCount: Array.isArray(run.likes) ? run.likes.length : 0,
      isOwner,
      likedByMe: (run.likes || []).some(
        (id) => String(id) === String(req.user.id)
      ),
    });
  } catch (error) {
    logger.error({ err: error }, "Get run by id error");
    return res.status(500).json({ message: "Failed to fetch run" });
  }
};

/**
 * GET /api/runs/feed?page=1&limit=20
 *
 * Runs from people you follow (status "accepted"), plus your own, in one
 * reverse-chronological feed — same shape Strava/Adidas Running use.
 * "followers"-visibility runs from people you follow are included because
 * an accepted follow *is* the audience that visibility tier is for.
 */
exports.getFeed = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const page = Math.max(Number(req.query.page) || 1, 1);

    const followingRows = await Follow.find({
      follower: req.user.id,
      status: "accepted",
    })
      .select("following")
      .lean();

    const followingIds = followingRows.map((row) => row.following);
    const query = {
      $or: [
        // Your own activities are always visible in your feed, regardless of
        // their posting visibility. Other people's activities appear only
        // when you follow them and their activity is public/follower-visible.
        { user: req.user.id },
        {
          user: { $in: followingIds },
          visibility: { $in: ["public", "followers"] },
        },
      ],
    };

    const [runs, total] = await Promise.all([
      RunLog.find(query)
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", PUBLIC_USER_FIELDS)
        .lean({ virtuals: true }),
      RunLog.countDocuments(query),
    ]);

    const runsWithLikeState = runs.map((run) => ({
      ...run,
      // Do not rely on a Mongoose virtual after a lean query. Persisted likes
      // are the source of truth and this explicit count guarantees that the
      // count survives app restarts/background reloads.
      likesCount: Array.isArray(run.likes) ? run.likes.length : 0,
      likedByMe: (run.likes || []).some(
        (id) => String(id) === String(req.user.id)
      ),
    }));

    return res
      .status(200)
      .json({ runs: runsWithLikeState, total, page, limit });
  } catch (error) {
    logger.error({ err: error }, "Get run feed error");
    return res.status(500).json({ message: "Failed to fetch feed" });
  }
};

/**
 * POST /api/runs/:id/like — toggles like for the current user.
 */
exports.toggleLike = async (req, res) => {
  try {
    const run = await RunLog.findById(req.params.id).select(
      "user visibility likes"
    );

    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    const alreadyLiked = run.likes.some(
      (id) => String(id) === String(req.user.id)
    );

    const updated = await RunLog.findByIdAndUpdate(
      run._id,
      alreadyLiked
        ? { $pull: { likes: req.user.id } }
        : { $addToSet: { likes: req.user.id } },
      { new: true }
    ).select("likes");

    if (!alreadyLiked && String(run.user) !== String(req.user.id)) {
      sendEventNotification(run.user, "runLiked", { name: req.user.name || "Someone" }, `${run._id}:${req.user.id}`).catch(() => {});
    }

    return res.status(200).json({
      liked: !alreadyLiked,
      likesCount: updated.likes.length,
    });
  } catch (error) {
    logger.error({ err: error }, "Toggle run like error");
    return res.status(500).json({ message: "Failed to update like" });
  }
};

/**
 * DELETE /api/runs/:id — owner only.
 */
exports.deleteRun = async (req, res) => {
  try {
    const run = await RunLog.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    if (run.photoPublicId) {
      destroyImage(run.photoPublicId).catch((err) =>
        logger.warn({ err }, "Failed to delete run photo from Cloudinary")
      );
    }

    await run.deleteOne();

    return res.status(200).json({ message: "Run deleted" });
  } catch (error) {
    logger.error({ err: error }, "Delete run error");
    return res.status(500).json({ message: "Failed to delete run" });
  }
};
