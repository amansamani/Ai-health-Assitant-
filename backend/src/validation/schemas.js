const { z } = require("zod");

const trackingSchema = z.object({
  steps: z.coerce.number().int("steps must be a whole number").min(0).max(100000),
  water: z.coerce.number().min(0).max(50),
  sleep: z.coerce.number().min(0).max(24),
});

const healthProfileSchema = z
  .object({
    age: z.coerce.number().int().min(10).max(100),
    gender: z.enum(["male", "female"]),
    height: z.coerce.number().min(100, "height must be at least 100cm").max(250, "height must be under 250cm"),
    weight: z.coerce.number().min(20, "weight must be at least 20kg").max(300, "weight must be under 300kg"),
    activityLevel: z.enum(["sedentary", "light", "moderate", "active"]),
    goal: z.enum(["lose", "maintain", "gain"]),
    dietType: z.enum(["veg", "non-veg", "vegan"]),
    diseases: z.array(z.string().max(100)).max(20).optional(),
    allergies: z.array(z.string().max(100)).max(20).optional(),
  })
  .partial();

const workoutProgressSchema = z
  .object({
    workoutPlanId: z.string().min(1, "workoutPlanId is required"),
    exercisesTotal: z.coerce.number().int().min(0).max(100),
    exercisesCompleted: z.coerce.number().int().min(0).max(100),
    completedExerciseNames: z.array(z.string().max(200)).max(100).optional(),
    date: z.string().optional(),
  })
  .refine((data) => data.exercisesCompleted <= data.exercisesTotal, {
    message: "exercisesCompleted cannot exceed exercisesTotal",
    path: ["exercisesCompleted"],
  });

const base64ImageField = z.string().min(100, "image is required").max(14_000_000, "Image too large — compress before uploading");

// Accepts either the legacy single `imageBase64` field, or a new `images`
// array (1-2 photos — a second angle meaningfully improves portion/depth
// estimation). At least one of the two must be present.
const mealPhotoSchema = z
  .object({
    imageBase64: base64ImageField.optional(),
    images: z.array(base64ImageField).min(1).max(2).optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional().default("image/jpeg"),
    hasReferenceObject: z.coerce.boolean().optional().default(false),
  })
  .refine((data) => !!data.imageBase64 || (data.images && data.images.length > 0), {
    message: "Provide either imageBase64 or images",
    path: ["images"],
  });

module.exports = { trackingSchema, healthProfileSchema, workoutProgressSchema, mealPhotoSchema };