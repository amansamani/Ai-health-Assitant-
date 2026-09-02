"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");
const redis = require("../../config/redis");
const logger = require("../../config/logger");
const { buildAiContext, contextToPrompt } = require("../../services/aiContext.service");
const { detectIntent, buildDeterministicReply } = require("../../services/aiIntent.service");

let genAI;
let model;
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.6-flash";

function getModel() {
  if (!model) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: CHAT_MODEL });
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
- Use the user's local timezone and date labels. "today" means the context.date.today value.
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
- Give a complete answer; never stop halfway through a sentence or list.
- For simple factual questions, prefer a short complete answer. For advice/reasoning questions, give the useful explanation and practical next steps.
- Use Indian food examples when food examples are useful.
- Use metric units and kcal/g/ml/km unless the user asks otherwise.
- If useful, show a short calculation (for example, target minus consumed).
- Do not mention that you are reading a database or "context" unless the user asks how the feature works.
- If the question is a standard FitLip app-data question, the application may provide a deterministic answer; do not contradict it.

CURRENT FITLIP USER CONTEXT:
${contextToPrompt(context)}`;
}


function buildFitLipCards(message, context, intent = "") {
  const q = String(message || "").toLowerCase();
  const cards = [];
  const t = context?.today || {};
  const targets = context?.targets || {};

  if (intent === "TODAY_TRACK") {
    const consumed = Number(t.nutrition?.caloriesConsumedFromMealLogs || 0);
    const calorieTarget = Number(targets.targetCalories || 0);
    const protein = Number(t.nutrition?.proteinGFromMealLogs || 0);
    const proteinTarget = Number(targets.proteinTargetG || 0);
    if (calorieTarget) {
      cards.push({
        type: "calories", title: "Today's calories", value: Math.round(consumed),
        target: calorieTarget, unit: "kcal", percent: (consumed / calorieTarget) * 100,
        subtitle: `${Math.max(Math.round(calorieTarget - consumed), 0)} kcal remaining`,
        actionLabel: "Log a meal", actionTarget: "meals",
      });
    }
    if (proteinTarget) {
      cards.push({
        type: "protein", title: "Today's protein", value: Math.round(protein),
        target: proteinTarget, unit: "g", percent: (protein / proteinTarget) * 100,
        subtitle: `${Math.max(Math.round(proteinTarget - protein), 0)} g remaining`,
        actionLabel: "Log a meal", actionTarget: "meals",
      });
    }
    return cards.slice(0, 2);
  }

  if (/water|hydration|drink|thirst/.test(q)) {
    const h = t.hydration || {};
    const total = Number(h.totalMl || 0);
    const goal = Number(h.goalMl || 2500);
    const remaining = Math.max(goal - total, 0);
    cards.push({
      type: "hydration", title: "Today's hydration", value: Math.round(total / 100) / 10,
      target: Math.round(goal / 100) / 10, unit: "L", percent: goal ? (total / goal) * 100 : 0,
      subtitle: remaining ? `${Math.round(remaining)} ml remaining` : "Daily goal reached",
      actionLabel: "Log water", actionTarget: "water",
    });
  }

  if (/calorie|calories|kcal|eaten|consume|intake/.test(q)) {
    const consumed = Number(t.nutrition?.caloriesConsumedFromMealLogs || 0);
    const target = Number(targets.targetCalories || 0);
    cards.push({
      type: "calories", title: "Today's calories", value: Math.round(consumed),
      target: target || undefined, unit: "kcal", percent: target ? (consumed / target) * 100 : null,
      subtitle: target ? `${Math.max(Math.round(target - consumed), 0)} kcal remaining` : "Based on logged meals",
      actionLabel: "Log a meal", actionTarget: "meals",
    });
  }

  if (/protein/.test(q)) {
    const consumed = Number(t.nutrition?.proteinGFromMealLogs || 0);
    const target = Number(targets.proteinTargetG || 0);
    cards.push({
      type: "protein", title: "Today's protein", value: Math.round(consumed),
      target: target || undefined, unit: "g", percent: target ? (consumed / target) * 100 : null,
      subtitle: target ? `${Math.max(Math.round(target - consumed), 0)} g remaining` : "Based on logged meals",
      actionLabel: "Log a meal", actionTarget: "meals",
    });
  }

  if (/workout|exercise|training|gym/.test(q)) {
    const plan = t.workout?.plan;
    const completed = (t.workout?.recentTodayLogs || []).some((log) => log.completed);
    if (plan) {
      cards.push({
        type: "workout", title: completed ? "Today's workout · completed" : `Today's workout · ${plan.title || "Plan"}`,
        value: plan.exercises?.length || 0, unit: "exercises", percent: completed ? 100 : 0,
        subtitle: plan.isRestDay ? "Rest day" : `${plan.exercises?.length || 0} exercises planned`,
        actionLabel: completed ? "View workout" : "Open workout", actionTarget: "workout",
      });
    }
  }

  if (/run|running|pace|distance/.test(q)) {
    const r = context?.recent7Days?.running || {};
    cards.push({
      type: "running", title: "Running · last 7 days", value: Number(r.distanceKm || 0).toFixed(1),
      unit: "km", subtitle: `${r.count || 0} run${r.count === 1 ? "" : "s"} · ${Math.round(Number(r.caloriesBurned || 0))} kcal burned`,
      actionLabel: "Open running", actionTarget: "running",
    });
  }

  if (/step|steps|activity/.test(q)) {
    const activity = t.activity || {};
    cards.push({
      type: "activity", title: "Today's activity", value: Math.round(Number(activity.steps || 0)),
      unit: "steps", subtitle: `${Math.round(Number(activity.caloriesBurned || 0))} kcal burned`,
      actionLabel: "View tracking", actionTarget: "tracking",
    });
  }

  if (/weight|progress|lost|gain|trend/.test(q)) {
    const weights = context?.progress?.weightHistory || [];
    if (weights.length) {
      const latest = weights[weights.length - 1]?.weightKg;
      const first = weights[0]?.weightKg;
      const delta = Number(latest) - Number(first);
      cards.push({
        type: "weight", title: "Weight progress", value: Number(latest).toFixed(1), unit: "kg",
        subtitle: weights.length > 1 ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg over ${weights.length} logged points` : "Latest logged weight",
        actionLabel: "View progress", actionTarget: "progress",
      });
    }
  }

  return cards.slice(0, 2);
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

    const intent = detectIntent(message);
    const deterministicReply = buildDeterministicReply(intent, context);

    // Common FitLip questions are answered by our own application logic.
    // This avoids unnecessary LLM calls and guarantees complete, data-backed answers.
    if (deterministicReply) {
      const cards = buildFitLipCards(message, context, intent);
      const reply = deterministicReply.trim();

      history.push({ role: "user", parts: [{ text: message }], ts: Date.now() });
      history.push({ role: "model", parts: [{ text: reply }], ts: Date.now() });
      await saveHistory(userId, history);

      return res.json({ reply, cards, intent, source: "fitlip" });
    }

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
        maxOutputTokens: 1200,
        temperature: 0.45,
      },
    });

    let result = await chat.sendMessage(message);
    let response = result.response;
    let reply = response.text().trim();

    // If Gemini was cut off by the output limit, retry once with a focused
    // instruction so the user receives a complete answer instead of a fragment.
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS") {
      logger.warn({ userId, finishReason, intent }, "Gemini response hit max output tokens; retrying concisely");
      result = await chat.sendMessage(
        "Please rewrite your previous answer as one complete, self-contained answer. Do not stop mid-sentence. Keep only the information needed to answer the user's question, using a short heading or bullets when helpful."
      );
      response = result.response;
      reply = response.text().trim();
    }

    if (!reply) {
      reply = "I couldn't generate a complete answer right now. Please try again.";
    }

    const cards = [];

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

    res.json({ reply, cards, intent, source: "gemini" });
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
