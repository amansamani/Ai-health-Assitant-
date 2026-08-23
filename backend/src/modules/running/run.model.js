"use strict";

const mongoose = require("mongoose");

/*
 * One GPS sample. Stored as a plain subdocument array (not GeoJSON) because
 * we need the point's timestamp for pace/splits, and Mongo's geo indexes
 * don't buy us anything here — we never geo-query inside a route, only
 * render it client-side.
 */
const routePointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    // Epoch ms, not Date — keeps the array cheap to serialize/transfer and
    // matches what expo-location gives you (coords.timestamp).
    ts: { type: Number, required: true },
    alt: { type: Number, default: null },
  },
  { _id: false }
);

const runLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    activityType: {
      type: String,
      enum: ["run", "walk", "cycle"],
      default: "run",
    },

    // Full breadcrumb trail. Capped defensively at the controller level
    // (see MAX_ROUTE_POINTS) — a runaway client bug shouldn't be able to
    // write an unbounded array into a single document.
    route: {
      type: [routePointSchema],
      default: [],
    },

    distanceMeters: {
      type: Number,
      required: true,
      min: 0,
    },

    durationSeconds: {
      type: Number,
      required: true,
      min: 0,
    },

    // Derived, stored for cheap feed/history sorting instead of
    // recomputing on every read. 0 when distance is 0 (e.g. a paused/void run).
    avgPaceSecPerKm: {
      type: Number,
      default: 0,
      min: 0,
    },

    caloriesBurned: {
      type: Number,
      default: 0,
      min: 0,
    },

    startedAt: {
      type: Date,
      required: true,
    },

    endedAt: {
      type: Date,
      required: true,
    },

    // Cloudinary — same pattern as profile photos (utils/cloudinary.js).
    photoUrl: {
      type: String,
      default: null,
    },

    photoPublicId: {
      type: String,
      default: null,
    },

    caption: {
      type: String,
      trim: true,
      maxlength: 280,
      default: "",
    },

    // "public"    -> anyone (discover/global feed)
    // "followers" -> only accepted followers (default — matches the app's
    //                existing Follow-request privacy model)
    // "private"   -> owner only, still counts toward stats/streaks
    visibility: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
      index: true,
    },

    likes: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    // "gps" today; leaves room for a future manual/quick-add run entry
    // without a schema migration.
    source: {
      type: String,
      enum: ["gps", "manual"],
      default: "gps",
    },
  },
  { timestamps: true }
);

runLogSchema.virtual("likesCount").get(function likesCount() {
  return Array.isArray(this.likes) ? this.likes.length : 0;
});

runLogSchema.set("toJSON", { virtuals: true });
runLogSchema.set("toObject", { virtuals: true });

// "My run history" — newest first.
runLogSchema.index({ user: 1, startedAt: -1 });

// Feed query: runs visible to followers/public, newest first.
runLogSchema.index({ visibility: 1, startedAt: -1 });

module.exports =
  mongoose.models.RunLog || mongoose.model("RunLog", runLogSchema);
