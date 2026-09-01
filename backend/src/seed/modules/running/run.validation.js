"use strict";

const { z } = require("zod");

const routePointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  ts: z.coerce.number(), // epoch ms
  alt: z.coerce.number().nullable().optional(),
});

const runCreateSchema = z
  .object({
    activityType: z.enum(["run", "walk", "cycle"]).optional().default("run"),

    // Controller downsamples anything past MAX_ROUTE_POINTS, so the cap
    // here is just a body-size sanity check, not the real ceiling.
    route: z.array(routePointSchema).max(25000).optional().default([]),

    distanceMeters: z.coerce.number().min(0).max(500000), // 500km sanity cap
    durationSeconds: z.coerce.number().min(0).max(86400), // 24h sanity cap

    caloriesBurned: z.coerce.number().min(0).max(10000).optional().default(0),

    startedAt: z.coerce.date(),
    endedAt: z.coerce.date(),

    caption: z.string().max(280).optional().default(""),

    visibility: z
      .enum(["public", "followers", "private"])
      .optional()
      .default("followers"),

    // Raw base64 (with or without the data: prefix) — same shape the
    // meal-photo/profile-photo endpoints already accept.
    photoBase64: z.string().nullable().optional(),
  })
  .refine((data) => data.endedAt >= data.startedAt, {
    message: "endedAt must be at or after startedAt",
    path: ["endedAt"],
  });

module.exports = { runCreateSchema };
