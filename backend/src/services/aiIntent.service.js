"use strict";

/*
 * FitLip deterministic AI router.
 *
 * The app owns the data, so common app-data questions should be answered from
 * the already-built FitLip context instead of spending an LLM call. Gemini is
 * reserved for open-ended questions that actually benefit from reasoning.
 */

function text(value) {
  return String(value || "").toLowerCase().replace(/[?!.:,;]+/g, " ").replace(/\s+/g, " ").trim();
}

function has(q, regex) {
  return regex.test(q);
}

function detectIntent(message) {
  const q = text(message);

  if (!q) return "UNKNOWN";
  if (/\b(today|todays|today's|daily|day)\b/.test(q) && /\b(track|tracking|progress|summary|status|stats|overview)\b/.test(q)) return "TODAY_TRACK";
  if (/\b(how am i doing|my progress today|today progress|daily progress|today summary)\b/.test(q)) return "TODAY_TRACK";

  // Highly specific data questions come before broad keyword matches.
  if (has(q, /\b(protein)\b/) && has(q, /\b(target|goal|need|should|daily)\b/)) return "PROTEIN_TARGET";
  if (has(q, /\b(protein)\b/)) return "PROTEIN";

  if (/\b(what did i eat|what have i eaten|meals today|today's meals|todays meals|my meals|food today)\b/.test(q)) return "MEALS_TODAY";
  if (/\b(last meal|latest meal|what was my last meal|recent meal)\b/.test(q)) return "LAST_MEAL";

  if (has(q, /\b(water|hydration|hydrate|drink|drank)\b/) && has(q, /\b(should|daily goal|daily target|target|goal|how much should)\b/)) return "WATER_TARGET";
  if (has(q, /\b(water|hydration|hydrate|drink|drank)\b/) && has(q, /\b(today|remaining|left|have|consumed|drank)\b/)) return "WATER";

  if (has(q, /\b(calorie|calories|kcal)\b/) && has(q, /\b(target|goal|allowance|should i eat|daily target)\b/)) return "CALORIE_TARGET";
  if (has(q, /\b(calorie|calories|kcal|consumed|intake|remaining|left)\b/)) return "CALORIES";

  if (has(q, /\b(carb|carbs|carbohydrate|carbohydrates|fat|fats|fiber)\b/) && has(q, /\b(today|target|goal|remaining|left|consumed|intake)\b/)) return "MACROS";

  if (has(q, /\b(step|steps)\b/) && has(q, /\b(today|daily|have|done|completed|activity)\b/)) return "STEPS";
  if (has(q, /\b(activity|active)\b/) && has(q, /\b(today|daily|steps|burned)\b/)) return "ACTIVITY";

  if (has(q, /\b(workout|exercise|training|gym)\b/) && has(q, /\b(today|today's|todays|planned|plan|schedule|scheduled|next)\b/)) return "TODAY_WORKOUT";
  if (has(q, /\b(workout|exercise|training)\b/) && has(q, /\b(done|completed|finish|finished|did i)\b/)) return "WORKOUT_STATUS";

  if (has(q, /\b(run|running|ran|distance|pace)\b/) && has(q, /\b(today|today's|todays|last|recent|week|weekly|run|running)\b/)) return "RUNNING";

  if (has(q, /\b(weight|weigh|kg|pounds|lbs)\b/) && has(q, /\b(progress|change|trend|lost|gain|today|latest|current)\b/)) return "WEIGHT_PROGRESS";

  if (has(q, /\b(diet plan|meal plan|my plan|planned meals|today's plan|todays plan)\b/)) return "DIET_PLAN";

  if (has(q, /\b(sleep|slept|hours sleep)\b/) && has(q, /\b(today|last night|recent|hours|how much)\b/)) return "SLEEP";

  if (has(q, /\b(week|weekly|last 7 days|past 7 days)\b/) && has(q, /\b(summary|progress|stats|track|tracking)\b/)) return "WEEK_SUMMARY";

  if (has(q, /\b(achievement|achievements|badge|badges|milestone|milestones)\b/)) return "ACHIEVEMENTS";
  if (has(q, /\b(xp|experience points|points)\b/)) return "XP";
  if (has(q, /\b(goal|my goal|fitness goal|nutrition goal)\b/) && has(q, /\b(what|my|current)\b/)) return "GOAL";

  return "UNKNOWN";
}


const FITLIP_SCOPE_PATTERNS = [
  /\b(fitness|fit|workout|workouts|exercise|exercises|training|gym|strength|cardio|running|run|walk|walking|cycling|cycle|ride|steps?|activity|calories?|kcal|nutrition|nutrients?|meal|meals|food|diet|protein|carbs?|carbohydrates?|fats?|fiber|hydration|water|sleep|recovery|stamina|endurance|mobility|flexibility|weight|body|wellness|health|healthy|habit|habits|goal|progress|pace|distance|heart rate|hr|burned|macros?|macro|vitamins?|minerals?|mindfulness|stress|anxiety|mental health|vo2|max heart rate|resting heart rate|body composition)\b/i,
  /\b(fitlip|my profile|my account|my plan|my data|my stats|my progress|today|today's|daily summary|weekly summary)\b/i,
];

const OUT_OF_SCOPE_PATTERNS = [
  /\b(coding|programming|java|javascript|typescript|python|c\+\+|c#|react|react native|node\.?js|html|css|sql|php|ruby|kotlin|swift|algorithm|leetcode|github|git|debug|debugging|software|api development|write code|code this)\b/i,
  /\b(stock|stocks|trading|crypto|bitcoin|forex|investment|investing|loan|mortgage|taxes?|legal advice|lawyer|politics|political|election|religion|essay|homework|assignment|physics|chemistry|calculus)\b/i,
];

function classifyScope(message) {
  const q = text(message);
  if (!q) return "unknown";
  if (/^(hi|hello|hey|hii|good morning|good afternoon|good evening|good night|thanks|thank you|who are you|what can you do)\b/i.test(q)) {
    return "allowed";
  }
  if (OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(q))) return "out_of_scope";
  if (FITLIP_SCOPE_PATTERNS.some((pattern) => pattern.test(q))) return "allowed";
  return "unknown";
}

function buildScopeGuardReply(scope) {
  if (scope === "out_of_scope") {
    return "I'm FitLip AI Coach, so I can help with fitness, nutrition, meals, health, activity, recovery, sleep, and your FitLip progress. I can't help with coding, programming, finance, politics, or other unrelated topics.";
  }
  return "I'm here specifically for your fitness, nutrition, health, activity, recovery, and FitLip progress. Ask me something about your meals, workouts, runs, sleep, hydration, goals, or health and I'll help.";
}

function n(value, fallback = 0) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(n(value) * factor) / factor;
}

function fmt(value, digits = 0) {
  return round(value, digits).toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function progressLine(label, consumed, target, unit) {
  const c = fmt(consumed);
  const t = n(target, 0);
  if (!t) return `${label}: ${c}${unit}`;
  const remaining = Math.max(t - n(consumed), 0);
  return `${label}: ${c}${unit} / ${fmt(t)}${unit} · ${fmt(remaining)}${unit} remaining`;
}

function latestWeight(history) {
  if (!Array.isArray(history) || !history.length) return null;
  return history[history.length - 1]?.weightKg ?? null;
}

function mealsList(meals) {
  if (!Array.isArray(meals) || !meals.length) return "No meals have been logged today.";
  return meals.map((meal) => {
    const food = meal?.food || {};
    const name = food.name || "Logged meal";
    const cal = food.calories != null ? `${fmt(food.calories)} kcal` : "calories unavailable";
    const amount = food.amount != null && food.unit ? ` · ${fmt(food.amount, 1)} ${food.unit}` : "";
    return `• ${name}${amount} · ${cal}`;
  }).join("\n");
}

function formatWorkout(context) {
  const workout = context?.today?.workout || {};
  const plan = workout.plan;
  const logs = workout.recentTodayLogs || [];
  const completed = logs.some((log) => log.completed);

  if (!plan) return "No workout is scheduled for today.";
  if (plan.isRestDay) return "Today is a rest day in your current workout plan.";

  const exercises = Array.isArray(plan.exercises) ? plan.exercises : [];
  const exerciseText = exercises.length
    ? exercises.slice(0, 6).map((e) => `• ${e.name}${e.sets ? ` · ${e.sets} sets` : ""}${e.reps ? ` × ${e.reps}` : ""}`).join("\n")
    : "No exercises are listed.";

  return `**${plan.title || "Today's workout"}**
Status: ${completed ? "Completed ✅" : "Not completed yet"}
Exercises: ${exercises.length}

${exerciseText}`;
}

function buildDeterministicReply(intent, context) {
  const today = context?.today || {};
  const nutrition = today.nutrition || {};
  const targets = context?.targets || {};
  const hydration = today.hydration || {};
  const activity = today.activity || {};
  const running = context?.recent7Days?.running || {};
  const progress = context?.progress || {};
  const user = context?.user || {};
  const meals = nutrition.mealLogs || [];

  switch (intent) {
    case "TODAY_TRACK": {
      const calorieTarget = n(targets.targetCalories);
      const proteinTarget = n(targets.proteinTargetG);
      const waterGoal = n(hydration.goalMl);
      const steps = n(activity.steps);
      const workoutLogs = today.workout?.recentTodayLogs || [];
      const workoutCompleted = workoutLogs.some((log) => log.completed);
      const workoutName = today.workout?.plan?.title || null;
      const todayKey = context?.date?.today || "";
      const todayRuns = (running.runs || []).filter((run) => {
        if (!run.startedAt || !todayKey) return false;
        try {
          return new Intl.DateTimeFormat("en-CA", { timeZone: context?.timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(run.startedAt)) === todayKey;
        } catch (_) {
          return false;
        }
      });
      const todayRunKm = todayRuns.reduce((sum, run) => sum + n(run.distanceKm), 0);

      return `**Today's progress · ${context?.date?.today || "Today"}**

${progressLine("🔥 Calories", nutrition.caloriesConsumedFromMealLogs, calorieTarget, " kcal")}
${progressLine("💪 Protein", nutrition.proteinGFromMealLogs, proteinTarget, " g")}
${progressLine("💧 Water", hydration.totalMl / 1000, waterGoal / 1000, " L")}
🚶 Steps: ${fmt(steps)}
🏋️ Workout: ${workoutName ? `${workoutName} · ${workoutCompleted ? "completed ✅" : "not completed"}` : "No workout scheduled"}
🏃 Run: ${todayRunKm ? `${fmt(todayRunKm, 1)} km` : "No run logged today"}
${activity.sleepHours ? `😴 Sleep: ${fmt(activity.sleepHours, 1)} h` : "😴 Sleep: No sleep data logged today"}

You have logged ${fmt(nutrition.mealsLogged)} meal${nutrition.mealsLogged === 1 ? "" : "s"} today. Keep going and use the remaining targets above to plan your next meal.`;
    }

    case "CALORIES":
      return `**Today's calories**\n\n${progressLine("🔥 Intake", nutrition.caloriesConsumedFromMealLogs, targets.targetCalories, " kcal")}\n\nThis is based on your logged meals today.`;

    case "CALORIE_TARGET":
      return `**Your calorie target**\n\n🎯 ${targets.targetCalories ? `${fmt(targets.targetCalories)} kcal/day` : "No calorie target is currently available."}\n⚙️ BMR: ${targets.bmr ? `${fmt(targets.bmr)} kcal` : "Not available"}\n🔥 Maintenance: ${targets.maintenanceCalories ? `${fmt(targets.maintenanceCalories)} kcal` : "Not available"}`;

    case "PROTEIN":
      return `**Today's protein**\n\n${progressLine("💪 Intake", nutrition.proteinGFromMealLogs, targets.proteinTargetG, " g")}\n\nBased on your logged meals today.`;

    case "PROTEIN_TARGET":
      return `**Your protein target**\n\n🎯 ${targets.proteinTargetG ? `${fmt(targets.proteinTargetG)} g/day` : "No protein target is currently available."}`;

    case "MACROS":
      return `**Today's macros**\n\n💪 Protein: ${fmt(nutrition.proteinGFromMealLogs)} g${targets.proteinTargetG ? ` / ${fmt(targets.proteinTargetG)} g` : ""}\n🍚 Carbs: ${fmt(nutrition.carbsGFromMealLogs)} g${targets.carbTargetG ? ` / ${fmt(targets.carbTargetG)} g` : ""}\n🥑 Fats: ${fmt(nutrition.fatsGFromMealLogs)} g${targets.fatTargetG ? ` / ${fmt(targets.fatTargetG)} g` : ""}\n🌾 Fiber: ${fmt(nutrition.fiberGFromMealLogs)} g\n\nThese values come from today's logged meals.`;

    case "WATER_TARGET":
      return `**Your daily water goal**\n\n💧 ${fmt(hydration.goalMl)} ml/day (${fmt(hydration.goalMl / 1000, 1)} L)\n\nYour logged intake today is ${fmt(hydration.totalMl / 1000, 1)} L.`;

    case "WATER":
      return `**Today's hydration**\n\n${progressLine("💧 Water", hydration.totalMl / 1000, hydration.goalMl / 1000, " L")}\n\nGoal: ${fmt(hydration.goalMl)} ml/day.`;

    case "STEPS":
      return `**Today's steps**\n\n🚶 ${fmt(activity.steps)} steps\n🔥 ${fmt(activity.caloriesBurned)} kcal burned from tracked activity${activity.source ? `\nSource: ${activity.source}` : ""}`;

    case "ACTIVITY":
      return `**Today's activity**\n\n🚶 Steps: ${fmt(activity.steps)}\n🔥 Calories burned: ${fmt(activity.caloriesBurned)} kcal\n🏃 Exercise calories: ${fmt(activity.exerciseCaloriesBurned)} kcal\n⌚ Activity calories: ${fmt(activity.activityCaloriesBurned)} kcal`;

    case "TODAY_WORKOUT":
      return formatWorkout(context);

    case "WORKOUT_STATUS": {
      const logs = today.workout?.recentTodayLogs || [];
      if (!logs.length) return "You don't have a workout completion log for today yet.";
      const completed = logs.filter((log) => log.completed).length;
      const calories = logs.reduce((sum, log) => sum + n(log.caloriesBurned), 0);
      return `**Today's workout status**\n\n${completed ? "✅ Workout completed." : "⏳ Workout not completed yet."}\n🔥 Workout calories logged: ${fmt(calories)} kcal`;
    }

    case "RUNNING":
      return `**Running · last 7 days**\n\n🏃 Runs: ${fmt(running.count)}\n📏 Distance: ${fmt(running.distanceKm, 1)} km\n🔥 Calories burned: ${fmt(running.caloriesBurned)} kcal`;

    case "WEIGHT_PROGRESS": {
      const weights = progress.weightHistory || [];
      const latest = latestWeight(weights);
      if (latest == null) return "I don't have a logged weight value available right now.";
      const first = weights[0]?.weightKg;
      const delta = first != null ? n(latest) - n(first) : null;
      const trend = delta == null ? "" : `\n📈 Change across logged points: ${delta > 0 ? "+" : ""}${fmt(delta, 1)} kg`;
      return `**Weight progress**\n\n⚖️ Latest logged weight: ${fmt(latest, 1)} kg${trend}`;
    }

    case "MEALS_TODAY":
      return `**Meals logged today**\n\n${mealsList(meals)}\n\nTotal: ${fmt(nutrition.caloriesConsumedFromMealLogs)} kcal · ${fmt(nutrition.proteinGFromMealLogs)} g protein`;

    case "LAST_MEAL": {
      const last = meals[meals.length - 1];
      if (!last) return "No meal has been logged today yet.";
      const food = last.food || {};
      return `**Latest meal**\n\n${food.name || "Logged meal"}${food.amount != null && food.unit ? ` · ${fmt(food.amount, 1)} ${food.unit}` : ""}\n🔥 ${fmt(food.calories)} kcal · 💪 ${fmt(food.protein)} g protein`;
    }

    case "DIET_PLAN": {
      const plan = targets.dietPlan;
      if (!plan) return "You don't have an active diet plan available right now.";
      return `**Your active diet plan**\n\n🎯 Calories: ${fmt(plan.targetCalories)} kcal/day\n💪 Protein: ${plan.macroTargets?.proteinG != null ? `${fmt(plan.macroTargets.proteinG)} g` : "Not set"}\n🍚 Carbs: ${plan.macroTargets?.carbsG != null ? `${fmt(plan.macroTargets.carbsG)} g` : "Not set"}\n🥑 Fats: ${plan.macroTargets?.fatsG != null ? `${fmt(plan.macroTargets.fatsG)} g` : "Not set"}`;
    }

    case "SLEEP":
      return `**Today's sleep data**\n\n😴 ${activity.sleepHours ? `${fmt(activity.sleepHours, 1)} hours` : "No sleep data logged today."}`;

    case "WEEK_SUMMARY": {
      const nutrition7 = context?.recent7Days?.nutrition || {};
      const water7 = context?.recent7Days?.hydration || [];
      const workouts7 = context?.recent7Days?.workouts || {};
      return `**Last 7 days**\n\n🍽️ Logged meal calories: ${fmt(nutrition7.totalCaloriesFromMealLogs)} kcal\n💧 Hydration records: ${fmt(water7.length)} days\n🏋️ Completed workouts: ${fmt(workouts7.completedCount)}\n🏃 Running: ${fmt(running.distanceKm, 1)} km across ${fmt(running.count)} run${running.count === 1 ? "" : "s"}`;
    }

    case "ACHIEVEMENTS": {
      const achievements = context?.achievements || [];
      if (!achievements.length) return "You haven't earned any achievements yet. Keep building your streaks and activity!";
      return `**Your recent achievements**\n\n${achievements.slice(0, 6).map((a) => `🏆 **${a.title || "Achievement"}**${a.description ? ` — ${a.description}` : ""}`).join("\n")}`;
    }

    case "XP":
      return `**Your FitLip XP**\n\n✨ Total XP: ${fmt(context?.gamification?.totalXp)}\n\nKeep logging meals, workouts and activity to keep progressing.`;

    case "GOAL":
      return `**Your current goals**\n\n🎯 Fitness goal: ${user.goal || "Not set"}\n🥗 Nutrition goal: ${user.nutritionGoal || "Not set"}\n🍽️ Diet type: ${user.dietType || "Not set"}`;

    default:
      return null;
  }
}

function buildIntentCards(intent, context, originalCardBuilder) {
  // Keep the existing rich cards only for the matching deterministic intent.
  // This prevents unrelated cards from appearing under an open-ended question.
  if (!originalCardBuilder) return [];
  const cardIntents = new Set([
    "TODAY_TRACK", "CALORIES", "CALORIE_TARGET", "PROTEIN", "PROTEIN_TARGET",
    "WATER", "STEPS", "ACTIVITY", "TODAY_WORKOUT", "WORKOUT_STATUS", "RUNNING",
    "WEIGHT_PROGRESS",
  ]);
  return cardIntents.has(intent) ? originalCardBuilder(intent, context) : [];
}

module.exports = {
  detectIntent,
  buildDeterministicReply,
  buildIntentCards,
  classifyScope,
  buildScopeGuardReply,
  text,
};
