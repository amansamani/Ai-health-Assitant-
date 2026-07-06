"use strict";

const HealthProfile = require("../health/health.model");
const DietPlan      = require("./dietPlan.model");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const redis = require("../../config/redis");
const logger = require("../../config/logger");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // abandoned chats clean themselves up after 7 days
const MAX_HISTORY = 20;

const sessionKey = (userId) => `chat:session:${userId}`;

async function getHistory(userId) {
  const raw = await redis.get(sessionKey(userId));
  return raw ? JSON.parse(raw) : [];
}

async function saveHistory(userId, history) {
  const trimmed = history.length > MAX_HISTORY * 2
    ? history.slice(-MAX_HISTORY * 2)
    : history;
  await redis.set(sessionKey(userId), JSON.stringify(trimmed), "EX", SESSION_TTL_SECONDS);
}

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

const aiChat = async (req, res, next) => {
  try {
    const userId  = req.user.id;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ message: "message is required" });
    }

    const history = await getHistory(userId);
    const systemContext = await buildSystemContext(userId);

    const chat = model.startChat({
      history: [
        {
          role:  "user",
          parts: [{ text: `[SYSTEM INSTRUCTIONS — follow these throughout the conversation]\n${systemContext}` }],
        },
        {
          role:  "model",
          parts: [{ text: "Understood. I'm ready to help with personalized nutrition advice based on this user's profile." }],
        },
        ...history,
      ],
      generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
    });

    const result = await chat.sendMessage(message.trim());
    const reply  = result.response.text().trim();

    history.push({ role: "user",  parts: [{ text: message.trim() }] });
    history.push({ role: "model", parts: [{ text: reply }] });

    await saveHistory(userId, history);

    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "AI chat error");    
    next(err);
  }
};

const clearChatSession = async (req, res) => {
  await redis.del(sessionKey(req.user.id));
  res.json({ cleared: true });
};

module.exports = { aiChat, clearChatSession };