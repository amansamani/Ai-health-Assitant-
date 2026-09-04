const logger = require("../../config/logger");
const mongoose = require("mongoose");
const { sendFollowNotification } = require("../../notifications/engagement.service");
const User = require("../../models/User");
const Follow = require("./follow.model");
const { getGamificationSnapshot } = require("./gamification.config");

const PROFILE_FIELDS = "name username picture bio profileVisibility profileImageUrl profileImageUpdatedAt totalXp";

function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    picture: user.picture || null,
    profileImageUrl: user.profileImageUrl || null,
    bio: user.bio || "",
    profileVisibility: user.profileVisibility,
    hasProfilePhoto: Boolean(user.profileImageUpdatedAt),
    profileImageUpdatedAt: user.profileImageUpdatedAt || null,
    ...getGamificationSnapshot(user.totalXp || 0),
  };
}

exports.getPublicProfile = async (req, res) => {
  try {
    const identifier = String(req.params.identifier || "").trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { _id: identifier.match(/^[a-f0-9]{24}$/) ? identifier : undefined },
        { username: identifier },
      ].filter((item) => Object.values(item)[0] !== undefined),
    }).select(PROFILE_FIELDS);

    if (!user) return res.status(404).json({ message: "Profile not found" });

    const viewerId = req.user.id.toString();
    const targetId = user._id.toString();

    const [followerCount, followingCount, relation] = await Promise.all([
      Follow.countDocuments({ following: user._id, status: "accepted" }),
      Follow.countDocuments({ follower: user._id, status: "accepted" }),
      viewerId === targetId
        ? Promise.resolve(null)
        : Follow.findOne({ follower: viewerId, following: user._id }).lean(),
    ]);

    let canViewPrivate = viewerId === targetId;
    if (!canViewPrivate && user.profileVisibility === "private") {
      canViewPrivate = !!relation && relation.status === "accepted";
    }

    return res.status(200).json({
      ...publicUser(user),
      followerCount,
      followingCount,
      isSelf: viewerId === targetId,
      isFollowing: relation?.status === "accepted",
      followStatus: relation?.status || null,
      canView: user.profileVisibility === "public" || canViewPrivate,
    });
  } catch (err) {
    logger.error({ err }, "Get public profile error");
    return res.status(500).json({ message: "Failed to load profile" });
  }
};

exports.discoverProfiles = async (req, res) => {
  try {
    const query = normalizeUsername(req.query.q);
    if (query.length < 2) return res.status(200).json([]);

    const regex = new RegExp(escapeRegex(query), "i");
    const users = await User.find({
      _id: { $ne: req.user.id },
      profileVisibility: "public",
      $or: [{ username: regex }, { name: regex }],
    })
      .select(PROFILE_FIELDS)
      .sort({ username: 1 })
      .limit(12)
      .lean();

    const withCounts = await Promise.all(
      users.map(async (user) => {
        const [followers, following] = await Promise.all([
          Follow.countDocuments({ following: user._id, status: "accepted" }),
          Follow.countDocuments({ follower: user._id, status: "accepted" }),
        ]);
        return { ...publicUser(user), followerCount: followers, followingCount: following };
      })
    );

    return res.status(200).json(withCounts);
  } catch (err) {
    logger.error({ err }, "Discover profiles error");
    return res.status(500).json({ message: "Failed to discover profiles" });
  }
};

exports.followUser = async (req, res) => {
  try {
    const targetId = String(req.params.userId || "").trim();
    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const target = await User.findById(targetId).select(
      "name username picture profileVisibility profileImageUrl profileImageUpdatedAt totalXp"
    );
    if (!target) return res.status(404).json({ message: "User not found" });
    if (target._id.toString() === req.user.id.toString()) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const existing = await Follow.findOne({
      follower: req.user.id,
      following: target._id,
    }).lean();

    if (existing?.status === "accepted") {
      return res.status(200).json({
        message: "Already following",
        status: "accepted",
        alreadyFollowing: true,
        user: publicUser(target),
        follow: existing,
      });
    }

    if (existing?.status === "pending") {
      return res.status(200).json({
        message: "Follow request already pending",
        status: "pending",
        alreadyRequested: true,
        user: publicUser(target),
        follow: existing,
      });
    }

    const status = target.profileVisibility === "public" ? "accepted" : "pending";
    const relation = await Follow.create({
      follower: req.user.id,
      following: target._id,
      status,
    });

    const result = {
      message: status === "accepted" ? "Following" : "Follow request sent",
      status,
      alreadyFollowing: false,
      alreadyRequested: false,
      user: publicUser(target),
      follow: relation,
    };

    if (status === "accepted") {
      sendFollowNotification(
        target._id,
        req.user.id,
        "newFollower",
        {},
        `/(app)/social/profile?identifier=${encodeURIComponent(req.user.username || req.user.id.toString())}`
      ).catch(() => {});
    } else {
      sendFollowNotification(
        target._id,
        req.user.id,
        "followRequest",
        {},
        "/(app)/social/follow-requests"
      ).catch(() => {});
    }

    return res.status(201).json(result);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(200).json({ message: "Follow request already exists", status: "pending" });
    }
    logger.error({ err }, "Follow user error");
    return res.status(500).json({ message: "Failed to follow user" });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const targetId = String(req.params.userId || "").trim();
    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const deleted = await Follow.findOneAndDelete({
      follower: req.user.id,
      following: targetId,
    });
    if (!deleted) return res.status(404).json({ message: "Follow relationship not found" });
    return res.status(200).json({ message: "Unfollowed" });
  } catch (err) {
    logger.error({ err }, "Unfollow user error");
    return res.status(500).json({ message: "Failed to unfollow user" });
  }
};

function paginationParams(req) {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(10, Number.parseInt(req.query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

async function paginatedConnections(filter, populatePath, req) {
  const { page, limit, skip } = paginationParams(req);
  const [total, rows] = await Promise.all([
    Follow.countDocuments(filter),
    Follow.find(filter)
      .populate(populatePath, PROFILE_FIELDS)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const items = rows
    .filter((row) => row[populatePath])
    .map((row) => ({ ...publicUser(row[populatePath]), since: row.createdAt }));

  return {
    items,
    total,
    page,
    limit,
    hasMore: skip + items.length < total,
  };
}

exports.listFollowers = async (req, res) => {
  try {
    const data = await paginatedConnections({ follower: req.user.id, status: "accepted" }, "following", req);
    return res.status(200).json(data);
  } catch (err) {
    logger.error({ err }, "List following error");
    return res.status(500).json({ message: "Failed to load following" });
  }
};

exports.listFollowing = async (req, res) => {
  try {
    const data = await paginatedConnections({ following: req.user.id, status: "accepted" }, "follower", req);
    return res.status(200).json(data);
  } catch (err) {
    logger.error({ err }, "List followers error");
    return res.status(500).json({ message: "Failed to load followers" });
  }
};

async function canViewConnections(targetUserId, viewerId) {
  if (String(targetUserId) === String(viewerId)) return true;

  const target = await User.findById(targetUserId).select("profileVisibility").lean();
  if (!target) return null;
  if (target.profileVisibility === "public") return true;

  return Boolean(
    await Follow.exists({
      follower: viewerId,
      following: targetUserId,
      status: "accepted",
    })
  );
}

exports.listUserFollowers = async (req, res) => {
  try {
    const canView = await canViewConnections(req.params.userId, req.user.id);
    if (canView === null) return res.status(404).json({ message: "User not found" });
    if (!canView) return res.status(403).json({ message: "Followers are private" });

    const data = await paginatedConnections({ following: req.params.userId, status: "accepted" }, "follower", req);
    return res.status(200).json(data);
  } catch (err) {
    logger.error({ err }, "List user followers error");
    return res.status(500).json({ message: "Failed to load followers" });
  }
};

exports.listUserFollowing = async (req, res) => {
  try {
    const canView = await canViewConnections(req.params.userId, req.user.id);
    if (canView === null) return res.status(404).json({ message: "User not found" });
    if (!canView) return res.status(403).json({ message: "Following is private" });

    const data = await paginatedConnections({ follower: req.params.userId, status: "accepted" }, "following", req);
    return res.status(200).json(data);
  } catch (err) {
    logger.error({ err }, "List user following error");
    return res.status(500).json({ message: "Failed to load following" });
  }
};

exports.listFollowRequests = async (req, res) => {
  try {
    const { page, limit, skip } = paginationParams(req);
    const [total, rows] = await Promise.all([
      Follow.countDocuments({ following: req.user.id, status: "pending" }),
      Follow.find({ following: req.user.id, status: "pending" })
        .populate("follower", PROFILE_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const items = rows
      .filter((row) => row.follower)
      .map((row) => ({ ...publicUser(row.follower), requestId: row._id, requestedAt: row.createdAt }));

    return res.status(200).json({
      items,
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    logger.error({ err }, "List follow requests error");
    return res.status(500).json({ message: "Failed to load follow requests" });
  }
};

exports.respondFollowRequest = async (req, res) => {
  try {
    const requestId = String(req.params.requestId || "").trim();
    if (!mongoose.isValidObjectId(requestId)) {
      return res.status(400).json({ message: "Invalid follow request id" });
    }

    const { action } = req.body;
    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ message: "Action must be accept or reject" });
    }

    const relation = await Follow.findOne({
      _id: requestId,
      following: req.user.id,
      status: "pending",
    });

    if (!relation) return res.status(404).json({ message: "Follow request not found" });

    if (action === "accept") {
      relation.status = "accepted";
      await relation.save();

      sendFollowNotification(
        relation.follower,
        req.user.id,
        "followAccepted",
        {},
        `/(app)/social/profile?identifier=${encodeURIComponent(req.user.username || req.user.id.toString())}`
      ).catch(() => {});

      return res.status(200).json({ message: "Follow request accepted", status: "accepted" });
    }

    await relation.deleteOne();
    return res.status(200).json({ message: "Follow request declined", status: "rejected" });
  } catch (err) {
    logger.error({ err }, "Respond follow request error");
    return res.status(500).json({ message: "Failed to respond to follow request" });
  }
};
