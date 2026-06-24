"use strict";

const HealthProfile = require("../health/health.model");
const DietPlan      = require("./dietPlan.model");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ─── In-memory session store (per user, resets on server restart) ─────────────
// Shape: { [userId]: [{ role: "user"|"model", parts: [{ text }] }] }
const sessions = {};

const MAX_HISTORY = 20; // keep last 20 turns to stay within context limits

// ─── Build system context from user profile + plan ───────────────────────────

async function buildSystemContext(userId) {
  const [profile, plan] = await Promise.all([
    HealthProfile.findOne({ user: userId }).lean(),
    DietPlan.findOne({ user: userId, isActive: true }).lean(),
  ]);

  if (!profile) return "You are a helpful nutrition assistant.";

  const conditions = [
    ...(profile.diseases  || []),
    ...(profile.allergies || []).map((a) => `allergy to ${a}`),
  ].join(", ") || "none";

  const planSummary = plan?.summary
    ? `Current plan: ${plan.summary.targetCalories} kcal/day, protein ${plan.summary.macroTargets?.proteinG}g, carbs ${plan.summary.macroTargets?.carbsG}g, fats ${plan.summary.macroTargets?.fatsG}g.`
    : "No active diet plan.";

  return `You are a clinical nutrition coach specializing in Indian diets and medical nutrition therapy.

USER PROFILE:
- Age: ${profile.age}, Gender: ${profile.gender}
- Weight: ${profile.weight}kg, Height: ${profile.height}cm
- Activity: ${profile.activityLevel}, Goal: ${profile.goal}
- Diet type: ${profile.dietType}
- Medical conditions & allergies: ${conditions}
- ${planSummary}

RULES:
1. Always personalize answers using the user's profile above
2. Never recommend foods the user is allergic to
3. Give specific, actionable advice (amounts, timings, food names)
4. Keep responses concise — 3 to 6 sentences max unless the user asks for more detail
5. Use Indian food examples wherever possible (dal, roti, sabzi, paneer, curd, etc.)
6. If unsure about a medical claim, say so and recommend consulting a doctor
7. Never diagnose medical conditions`;
}

// ─── Controller ───────────────────────────────────────────────────────────────

const aiChat = async (req, res, next) => {
  try {
    const userId  = req.user.id;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "message is required" });
    }

    // Build or retrieve session history
    if (!sessions[userId]) sessions[userId] = [];

    const history = sessions[userId];

    // Build system context (fresh each call so profile changes reflect immediately)
    const systemContext = await buildSystemContext(userId);

    // Start Gemini chat with history
    const chat = model.startChat({
      history: [
        // Inject system context as first turn
        {
          role:  "user",
          parts: [{ text: `[SYSTEM INSTRUCTIONS — follow these throughout the conversation]\n${systemContext}` }],
        },
        {
          role:  "model",
          parts: [{ text: "Understood. I'm ready to help with personalized nutrition advice based on this user's profile." }],
        },
        // Then inject conversation history
        ...history,
      ],
      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    });

    const result = await chat.sendMessage(message.trim());
    const reply  = result.response.text().trim();

    // Save this turn to history
    history.push({ role: "user",  parts: [{ text: message.trim() }] });
    history.push({ role: "model", parts: [{ text: reply }] });

    // Trim history to avoid context explosion
    if (history.length > MAX_HISTORY * 2) {
      sessions[userId] = history.slice(-MAX_HISTORY * 2);
    }

    res.json({ reply });
  } catch (err) {
    console.error("AI chat error:", err.message);
    next(err);
  }
};

// ─── Clear session (optional — call on logout) ────────────────────────────────

const clearChatSession = (req, res) => {
  delete sessions[req.user.id];
  res.json({ cleared: true });
};

module.exports = { aiChat, clearChatSession };