"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { z } = require("zod");
const logger = require("../../config/logger");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const DetectedFoodSchema = z.object({
  name:       z.string().min(1),
  quantity:   z.number().positive(),
  unit:       z.string().min(1),
  calories:   z.number().nonnegative(),
  protein:    z.number().nonnegative(),
  carbs:      z.number().nonnegative(),
  fats:       z.number().nonnegative(),
  fiber:      z.number().nonnegative().default(0),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

const MealPhotoAnalysisSchema = z.object({
  items: z.array(DetectedFoodSchema).max(15),
  notes: z.string().optional().default(""),
});

function buildPrompt() {
  return `You are a nutrition expert analyzing a photo of a meal, with strong expertise in Indian food.

Identify every distinct food item visible in the image. For each item, estimate:
- name (be specific — e.g. "Roti" not "bread", "Dal Tadka" not "lentils")
- quantity (a realistic number for the visible portion)
- unit (e.g. "piece", "cup", "g", "bowl", "katori")
- calories, protein (g), carbs (g), fats (g), fiber (g) for that visible portion
- confidence: "high" if clearly identifiable, "medium" if a reasonable guess, "low" if uncertain

Use standard Indian food nutrition references for portion estimates (e.g. 1 roti ≈ 70 kcal,
1 cup cooked rice ≈ 200 kcal, 1 katori dal ≈ 120 kcal). If the image contains no food at all,
return an empty items array and explain why in "notes".

Respond ONLY with valid JSON, no markdown, no preamble, no explanation outside the JSON:
{
  "items": [
    { "name": "string", "quantity": number, "unit": "string", "calories": number, "protein": number, "carbs": number, "fats": number, "fiber": number, "confidence": "high"|"medium"|"low" }
  ],
  "notes": "string — any caveats, or why no food was detected"
}`;
}

async function analyzeMealPhoto(base64Image, mimeType = "image/jpeg") {
  const prompt = buildPrompt();

  let raw;
  try {
    const result = await model.generateContent([
      { inlineData: { data: base64Image, mimeType } },
      prompt,
    ]);
    raw = result.response.text();
  } catch (err) {
    logger.error({ err }, "Gemini image analysis call failed");
    throw new Error(`Gemini image analysis failed: ${err.message}`);
  }

  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    logger.error({ rawSnippet: clean.slice(0, 300) }, "AI returned invalid JSON for meal photo");
    throw new Error("AI returned invalid JSON for the photo analysis");
  }

  return MealPhotoAnalysisSchema.parse(parsed);
}

module.exports = { analyzeMealPhoto };