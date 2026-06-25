"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { z } = require("zod");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ─────────────────────────────────────────────────────────────────────────────
// ZOD SCHEMA — validates every AI response before it touches the DB
// ─────────────────────────────────────────────────────────────────────────────

const MealItemSchema = z.object({
  mealName:   z.string(),
  items: z.array(z.object({
    name:   z.string(),
    amount: z.number().positive(),
    unit:   z.string(),
  })).min(1),
  calories: z.number().positive(),
  protein:  z.number().nonnegative(),
  carbs:    z.number().nonnegative(),
  fats:     z.number().nonnegative(),
  fiber:    z.number().nonnegative().default(0),
  tags:     z.array(z.string()).default([]),
});

const AiMealPlanSchema = z.object({
  breakfast: z.array(MealItemSchema).min(1),
  lunch:     z.array(MealItemSchema).min(1),
  dinner:    z.array(MealItemSchema).min(1),
  snack:     z.array(MealItemSchema).min(1),
  aiAdvice:  z.string(),         // personalized note shown to user
  warnings:  z.array(z.string()).default([]),  // allergy / disease flags
});

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(profile, targetCalories, macros) {
  const { goal, dietType, diseases, allergies, age, gender, weight, activityLevel } = profile;

  const CALORIE_SPLIT = {
    breakfast: Math.round(targetCalories * 0.28),
    lunch:     Math.round(targetCalories * 0.37),
    dinner:    Math.round(targetCalories * 0.28),
    snack:     Math.round(targetCalories * 0.07),
  };

  const diseasesStr  = diseases?.length  ? diseases.join(", ")  : "none";
  const allergiesStr = allergies?.length ? allergies.join(", ") : "none";

  return `You are a clinical nutritionist specializing in Indian cuisine and medical nutrition therapy.

USER PROFILE:
- Age: ${age}, Gender: ${gender}, Weight: ${weight}kg
- Activity: ${activityLevel}, Goal: ${goal}
- Diet type: ${dietType}
- Medical conditions: ${diseasesStr}
- Allergies: ${allergiesStr}

DAILY TARGETS:
- Total calories: ${targetCalories} kcal
- Protein: ${macros.proteinG}g, Carbs: ${macros.carbsG}g, Fats: ${macros.fatsG}g
- Breakdown: Breakfast ${CALORIE_SPLIT.breakfast} kcal | Lunch ${CALORIE_SPLIT.lunch} kcal | Dinner ${CALORIE_SPLIT.dinner} kcal | Snack ${CALORIE_SPLIT.snack} kcal

STRICT RULES:
1. Use ONLY Indian foods (dal, roti, rice, sabzi, paneer, curd, eggs, chicken, fruits etc.)
2. NEVER include foods the user is allergic to: ${allergiesStr}
3. Adapt meals for medical conditions: ${diseasesStr}
   - diabetes → low GI, avoid sugar/maida/white rice, prefer brown rice/oats/millets
   - hypertension → low sodium, avoid pickles/papad/processed foods
   - thyroid → avoid raw cruciferous veg (broccoli/cabbage/cauliflower) in large amounts
   - pcod/pcos → low carb, high protein, anti-inflammatory foods
   - cholesterol → low saturated fat, high fiber, avoid fried foods
4. ${dietType === "veg" || dietType === "vegan" ? "NO meat, chicken, fish, or eggs." : "Can include eggs, chicken, fish."}
5. Each meal must be realistic, simple to prepare, and portion sizes must be specific (e.g. 2 rotis, 1 cup dal)
6. Hit the calorie targets as closely as possible (±50 kcal per meal)

Respond ONLY with a valid JSON object — no markdown, no preamble, no explanation outside JSON:
{
  "breakfast": [{
    "mealName": "string",
    "items": [{ "name": "string", "amount": number, "unit": "string" }],
    "calories": number, "protein": number, "carbs": number, "fats": number, "fiber": number,
    "tags": ["string"]
  }],
  "lunch": [{ same structure }],
  "dinner": [{ same structure }],
  "snack": [{ same structure }],
  "aiAdvice": "2-3 sentence personalized advice for this user's conditions and goal",
  "warnings": ["any allergy or disease-specific warnings if relevant, else empty array"]
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

async function generateAiMealPlan(profile, targetCalories, macros) {
  const prompt = buildPrompt(profile, targetCalories, macros);

  let raw;
  try {
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    throw new Error(`Gemini API call failed: ${err.message}`);
  }

  // Strip markdown fences if model adds them
  const clean = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    throw new Error(`AI returned invalid JSON: ${err.message}\nRaw: ${clean.slice(0, 300)}`);
  }

  // Validate shape with Zod — throws ZodError with field-level detail if wrong
  const validated = AiMealPlanSchema.parse(parsed);
  return validated;
}

module.exports = { generateAiMealPlan };