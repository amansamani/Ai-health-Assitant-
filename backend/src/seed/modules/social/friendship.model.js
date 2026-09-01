const mongoose = require("mongoose");

// Deliberately simple: no follow-requests/approval flow. Whoever enters a
// valid friend code is instantly connected — the code itself (shared out
// of band, e.g. via a deep link) is the "invite". user1/user2 are always
// stored in a canonical order (see canonicalPair in the controller) so a
// unique index can prevent duplicate rows regardless of who added whom.
const friendshipSchema = new mongoose.Schema(
  {
    user1: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    user2: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

friendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });

module.exports = mongoose.model("Friendship", friendshipSchema);
