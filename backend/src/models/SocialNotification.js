const mongoose = require("mongoose");
const socialNotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { type: String, required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  readAt: { type: Date, default: null, index: true },
  dedupKey: { type: String, required: true },
}, { timestamps: true });
socialNotificationSchema.index({ recipient: 1, createdAt: -1 });
socialNotificationSchema.index({ recipient: 1, dedupKey: 1 }, { unique: true });
module.exports = mongoose.model("SocialNotification", socialNotificationSchema);
