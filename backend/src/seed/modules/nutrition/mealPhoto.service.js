"use strict";

const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const { z } = require("zod");
const logger = require("../../config/logger");
const FoodItem = require("./foodItem.model");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Model strategy ───────────────────────────────────────────────────────────
// gemini-2.5-pro requires a billing-enabled project — it's no longer on the
// free tier (Google moved Pro models behind billing in 2026), so it's not
// usable on a free API key: every call 429s with quota limit 0, permanently,
// not just under load. Primary is now gemini-3.6-flash, the current
// free-tier flash model (GA July 2026). 2.5-flash stays as a fallback in
// case 3.6 has an outage or your key doesn't have access to it yet.
// Override via env if you want to point at a different model without a code change.
const PRIMARY_MODEL  = process.env.GEMINI_VISION_MODEL          || "gemini-3.6-flash";
const FALLBACK_MODEL = process.env.GEMINI_VISION_FALLBACK_MODEL || "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_VISION_TIMEOUT_MS) || 25_000;

// Best-effort grounding against your own verified food database. This never
// throws and never blocks the response — if no match is found, or your
// `fooditems` documents use different field names than assumed below, the
// AI's own estimate is used untouched. See `extractPer100gFromDoc()` if you
// need to adapt the field names to your actual schema.
const ENABLE_DB_GROUNDING = process.env.MEAL_PHOTO_DB_GROUNDING !== "false";

// ── Output contract ──────────────────────────────────────────────────────────
// `weightGrams` is the single source of truth for "how much food is this" —
// everything else (quantity/unit) exists purely for a friendly UI label.
// Splitting "how much" (a vision/spatial question) from "how many calories
// per gram" (a lookup question) is what lets DB grounding correct the AI's
// nutrition numbers later without touching its portion estimate.
const DetectedFoodSchema = z.object({
  name:         z.string().min(1),
  quantity:     z.number().positive(),
  unit:         z.string().min(1),
  weightGrams:  z.number().positive(),
  calories:     z.number().nonnegative(),
  protein:      z.number().nonnegative(),
  carbs:        z.number().nonnegative(),
  fats:         z.number().nonnegative(),
  fiber:        z.number().nonnegative().default(0),
  confidence:   z.enum(["high", "medium", "low"]).default("medium"),
  portionBasis: z.string().optional().default(""),
  source:       z.enum(["ai_estimate", "db_grounded"]).default("ai_estimate"),
});

const MealPhotoAnalysisSchema = z.object({
  items: z.array(DetectedFoodSchema).max(15),
  notes: z.string().optional().default(""),
});

// ── Gemini structured-output schema ──────────────────────────────────────────
// Constraining the response shape at generation time (not just validating
// after the fact) removes almost all of the "model wrapped JSON in prose /
// used markdown fences / renamed a field" failures that regex-stripping used
// to paper over.
const GEMINI_RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    items: {
      type: SchemaType.ARRAY,
      maxItems: 15,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name:         { type: SchemaType.STRING, description: "Specific dish name, e.g. 'Dal Tadka' not 'lentils'" },
          quantity:     { type: SchemaType.NUMBER, description: "Portion count in the given unit, e.g. 2" },
          unit:         { type: SchemaType.STRING, description: "e.g. piece, katori, cup, bowl, g, ml" },
          weightGrams:  { type: SchemaType.NUMBER, description: "Best estimate of the item's total edible weight in grams" },
          calories:     { type: SchemaType.NUMBER },
          protein:      { type: SchemaType.NUMBER, description: "grams" },
          carbs:        { type: SchemaType.NUMBER, description: "grams" },
          fats:         { type: SchemaType.NUMBER, description: "grams" },
          fiber:        { type: SchemaType.NUMBER, description: "grams" },
          confidence:   { type: SchemaType.STRING, format: "enum", enum: ["high", "medium", "low"] },
          portionBasis: { type: SchemaType.STRING, description: "One short phrase on what you compared the portion to, e.g. 'fills ~1/3 of a 26cm plate' or 'matches a standard 150ml katori'" },
        },
        required: ["name", "quantity", "unit", "weightGrams", "calories", "protein", "carbs", "fats", "fiber", "confidence"],
      },
    },
    notes: { type: SchemaType.STRING, description: "Caveats, low-light/angle warnings, or why no food was found" },
  },
  required: ["items", "notes"],
};

function buildPrompt({ hasReferenceObject, angleCount } = {}) {
  const referenceLine = hasReferenceObject
    ? "The user has confirmed a known reference object (their hand, a coin, or a standard utensil) is visible in frame — use it to calibrate scale before estimating weight."
    : "No calibration object was confirmed in frame — fall back to the standard reference sizes below.";

  const angleLine = angleCount > 1
    ? `You have been given ${angleCount} photos of the same plate from different angles — use the extra angle(s) to judge food height/depth, not just the top-down footprint, before estimating weight.`
    : "You only have one angle of this plate. Note in \"notes\" if the angle makes height/depth hard to judge (this is the single biggest source of portion-size error, so flag it honestly rather than guessing confidently).";

  return `You are a nutrition expert analyzing a photo of a meal, with strong expertise in Indian food and Indian home-cooking portions.

${referenceLine}
${angleLine}

STEP 1 — Identify every distinct food item visible. Be specific: "Roti" not "bread", "Dal Tadka" not "lentils", "Jeera Rice" not "rice".

STEP 2 — Estimate the weight of each item in grams. Reason about scale using whichever of these is visible, in order of preference:
1. A confirmed reference object (hand, coin, standard cutlery) if present.
2. A standard Indian steel thali plate (~26–28cm diameter) or katori/bowl (~150ml capacity, ~120–150g when filled with dal/curry/sabzi).
3. Common object comparisons: a medium roti ≈ 35–40g cooked; a cupped palm of rice/dal ≈ 100g; a standard drinking glass ≈ 250ml; a level tablespoon of oil/ghee ≈ 13.5g.
4. Sanity-check the whole plate: the sum of every item's visible volume should roughly match how full the plate/bowl actually looks — don't let individual item estimates imply an impossibly overflowing or empty plate.

STEP 3 — From the estimated weight, compute calories, protein, carbs, fats, and fiber using standard nutrition density for that specific dish (e.g. 1 roti ≈ 70 kcal, 1 cup cooked rice (~150g) ≈ 200 kcal, 1 katori dal ≈ 120 kcal, accounting for visible oil/ghee/butter separately since it changes the calorie density a lot).

STEP 4 — Set confidence honestly: "high" only if the item and its portion are both clearly visible and unambiguous; "medium" for a reasonable but partly-obscured guess; "low" if the item is partially hidden, out of focus, or the portion size is genuinely hard to judge from this angle.

For each item also give a one-line "portionBasis" describing what you compared it to (this is shown to the user so they can correct you if you guessed wrong).

If the image contains no food at all, return an empty items array and explain why in "notes". If lighting, angle, or occlusion meaningfully limits your confidence, say so plainly in "notes" rather than silently guessing.`;
}

async function callGemini(modelName, parts, { timeoutMs } = {}) {
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent(
    {
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.15, // low temperature: we want consistent, repeatable portion estimates, not creative variation
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESPONSE_SCHEMA,
      },
    },
    { timeout: timeoutMs }
  );
  return result.response.text();
}

/**
 * Calls Gemini with automatic fallback: primary model first, then a single
 * retry on the fallback model if the primary fails or times out. This keeps
 * the feature usable even during a quota blip or transient outage on one model.
 */
async function analyzeWithFallback(parts) {
  try {
    return await callGemini(PRIMARY_MODEL, parts, { timeoutMs: REQUEST_TIMEOUT_MS });
  } catch (err) {
    logger.error({ err, model: PRIMARY_MODEL }, "Primary vision model failed, falling back");
    try {
      return await callGemini(FALLBACK_MODEL, parts, { timeoutMs: REQUEST_TIMEOUT_MS });
    } catch (fallbackErr) {
      logger.error({ err: fallbackErr, model: FALLBACK_MODEL }, "Fallback vision model also failed");
      throw fallbackErr;
    }
  }
}

// ── Food-DB grounding ─────────────────────────────────────────────────────────
// The vision model is good at "what is this and how big is the portion" but
// only OK at recalling exact nutrition-per-gram for a dish. Your own FoodItem
// collection is presumably a trusted source for that. So: keep the AI's
// weightGrams estimate (that's the genuinely hard vision problem), but if we
// find a confident name match in the DB, recompute calories/protein/carbs/
// fats/fiber from the DB's per-100g values instead of the AI's guess.
//
// NOTE: confirmed against a real `fooditems` document — nutrition lives in a
// nested `per100g` object, e.g. { per100g: { calories, protein, carbs, fats, fiber } }.
function extractPer100gFromDoc(doc) {
  const n = doc.per100g;
  if (!n || typeof n !== "object") return null;

  const { calories, protein, carbs, fats } = n;
  if ([calories, protein, carbs, fats].some((v) => typeof v !== "number" || Number.isNaN(v))) {
    return null;
  }

  return {
    calories,
    protein,
    carbs,
    fats,
    fiber: typeof n.fiber === "number" ? n.fiber : 0,
    // Docs declare their own serving base (usually 100g, but don't assume) —
    // fall back to 100 only if `serving.grams` is missing.
    baseGrams: typeof doc.serving?.grams === "number" ? doc.serving.grams : 100,
  };
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function findFoodDoc(name) {
  const escaped = escapeRegex(name.trim());
  if (!escaped) return null;

  // Exact (case-insensitive) match first, then a looser partial match.
  const exact = await FoodItem.findOne({ name: { $regex: `^${escaped}$`, $options: "i" } }).lean();
  if (exact) return exact;

  return FoodItem.findOne({ name: { $regex: escaped, $options: "i" } }).lean();
}

async function groundItemWithDB(item) {
  try {
    const doc = await findFoodDoc(item.name);
    if (!doc) return item;

    const per100g = extractPer100gFromDoc(doc);
    if (!per100g) return item;

    const ratio = item.weightGrams / per100g.baseGrams;
    return {
      ...item,
      calories: Math.round(per100g.calories * ratio),
      protein:  Number((per100g.protein * ratio).toFixed(1)),
      carbs:    Number((per100g.carbs * ratio).toFixed(1)),
      fats:     Number((per100g.fats * ratio).toFixed(1)),
      fiber:    Number((per100g.fiber * ratio).toFixed(1)),
      source:   "db_grounded",
    };
  } catch (err) {
    // Grounding is a best-effort enhancement — never let it break the analysis.
    logger.warn({ err, item: item.name }, "Food DB grounding failed for item, keeping AI estimate");
    return item;
  }
}

async function groundWithDB(items) {
  if (!ENABLE_DB_GROUNDING) return items;
  return Promise.all(items.map(groundItemWithDB));
}

/**
 * Analyzes one or more photos of the same meal (different angles help
 * portion-depth accuracy) and returns identified items with weight, macro,
 * and confidence estimates.
 *
 * @param {string[]|string} images - one or more base64-encoded image strings
 * @param {string} mimeType
 * @param {{ hasReferenceObject?: boolean }} [options]
 */
async function analyzeMealPhoto(images, mimeType = "image/jpeg", options = {}) {
  const imageList = Array.isArray(images) ? images : [images];
  if (imageList.length === 0) throw new Error("At least one image is required");

  const prompt = buildPrompt({
    hasReferenceObject: !!options.hasReferenceObject,
    angleCount: imageList.length,
  });

  const parts = [
    ...imageList.map((data) => ({ inlineData: { data, mimeType } })),
    { text: prompt },
  ];

  let raw;
  try {
    raw = await analyzeWithFallback(parts);
  } catch (err) {
    logger.error({ err }, "Gemini image analysis call failed on both models");
    throw new Error(`Gemini image analysis failed: ${err.message}`);
  }

  // responseSchema makes this a formality rather than a necessity, but we
  // keep it as a defense-in-depth guard against malformed responses / SDK
  // changes / a model that ignores the schema under load.
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
    logger.error({ err, parsed }, "AI response failed schema validation");
    throw new Error("AI returned a response in an unexpected shape");
  }

  const groundedItems = await groundWithDB(validated.items);

  return { ...validated, items: groundedItems };
}

module.exports = { analyzeMealPhoto };