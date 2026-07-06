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

module.exports = { trackingSchema, healthProfileSchema };