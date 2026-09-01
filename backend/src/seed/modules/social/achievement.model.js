const mongoose = require("mongoose");

// One document per earned badge. `key` is the dedup guard — streak
// milestones use a stable key like "workout_streak_7" (so re-checking
// never double-awards the same tier), duel wins use a per-duel key like
// "duel_win_<duelId>" (so counting a user's achievements with
// key starting "duel_win_" is literally their win count — no separate
// counter field to keep in sync).
const achievementSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    key:  { type: String, required: true },

    category: {
      type: String,
      enum: ["streak", "duel"],
      required: true,
    },
    metric: {
      type: String,
      enum: ["workout", "steps", "caloriesBurned", "duel"],
      required: true,
    },

    title:       { type: String, required: true },
    description: { type: String, required: true },
    icon:        { type: String, required: true }, // Ionicons name, for the share card / badge list
    value:       { type: Number }, // streak length in days, where applicable

    earnedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

achievementSchema.index({ user: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("Achievement", achievementSchema);
