"use strict";

const { z } = require("zod");

/*
 * ---------------------------------------------------------------------------
 * Tracking
 * ---------------------------------------------------------------------------
 */

const trackingSchema = z
  .object({
    steps: z.coerce
      .number()
      .int(
        "steps must be a whole number"
      )
      .min(0)
      .max(100000)
      .optional(),

    water: z.coerce
      .number()
      .min(0)
      .max(50)
      .optional(),

    sleep: z.coerce
      .number()
      .min(0)
      .max(24)
      .optional(),

    caloriesBurned:
      z.coerce
        .number()
        .min(0)
        .max(10000)
        .optional(),

    source: z
      .enum([
        "manual",
        "device",
        "estimated",
      ])
      .optional(),
  })
  .refine(
    (data) =>
      data.steps !==
        undefined ||
      data.water !==
        undefined ||
      data.sleep !==
        undefined ||
      data.caloriesBurned !==
        undefined,
    {
      message:
        "At least one of steps, water, sleep or caloriesBurned is required",
    }
  );

/*
 * ---------------------------------------------------------------------------
 * Health profile
 * ---------------------------------------------------------------------------
 */

const healthProfileFields = {
  age: z.coerce
    .number()
    .int()
    .min(10)
    .max(100),

  gender: z.enum([
    "male",
    "female",
  ]),

  height: z.coerce
    .number()
    .min(
      100,
      "height must be at least 100cm"
    )
    .max(
      250,
      "height must be under 250cm"
    ),

  weight: z.coerce
    .number()
    .min(
      20,
      "weight must be at least 20kg"
    )
    .max(
      300,
      "weight must be under 300kg"
    ),

  activityLevel: z.enum([
    "sedentary",
    "light",
    "moderate",
    "active",
  ]),

  /*
   * HealthProfile goal, NOT User.goal.
   *
   * lose
   * maintain
   * gain
   */
  goal: z.enum([
    "lose",
    "maintain",
    "gain",
  ]),

  dietType: z.enum([
    "veg",
    "non-veg",
    "vegan",
  ]),

  diseases: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(100)
    )
    .max(20)
    .optional()
    .default([]),

  allergies: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(100)
    )
    .max(20)
    .optional()
    .default([]),
};

/*
 * POST requires all health-profile fields.
 */
const healthProfileSchema =
  z.object(
    healthProfileFields
  );

/*
 * PUT allows partial updates.
 */
const healthProfileUpdateSchema =
  z.object(
    healthProfileFields
  )
  .partial();

/*
 * ---------------------------------------------------------------------------
 * Workout progress
 * ---------------------------------------------------------------------------
 */

const workoutProgressSchema =
  z
    .object({
      workoutPlanId:
        z.string().min(
          1,
          "workoutPlanId is required"
        ),

      exercisesTotal:
        z.coerce
          .number()
          .int()
          .min(0)
          .max(100),

      exercisesCompleted:
        z.coerce
          .number()
          .int()
          .min(0)
          .max(100),

      completedExerciseNames:
        z
          .array(
            z.string().max(200)
          )
          .max(100)
          .optional(),

      date: z
        .string()
        .optional(),
    })
    .refine(
      (data) =>
        data.exercisesCompleted <=
        data.exercisesTotal,
      {
        message:
          "exercisesCompleted cannot exceed exercisesTotal",
        path: [
          "exercisesCompleted",
        ],
      }
    );

/*
 * ---------------------------------------------------------------------------
 * Meal photo
 * ---------------------------------------------------------------------------
 */

const base64ImageField =
  z.string()
    .min(
      100,
      "image is required"
    )
    .max(
      14_000_000,
      "Image too large — compress before uploading"
    );

const mealPhotoSchema =
  z
    .object({
      imageBase64:
        base64ImageField.optional(),

      images: z
        .array(
          base64ImageField
        )
        .min(1)
        .max(2)
        .optional(),

      mimeType: z
        .enum([
          "image/jpeg",
          "image/png",
          "image/webp",
        ])
        .optional()
        .default(
          "image/jpeg"
        ),

      hasReferenceObject:
        z.coerce
          .boolean()
          .optional()
          .default(false),
    })
    .refine(
      (data) =>
        !!data.imageBase64 ||
        (data.images &&
          data.images.length >
            0),
      {
        message:
          "Provide either imageBase64 or images",
        path: ["images"],
      }
    );

/*
 * ---------------------------------------------------------------------------
 * Mongo ObjectId
 * ---------------------------------------------------------------------------
 */

const objectIdSchema =
  z
    .string()
    .regex(
      /^[0-9a-fA-F]{24}$/,
      "Invalid id"
    );

/*
 * ---------------------------------------------------------------------------
 * Friends
 * ---------------------------------------------------------------------------
 */

const addFriendSchema =
  z.object({
    code: z
      .string()
      .trim()
      .min(4)
      .max(12)
      .transform((value) =>
        value.toUpperCase()
      ),
  });

/*
 * ---------------------------------------------------------------------------
 * Duels
 * ---------------------------------------------------------------------------
 */

const createDuelSchema =
  z.object({
    opponentId:
      objectIdSchema,

    metric: z.enum([
      "steps",
      "caloriesBurned",
      "workouts",
    ]),

    durationDays:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(30),
  });

const respondDuelSchema =
  z.object({
    action: z.enum([
      "accept",
      "decline",
    ]),
  });

module.exports = {
  trackingSchema,
  healthProfileSchema,
  healthProfileUpdateSchema,
  workoutProgressSchema,
  mealPhotoSchema,
  objectIdSchema,
  addFriendSchema,
  createDuelSchema,
  respondDuelSchema,
};