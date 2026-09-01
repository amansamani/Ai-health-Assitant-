"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const redis = require("../../config/redis");
const logger = require("../../config/logger");
const { buildAiContext, contextToPrompt } = require("../../services/aiContext.service");

let genAI;
let model;

function getModel() {
  if (!model) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }
  return model;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const MAX_HISTORY = 20;
const MAX_MESSAGE_LENGTH = 4000;

const sessionKey = (userId) => `chat:session:${userId}`;

async function getHistory(userId) {
  try {
    const raw = await redis.get(sessionKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    logger.warn({ err }, "Redis unavailable, chat continuing without history");
    return [];
  }
}

async function saveHistory(userId, history) {
  try {
    const trimmed = history.length > MAX_HISTORY * 2
      ? history.slice(-MAX_HISTORY * 2)
      : history;
    await redis.set(
      sessionKey(userId),
      JSON.stringify(trimmed),
      "EX",
      SESSION_TTL_SECONDS
    );
  } catch (err) {
    logger.warn({ err }, "Redis unavailable, could not save chat history");
  }
}

function buildSystemInstruction(context) {
  return `You are FitLip AI Coach, the personalized health, nutrition, fitness and activity assistant inside the FitLip app.

You have two kinds of information:
1. FITLIP USER CONTEXT below: current data fetched from this authenticated user's database.
2. CONVERSATION HISTORY: previous messages in this chat.

IMPORTANT DATA RULES:
- Treat FITLIP USER CONTEXT as the source of truth for user-specific facts.
- Never invent, guess, or silently substitute a user's weight, calories, meals, water, workouts, runs, steps, sleep, goals, allergies, conditions, progress, achievements, or other app data.
- If the requested data is not present in the context, clearly say that FitLip does not currently have that information available.
- Distinguish logged data from estimates. If a value is estimated or device-derived, say so when it matters.
- Use the user's local timezone and date labels. "today" means the context's today date.
- Do not reveal database IDs, tokens, credentials, internal implementation details, or private fields.
- Only discuss the authenticated user's own data. Never infer or expose another user's private data.

PERSONALIZATION:
- Use the user's profile, goal, diet type, allergies and health conditions when relevant.
- Never recommend an allergen listed in the user's allergies.
- Respect vegetarian/vegan/non-veg preferences.
- When comparing progress, use actual logged values and calculate simple differences/percentages carefully.
- When a question asks about today's intake, prefer today's meal logs and progress records; do not treat the active diet plan as food actually consumed.
- When a question asks about a workout, distinguish the planned workout from the completed workout log.
- When a question asks about running, use RunLog values rather than guessing from steps.
- When a question asks about hydration, use WaterLog rather than DailyLog.water when WaterLog exists.
- If data conflicts, prefer the more specific/current source and explain the discrepancy briefly.

HEALTH SAFETY:
- You are an assistant, not a doctor. Do not diagnose disease or prescribe medication.
- For serious symptoms, emergencies, eating-disorder concerns, severe allergic reactions, or other high-risk medical situations, recommend appropriate professional/urgent care.
- Do not claim certainty where the data or medical evidence is uncertain.

RESPONSE STYLE:
- Answer the user's actual question first.
- Be concise and practical by default, usually 3-8 sentences or a small bullet list.
- Use Indian food examples when food examples are useful.
- Use metric units and kcal/g/ml/km unless the user asks otherwise.
- If useful, show a short calculation (for example, target minus consumed).
- Do not mention that you are reading a database or "context" unless the user asks how the feature works.

CURRENT FITLIP USER CONTEXT:
${contextToPrompt(context)}`;
}

const aiChat = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ message: "message is required" });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        message: `message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    // Rebuild context on every turn so the assistant sees newly logged meals,
    // water, workouts, runs, weight and activity without requiring a new chat.
    const [history, context] = await Promise.all([
      getHistory(userId),
      buildAiContext(userId),
    ]);

    const chat = getModel().startChat({
      history: [
        {
          role: "user",
          parts: [{ text: `[FITLIP SYSTEM INSTRUCTIONS AND CURRENT USER CONTEXT]\n${buildSystemInstruction(context)}` }],
        },
        {
          role: "model",
          parts: [{ text: "Understood. I will answer using the current FitLip user data and conversation history without inventing user-specific facts." }],
        },
        ...history.map(({ role, parts }) => ({ role, parts })),
      ],
      generationConfig: {
        maxOutputTokens: 700,
        temperature: 0.55,
      },
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text().trim();

    history.push({
      role: "user",
      parts: [{ text: message }],
      ts: Date.now(),
    });
    history.push({
      role: "model",
      parts: [{ text: reply }],
      ts: Date.now(),
    });

    await saveHistory(userId, history);

    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "AI chat error");
    next(err);
  }
};

const clearChatSession = async (req, res) => {
  try {
    await redis.del(sessionKey(req.user.id));
  } catch (err) {
    logger.warn({ err }, "Redis unavailable, could not clear chat session");
  }
  res.json({ cleared: true });
};

const getChatHistoryCtrl = async (req, res) => {
  const history = await getHistory(req.user.id);
  const messages = history.map((entry, i) => ({
    id: `${entry.ts || i}_${entry.role}`,
    role: entry.role === "model" ? "assistant" : "user",
    content: entry.parts?.[0]?.text || "",
    ts: entry.ts || null,
  }));
  res.json({ messages });
};

module.exports = { aiChat, clearChatSession, getChatHistoryCtrl };
