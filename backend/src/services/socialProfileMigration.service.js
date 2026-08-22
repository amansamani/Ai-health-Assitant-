const User = require("../models/User");

const RESERVED = new Set([
  "admin",
  "administrator",
  "support",
  "fitlip",
  "official",
  "api",
  "help",
  "settings",
  "null",
  "undefined",
]);

function baseFromName(name) {
  return (
    String(name || "user")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20) || "user"
  );
}

function suffix() {
  return Math.random().toString(36).slice(2, 7);
}

async function uniqueUsername(name) {
  const base = baseFromName(name);
  let candidate = base;

  while (
    RESERVED.has(candidate) ||
    (await User.exists({ username: candidate }))
  ) {
    candidate = `${base}_${suffix()}`.slice(0, 30);
  }

  return candidate;
}

async function migrateSocialProfiles() {
  let updated = 0;

  const cursor = User.find({
    $or: [
      { username: { $exists: false } },
      { username: null },
      { profileVisibility: { $exists: false } },
    ],
  })
    .select("_id name username profileVisibility")
    .cursor();

  for await (const user of cursor) {
    const updates = {};

    if (!user.username) {
      updates.username = await uniqueUsername(user.name);
    }

    if (!user.profileVisibility) {
      updates.profileVisibility = "private";
    }

    if (Object.keys(updates).length > 0) {
      await User.updateOne(
        { _id: user._id },
        { $set: updates }
      );

      updated += 1;
    }
  }

  return { updated };
}

module.exports = {
  migrateSocialProfiles,
};