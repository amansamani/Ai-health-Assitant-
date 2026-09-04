const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["followRequest", "newFollower", "followAccepted"], required: true },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true }
);

schema.index({ recipient: 1, actor: 1, type: 1 }, { unique: true });

module.exports = mongoose.models.FollowNotificationThrottle || mongoose.model("FollowNotificationThrottle", schema);
