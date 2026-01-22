const mongoose = require("mongoose");

const dailyLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      default: () => new Date().setHours(0, 0, 0, 0),
    },
    steps: {
      type: Number,
      default: 0,
    },
    water: {
      type: Number, // in liters
      default: 0,
    },
    sleep: {
      type: Number, // in hours
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DailyLog", dailyLogSchema);
