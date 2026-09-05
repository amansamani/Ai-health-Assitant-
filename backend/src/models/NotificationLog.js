const mongoose = require("mongoose");

// One doc per (user, moment, day). The unique index is the actual
// anti-spam mechanism — a moment can only fire once per user per day,
// enforced at the database level rather than relying on in-memory state
// that wouldn't survive a worker restart.
const notificationLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    moment: { type: String, required: true }, // e.g. "morningKickoff", "duelWon"
    dateKey: { type: String, required: true }, // "YYYY-MM-DD", server-local day
    title: { type: String, default: "FitLip update" },
    body: { type: String, default: "You have a new FitLip update." },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationLogSchema.index({ user: 1, moment: 1, dateKey: 1 }, { unique: true });
// For the daily-cap check — "how many notifications has this user had today".
notificationLogSchema.index({ user: 1, dateKey: 1 });

module.exports = mongoose.model("NotificationLog", notificationLogSchema);
