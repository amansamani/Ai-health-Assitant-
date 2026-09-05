const SocialNotification = require("../models/SocialNotification");
exports.listNotifications = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(10, Number.parseInt(req.query.limit, 10) || 20));
    const unreadOnly = String(req.query.unreadOnly || "").toLowerCase() === "true";
    const filter = { recipient: req.user.id };
    if (unreadOnly) filter.readAt = null;
    const [items, total, unreadCount] = await Promise.all([
      SocialNotification.find(filter).populate("actor", "name username picture profileImageUrl profileImageUpdatedAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      SocialNotification.countDocuments(filter),
      SocialNotification.countDocuments({ recipient: req.user.id, readAt: null }),
    ]);
    res.status(200).json({ items, total, unreadCount, page, limit, hasMore: page * limit < total });
  } catch (err) { res.status(500).json({ message: "Failed to load notifications" }); }
};
exports.markRead = async (req, res) => {
  const updated = await SocialNotification.findOneAndUpdate({ _id: req.params.id, recipient: req.user.id }, { $set: { readAt: new Date() } }, { new: true }).lean();
  if (!updated) return res.status(404).json({ message: "Notification not found" });
  res.status(200).json(updated);
};
exports.markAllRead = async (req, res) => {
  await SocialNotification.updateMany({ recipient: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
  res.status(200).json({ message: "Notifications marked as read" });
};
