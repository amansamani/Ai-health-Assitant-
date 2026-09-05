const SocialNotification = require("../models/SocialNotification");
const User = require("../models/User");

async function createSocialNotification({ recipient, actor, type, title, body, data = {}, dedupKey }) {
  if (!recipient || !dedupKey) return null;
  try {
    const existing = await SocialNotification.findOne({ recipient, dedupKey }).lean();
    if (existing) return existing;
    return await SocialNotification.create({ recipient, actor: actor || null, type, title, body, data, dedupKey });
  } catch (err) {
    if (err?.code === 11000) return SocialNotification.findOne({ recipient, dedupKey }).lean();
    throw err;
  }
}

async function actorName(actorId) {
  if (!actorId) return "Someone";
  const user = await User.findById(actorId).select("name username").lean();
  return user?.name || user?.username || "Someone";
}

module.exports = { createSocialNotification, actorName };
