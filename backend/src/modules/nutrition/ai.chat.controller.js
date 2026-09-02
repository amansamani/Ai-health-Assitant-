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
  return `You are FitLip AI Coach — the intelligent coach built into the FitLip health and fitness app.

FITLIP'S JOB:
- Help the user understand and act on their nutrition, workouts, running, hydration, activity and progress.
- Feel like a calm, knowledgeable FitLip coach, not a generic chatbot.
- Prefer the user's actual FitLip data whenever the question is personal.
- Give practical, specific guidance instead of generic motivational filler.

TRUST & DATA RULES:
- FITLIP USER CONTEXT is the source of truth for user-specific facts.
- Never invent, guess, or silently substitute user-specific numbers.
- Never expose IDs, credentials, tokens, private implementation details, or another user's data.
- Distinguish actual logged data from targets, plans, estimates and device-derived values.
- "Today" and "yesterday" use the user's local FitLip timezone.
- If the requested personal data is unavailable, say so plainly.
- Use metric units: kcal, g, ml/L, km, min/km, kg.

PERSONALIZATION:
- Respect the user's goal, diet type, allergies and medical conditions.
- Never recommend a listed allergen.
- Use Indian-food examples when useful.
- When comparing progress, use actual values and simple transparent calculations.
- For food intake, use meal logs; do not treat the planned diet as already eaten.
- For hydration, use WaterLog.
- For runs, use RunLog.
- For workouts, distinguish today's planned workout from completed logs.
- For steps/sleep/activity calories, use DailyLog data when present.

SAFETY:
- You are not a doctor and must not diagnose conditions or prescribe medication.
- For serious symptoms, emergencies, severe allergic reactions, or other high-risk concerns, direct the user to appropriate professional/urgent care.
- Do not overstate certainty.

RESPONSE STYLE:
- Answer the question first.
- Default to a concise, useful response.
- Use short headings and bullets when they genuinely help.
- You may use Markdown-style **bold**, headings, bullets and numbered lists. The FitLip app renders these as rich UI.
- Avoid excessive emojis; use at most 1-2 when they add meaning.
- Avoid canned phrases like "As an AI" or "I am here to help".
- When helpful, include a short calculation using the user's real data.
- When the user asks a broad question, connect the answer to the user's current FitLip status.

RICH FITLIP UI CONTRACT:
Return ONLY valid JSON with this shape:
{
  "reply": "string using optional Markdown formatting",
  "cards": [
    { "type": "calories" | "protein" | "hydration" | "activity" | "running" | "workout" | "weight" }
  ],
  "actions": [
    { "target": "home" | "nutrition" | "water" | "workout" | "tracking" | "running" | "progress" | "profile", "label": "short label" }
  ]
}

CARD RULES:
- Cards are requests for FitLip to render verified user data. Choose only card types clearly relevant to the user's question.
- Never put user-specific numeric values inside the card request. FitLip will fill verified values from the current context.
- Usually return 0-2 cards.
- Actions are optional navigation shortcuts only. Never request destructive or irreversible actions.
- Usually return 0-2 actions.
- Keep action labels to 20 characters or fewer.
- If a normal text answer is enough, return empty cards and actions arrays.

CURRENT FITLIP USER CONTEXT:
${contextToPrompt(context)}`;
}

function safeParseAiPayload(rawText) {
  const fallback = {
    reply: String(rawText || "").trim(),
    cards: [],
    actions: [],
  };

  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== "object") return fallback;

    const reply = typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : fallback.reply;

    const allowedCards = new Set([
      "calories", "protein", "hydration", "activity",
      "running", "workout", "weight",
    ]);
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards
          .filter((card) => card && allowedCards.has(card.type))
          .slice(0, 2)
          .map((card) => ({ type: card.type }))
      : [];

    const allowedTargets = new Set([
      "home", "nutrition", "water", "workout",
      "tracking", "running", "progress", "profile",
    ]);
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions
          .filter(
            (action) =>
              action &&
              allowedTargets.has(action.target) &&
              typeof action.label === "string" &&
              action.label.trim()
          )
          .slice(0, 2)
          .map((action) => ({
            target: action.target,
            label: action.label.trim().slice(0, 20),
          }))
      : [];

    return { reply, cards, actions };
  } catch {
    // Graceful fallback for any model response that isn't valid JSON.
    return fallback;
  }
}

function buildFitLipCards(context, requestedCards) {
  const today = context.today || {};
  const nutrition = today.nutrition || {};
  const hydration = today.hydration || {};
  const activity = today.activity || {};
  const workout = today.workout || {};
  const recent7 = context.recent7Days || {};
  const running = recent7.running || {};
  const progress = context.progress || {};
  const user = context.user || {};
  const targets = context.targets || {};

  const has = (value) => value !== null && value !== undefined;

  return requestedCards
    .map(({ type }) => {
      if (type === "calories") {
        const consumed = Number(nutrition.caloriesConsumedFromMealLogs || 0);
        const target = Number(targets.targetCalories || 0);
        if (!target && !consumed) return null;
        const remaining = Math.max(target - consumed, 0);
        return {
          type,
          title: "Today's calories",
          value: `${Math.round(consumed)} kcal`,
          secondary: target ? `${Math.round(target)} kcal target` : "No target set",
          progress: target ? Math.max(0, Math.min(1, consumed / target)) : null,
          detail: target ? `${Math.round(remaining)} kcal remaining` : `${nutrition.mealsLogged || 0} meal${nutrition.mealsLogged === 1 ? "" : "s"} logged`,
        };
      }

      if (type === "protein") {
        const consumed = Number(nutrition.proteinGFromMealLogs || 0);
        const target = Number(targets.proteinTargetG || 0);
        if (!target && !consumed) return null;
        return {
          type,
          title: "Today's protein",
          value: `${Math.round(consumed)} g`,
          secondary: target ? `${Math.round(target)} g target` : "No target set",
          progress: target ? Math.max(0, Math.min(1, consumed / target)) : null,
          detail: target ? `${Math.max(0, Math.round(target - consumed))} g remaining` : "Keep meals protein-rich",
        };
      }

      if (type === "hydration") {
        const total = Number(hydration.totalMl || 0);
        const goal = Number(hydration.goalMl || 0);
        return {
          type,
          title: "Hydration",
          value: `${(total / 1000).toFixed(1)} L`,
          secondary: goal ? `${(goal / 1000).toFixed(1)} L goal` : "Daily water",
          progress: goal ? Math.max(0, Math.min(1, total / goal)) : null,
          detail: goal ? `${Math.max(0, Math.round(goal - total))} ml remaining` : "Keep sipping through the day",
        };
      }

      if (type === "activity") {
        if (!activity) return null;
        return {
          type,
          title: "Today's activity",
          value: `${Math.round(Number(activity.steps || 0)).toLocaleString()} steps`,
          secondary: `${Number(activity.sleepHours || 0).toFixed(1)} h sleep`,
          progress: null,
          detail: `${Math.round(Number(activity.caloriesBurned || 0))} kcal active burn`,
        };
      }

      if (type === "running") {
        if (!running.count && !running.distanceKm) return null;
        const pace = running.runs?.[0]?.averagePaceMinPerKm;
        return {
          type,
          title: "Running · last 7 days",
          value: `${Number(running.distanceKm || 0).toFixed(1)} km`,
          secondary: `${Number(running.count || 0)} run${running.count === 1 ? "" : "s"}`,
          progress: null,
          detail: pace ? `Latest pace ${Number(pace).toFixed(2)} min/km` : `${Math.round(Number(running.caloriesBurned || 0))} kcal burned`,
        };
      }

      if (type === "workout") {
        const plan = workout.plan;
        const logs = workout.recentTodayLogs || [];
        if (!plan && !logs.length) return null;
        const completed = logs.some((log) => log.completed);
        return {
          type,
          title: completed ? "Today's workout" : "Today's workout plan",
          value: completed ? "Completed" : (plan?.title || "Planned workout"),
          secondary: completed
            ? `${Math.round(Number(logs.reduce((sum, l) => sum + Number(l.caloriesBurned || 0), 0)))} kcal logged`
            : `${Array.isArray(plan?.exercises) ? plan.exercises.length : 0} exercises`,
          progress: completed ? 1 : null,
          detail: completed ? "Nice work — keep the streak going." : (plan?.isRestDay ? "Rest day" : "Ready when you are"),
        };
      }

      if (type === "weight") {
        const history = Array.isArray(progress.weightHistory) ? progress.weightHistory : [];
        if (!history.length && !has(user.currentWeightKg)) return null;
        const latest = history[history.length - 1]?.weightKg ?? user.currentWeightKg;
        const first = history[0]?.weightKg ?? latest;
        const delta = Number(latest) - Number(first);
        return {
          type,
          title: "Weight progress",
          value: `${Number(latest).toFixed(1)} kg`,
          secondary: history.length > 1 ? `${Math.abs(delta).toFixed(1)} kg ${delta < 0 ? "down" : delta > 0 ? "up" : "unchanged"}` : "Current weight",
          progress: null,
          detail: context.user?.goal ? `Goal: ${context.user.goal}` : "Keep tracking consistently",
        };
      }

      return null;
    })
    .filter(Boolean);
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
          parts: [{ text: JSON.stringify({
            reply: "Understood. I’ll answer as your FitLip Coach using the current FitLip data.",
            cards: [],
            actions: [],
          }) }],
        },
        ...history.map(({ role, parts }) => ({ role, parts })),
      ],
      generationConfig: {
        maxOutputTokens: 900,
        temperature: 0.45,
        responseMimeType: "application/json",
      },
    });

    const result = await chat.sendMessage(message);
    const rawReply = result.response.text().trim();
    const payload = safeParseAiPayload(rawReply);

    const cards = buildFitLipCards(context, payload.cards);

    history.push({
      role: "user",
      parts: [{ text: message }],
      ts: Date.now(),
    });
    history.push({
      role: "model",
      parts: [{ text: payload.reply }],
      ts: Date.now(),
    });

    await saveHistory(userId, history);

    res.json({
      reply: payload.reply,
      cards,
      actions: payload.actions,
      meta: {
        today: context.today,
        timezone: context.timezone,
        coach: "fitlip",
      },
    });
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
