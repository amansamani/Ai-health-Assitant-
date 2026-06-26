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

DAILY TARGETS (HARD LIMITS — must match exactly):
- Total calories: ${targetCalories} kcal  ← sum of all 4 meals MUST equal this ±30 kcal
- Protein: ${macros.proteinG}g, Carbs: ${macros.carbsG}g, Fats: ${macros.fatsG}g
- Meal budgets: Breakfast ${CALORIE_SPLIT.breakfast} kcal | Lunch ${CALORIE_SPLIT.lunch} kcal | Dinner ${CALORIE_SPLIT.dinner} kcal | Snack ${CALORIE_SPLIT.snack} kcal
  Each meal's "calories" field MUST match its budget ±30 kcal. DO NOT exceed.

STRICT RULES:
1. Use ONLY real, commonly eaten Indian foods (dal, roti, rice, sabzi, paneer, curd, eggs, chicken, fruits, etc.)
2. NEVER include foods the user is allergic to: ${allergiesStr}
3. Adapt meals for medical conditions: ${diseasesStr}
   - diabetes → low GI, no sugar/maida/white rice, use brown rice/oats/millets
   - hypertension → low sodium, no pickles/papad/processed foods
   - thyroid → avoid large amounts of raw cruciferous veg
   - pcod/pcos → low carb, high protein, anti-inflammatory
   - cholesterol → low saturated fat, high fiber, no fried foods
4. ${dietType === "veg" || dietType === "vegan" ? "NO meat, chicken, fish, or eggs." : "Can include eggs, chicken, fish."}
5. Portions MUST be realistic and specific — use standard Indian serving sizes:
   - Roti: 1 roti = ~70 kcal (30g). Never say "3 rotis" for a 200 kcal meal.
   - Cooked rice: 1 cup (150g) ≈ 200 kcal
   - Dal (cooked): 1 cup ≈ 120 kcal
   - Chicken breast (cooked): 100g ≈ 165 kcal
   - Paneer: 50g ≈ 135 kcal
   - Curd/yogurt: 100g ≈ 60 kcal
   Use these references to set item amounts. Do NOT invent arbitrary amounts.
6. The "calories" number for each meal must reflect the ACTUAL calories of the listed items at the given amounts. Verify your math before responding.
7. Meals must be practical — things an Indian person would eat daily, not exotic or restaurant food.

VERIFICATION STEP (do internally before output):
- Add up all item calories in each meal. Make sure meal total ≈ its budget.
- Add up all 4 meal calories. Make sure total ≈ ${targetCalories} kcal.

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

  // FIX: Even after prompting, LLMs sometimes overshoot. Clamp each meal's
  // calories to its budget so the daily total never exceeds targetCalories.
  const CALORIE_SPLIT_RATIOS = {
    breakfast: 0.28,
    lunch:     0.37,
    dinner:    0.28,
    snack:     0.07,
  };
  for (const mealType of ["breakfast", "lunch", "dinner", "snack"]) {
    const budget = targetCalories * CALORIE_SPLIT_RATIOS[mealType];
    for (const meal of validated[mealType] || []) {
      if (meal.calories > budget * 1.12) {
        const ratio   = budget / meal.calories;
        meal.calories = Math.round(budget);
        meal.protein  = Math.round(meal.protein * ratio);
        meal.carbs    = Math.round(meal.carbs   * ratio);
        meal.fats     = Math.round(meal.fats    * ratio);
        meal.fiber    = Math.round(meal.fiber   * ratio);
        // Scale item amounts so portions remain consistent with calories
        meal.items = meal.items.map((item) => ({
          ...item,
          amount: parseFloat((item.amount * ratio).toFixed(1)),
        }));
      }
    }
  }

  return validated;
}

module.exports = { generateAiMealPlan };