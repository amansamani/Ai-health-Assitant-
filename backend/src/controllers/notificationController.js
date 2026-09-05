const NotificationLog = require("../models/NotificationLog");

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(10, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const [total, unread, items] = await Promise.all([
      NotificationLog.countDocuments({ user: req.user.id }),
      NotificationLog.countDocuments({ user: req.user.id, readAt: null }),
      NotificationLog.find({ user: req.user.id }).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    ]);
    res.json({ items, total, unread, page, limit, hasMore: skip + items.length < total });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    const doc = await NotificationLog.findOneAndUpdate({ _id: req.params.id, user: req.user.id }, { $set: { readAt: new Date() } }, { new: true }).lean();
    if (!doc) return res.status(404).json({ message: "Notification not found" });
    res.json({ success: true, data: doc });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await NotificationLog.updateMany({ user: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ success: true });
  } catch (err) { next(err); }
};
