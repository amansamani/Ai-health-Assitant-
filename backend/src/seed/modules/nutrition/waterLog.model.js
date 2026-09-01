const mongoose = require("mongoose");

// One document per user per day.
// Each `logs` entry is a timestamped glass/sip event so the frontend
// can show a timeline and the user can undo the last entry.
const waterLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    date: {
      type: String, // "YYYY-MM-DD"
      required: true,
    },

    // Running daily total in ml
    totalMl: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Goal in ml — copied from health profile at log time so it doesn't shift
    // if the user later edits their profile mid-day
    goalMl: {
      type: Number,
      default: 2500,
    },

    // Individual drink events for undo / timeline
    logs: [
      {
        amount: { type: Number, required: true }, // ml
        label:  { type: String, default: "Water" }, // "Water", "Coconut water", "Lemon water", etc.
        loggedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// One doc per user per day
waterLogSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("WaterLog", waterLogSchema);