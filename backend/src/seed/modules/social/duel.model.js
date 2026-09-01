const mongoose = require("mongoose");

// Progress isn't stored live — it's computed on read from DailyLog /
// WorkoutLog (see duel.service.js), so there's never a sync gap between
// "what actually happened" and "what the duel shows". Only the *final*
// scores get written, at resolution, to keep a permanent record once the
// underlying daily logs are no longer the source of truth for a closed duel.
const duelSchema = new mongoose.Schema(
  {
    challenger: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    opponent:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // "workouts" = count of completed WorkoutLog days in the window.
    // steps / caloriesBurned = summed from DailyLog in the window.
    metric: {
      type: String,
      enum: ["steps", "caloriesBurned", "workouts"],
      required: true,
    },

    durationDays: { type: Number, required: true, min: 1, max: 30 },

    status: {
      type: String,
      enum: ["pending", "active", "declined", "cancelled", "completed"],
      default: "pending",
    },

    // Set when the opponent accepts — a duel doesn't start ticking while
    // it's just a pending invite.
    startDate: { type: Date },
    endDate:   { type: Date },

    // Populated once by the resolution logic in duel.service.js; a null
    // winner on a completed duel means a tie.
    winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    finalChallengerScore: { type: Number },
    finalOpponentScore:   { type: Number },
  },
  { timestamps: true }
);

duelSchema.index({ challenger: 1, status: 1 });
duelSchema.index({ opponent: 1, status: 1 });

module.exports = mongoose.model("Duel", duelSchema);
