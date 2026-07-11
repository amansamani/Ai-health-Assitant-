"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { z } = require("zod");
const logger = require("../../config/logger");
const { groundAnalysis } = require("./foodGrounding.service");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini's structured-output mode (responseSchema) guarantees valid JSON
// shaped exactly like this — no more markdown-fence stripping and hoping.
// Field order matters: Gemini fills fields in the order they're declared,
// so `visualReasoning` is declared *before* the numbers it justifies. That
// forces a short chain-of-thought ("plate is ~27cm, roti covers a third of
// it...") before the model commits to a gram figure, which measurably
// improves portion estimates over asking for numbers cold.
const responseSchema = {
  type: "OBJECT",
  properties: {
    imageAssessment: {
      type: "STRING",
      enum: ["clear", "blurry", "too_dark", "too_far", "partially_cropped"],
    },
    scaleReference: {
      type: "STRING",
      description: "The real-world object used to judge scale (e.g. 'standard steel thali ~27cm'), or 'none visible'.",
    },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name:                 { type: "STRING" },
          visualReasoning:      { type: "STRING" },
          estimatedWeightGrams: { type: "NUMBER" },
          quantity:             { type: "NUMBER" },
          unit:                 { type: "STRING" },
          calories:             { type: "NUMBER" },
          protein:              { type: "NUMBER" },
          carbs:                { type: "NUMBER" },
          fats:                 { type: "NUMBER" },
          fiber:                { type: "NUMBER" },
          confidence:           { type: "STRING", enum: ["high", "medium", "low"] },
        },
        required: [
          "name", "visualReasoning", "estimatedWeightGrams", "quantity", "unit",
          "calories", "protein", "carbs", "fats", "fiber", "confidence",
        ],
      },
    },
    notes: { type: "STRING" },
  },
  required: ["items", "notes"],
};

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema,
  },
});

const DetectedFoodSchema = z.object({
  name:                 z.string().min(1),
  visualReasoning:      z.string().optional().default(""),
  estimatedWeightGrams: z.number().nonnegative().default(0),
  quantity:             z.number().positive(),
  unit:                 z.string().min(1),
  calories:             z.number().nonnegative(),
  protein:              z.number().nonnegative(),
  carbs:                z.number().nonnegative(),
  fats:                 z.number().nonnegative(),
  fiber:                z.number().nonnegative().default(0),
  confidence:           z.enum(["high", "medium", "low"]).default("medium"),
});

const MealPhotoAnalysisSchema = z.object({
  imageAssessment: z.string().optional().default("clear"),
  scaleReference:  z.string().optional().default(""),
  items:           z.array(DetectedFoodSchema).max(15),
  notes:           z.string().optional().default(""),
});

const SIZE_ANCHORS = `Use whichever of these is visible as your ruler, and name it in "scaleReference":
- Standard Indian steel thali / dinner plate: 26-28 cm diameter
- Standard katori / small bowl: ~300 ml, ~10-12 cm diameter
- Standard drinking glass: ~300 ml
- Tablespoon: ~15 cm long · Teaspoon: ~12 cm long
- An adult hand (palm, fingers excluded): ~8-9 cm wide
- A smartphone, if visible: ~14-15 cm long
- 1 roti/chapati ≈ 15 cm diameter · 1 idli ≈ 7 cm diameter
If nothing reliable is visible, say "none visible" in "scaleReference" and lower your confidence — never silently guess scale.`;

function buildPrompt() {
  return `You are a meticulous nutrition expert analyzing a photo of a meal, with deep expertise in Indian food and realistic portion sizing.

For EACH food item you see, follow this order:
1. Identify it specifically (e.g. "Roti" not "bread", "Dal Tadka" not "lentils", "Chicken Curry" not "curry").
2. In "visualReasoning", write one short sentence comparing its size to a visible reference object — this is what your gram estimate is based on.
3. Convert that into estimatedWeightGrams: the actual weight of the visible/edible portion.
4. Only then fill in quantity + unit (a human-friendly serving, e.g. "2" + "piece", "1" + "katori", "150" + "g") and calories/protein/carbs/fats/fiber for that weight.

${SIZE_ANCHORS}

Other rules:
- If food is stacked, mixed, or partially hidden (rice under curry, roti under sabzi), say so in "notes" and use "medium" or "low" confidence rather than guessing precisely.
- If the photo is blurry, too dark, too far away, or the plate is cropped out of frame, set "imageAssessment" accordingly and lower confidence to match — do not present a shaky guess as certain.
- List every distinct item separately, up to 15. Do not merge different foods into one entry.
- If the image contains no food at all, return an empty items array and explain why in "notes".`;
}

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(err) {
  const status = err?.status || err?.response?.status;
  // Retry on rate limiting / transient server errors / no status at all
  // (network blip). Don't retry on 4xx like bad-request or safety blocks —
  // those will fail identically every time.
  return status === 429 || status === 500 || status === 503 || !status;
}

async function callGeminiWithRetry(parts) {
  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES || !isRetryable(err)) break;
      const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;
      logger.warn({ attempt, delay, err: err.message }, "Gemini call failed, retrying");
      await sleep(delay);
    }
  }
  throw lastErr;
}

async function analyzeMealPhoto(base64Image, mimeType = "image/jpeg") {
  if (!base64Image || base64Image.length < 100) {
    throw new Error("No image data received");
  }

  const prompt = buildPrompt();

  let raw;
  try {
    raw = await callGeminiWithRetry([
      { inlineData: { data: base64Image, mimeType } },
      prompt,
    ]);
  } catch (err) {
    logger.error({ err }, "Gemini image analysis call failed");
    throw new Error(`Gemini image analysis failed: ${err.message}`);
  }

  // responseSchema makes this reliably plain JSON, but we still strip
  // stray markdown fences defensively — cheap insurance against a model
  // update changing that behavior.
  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    logger.error({ rawSnippet: clean.slice(0, 300) }, "AI returned invalid JSON for meal photo");
    throw new Error("AI returned invalid JSON for the photo analysis");
  }

  let validated;
  try {
    validated = MealPhotoAnalysisSchema.parse(parsed);
  } catch (err) {
    logger.error({ issues: err.errors, rawSnippet: clean.slice(0, 300) }, "AI response failed schema validation");
    throw new Error("AI response didn't match the expected format");
  }

  // Ground each item against verified per100g nutrition data where a
  // confident match exists; keep the AI's own estimate otherwise. Either
  // way the item carries a `source` field so the client can be honest
  // about which numbers are verified vs. estimated.
  const groundedItems = await groundAnalysis(validated.items);

  return { ...validated, items: groundedItems };
}

module.exports = { analyzeMealPhoto };