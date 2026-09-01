"use strict";

/*
 * FitLip AI Context Engine
 *
 * Builds a compact, user-scoped snapshot of the data the AI is allowed to use.
 * The chat controller calls this on every turn so answers reflect the latest
 * profile, meals, water, activity, workouts, runs and progress.
 */

const User = require("../models/User");
const HealthProfile = require("../modules/health/health.model");
const DietPlan = require("../modules/nutrition/dietPlan.model");
const DietProgress = require("../modules/nutrition/dietProgress.model");
const MealLog = require("../modules/nutrition/mealLog.model");
const WaterLog = require("../modules/nutrition/waterLog.model");
const WeeklyInsight = require("../modules/nutrition/weeklyInsight.model");
const DailyLog = require("../models/DailyLog");
const WorkoutPlan = require("../models/WorkoutPlan");
const CustomWorkoutPlan = require("../models/CustomWorkoutPlan");
const WorkoutLog = require("../models/WorkoutLog");
const RunLog = require("../modules/running/run.model");
const Achievement = require("../modules/social/achievement.model");
const XpEvent = require("../modules/social/xpEvent.model");

const {
  getDateKey,
  getDateKeyRange,
  getTimezone,
  addCalendarDays,
  localMidnightFromDateKey,
} = require("../utils/date");

const MAX_RECENT_MEALS = 40;
const MAX_RECENT_RUNS = 20;
const MAX_RECENT_WORKOUTS = 20;
const MAX_PROGRESS_DAYS = 31;
const MAX_ACHIEVEMENTS = 30;
const MAX_XP_EVENTS = 30;

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(num(value) * factor) / factor;
}

function dateKeyRangeForKey(dateKey, timezone) {
  return getDateKeyRange(dateKey, timezone);
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function compactFood(food) {
  if (!food) return null;
  return {
    name: food.name || "Unknown food",
    brand: food.brand || undefined,
    quantity: num(food.quantity, undefined),
    amount: num(food.amount, undefined),
    unit: food.unit || undefined,
    calories: round(food.calories),
    protein: round(food.protein),
    carbs: round(food.carbs),
    fats: round(food.fats),
    fiber: round(food.fiber),
  };
}

function compactMealLog(log) {
  return {
    date: safeDate(log.loggedAt),
    mealType: log.mealType,
    food: compactFood(log.food),
    notes: log.notes || undefined,
  };
}

function compactDietMeal(meal) {
  if (!meal) return null;
  return {
    name: meal.name || meal.mealName || "Meal",
    calories: round(meal.calories),
    protein: round(meal.protein ?? meal.proteinG),
    carbs: round(meal.carbs ?? meal.carbsG),
    fats: round(meal.fats ?? meal.fatsG),
    fiber: round(meal.fiber ?? meal.fiberG),
    items: Array.isArray(meal.items)
      ? meal.items.map((item) => ({
          name: item.name,
          amount: num(item.amount, undefined),
          unit: item.unit,
        }))
      : [],
  };
}

function compactWorkoutPlan(plan) {
  if (!plan) return null;
  return {
    title: plan.title || plan.name || "Workout",
    goal: plan.goal,
    mode: plan.mode,
    day: plan.day,
    isRestDay: false,
    exercises: (plan.exercises || []).map((exercise) => ({
      name: exercise.exerciseId?.name || exercise.name || "Exercise",
      sets: exercise.sets,
      reps: exercise.reps,
      restSeconds: exercise.restSeconds,
    })),
  };
}

function compactCustomWorkoutDay(day) {
  if (!day) return null;
  return {
    title: day.title || "Workout",
    dayOfWeek: day.dayOfWeek,
    focusMuscles: day.focusMuscles || [],
    isRestDay: !!day.isRestDay,
    exercises: (day.exercises || []).map((exercise) => ({
      name: exercise.exerciseId?.name || exercise.name || "Exercise",
      sets: exercise.sets,
      reps: exercise.reps,
      restSeconds: exercise.restSeconds,
    })),
  };
}

function compactWorkoutLog(log) {
  return {
    date: safeDate(log.date),
    completed: !!log.completed,
    caloriesBurned: round(log.caloriesBurned),
    attempts: (log.attempts || []).map((attempt) => ({
      attemptNumber: attempt.attemptNumber,
      completed: !!attempt.completed,
      caloriesBurned: round(attempt.caloriesBurned),
      startedAt: safeDate(attempt.startedAt),
      completedAt: safeDate(attempt.completedAt),
      exercises: (attempt.completedExercises || []).map((exercise) => ({
        name: exercise.name,
        calories: round(exercise.calories),
        completedAt: safeDate(exercise.completedAt),
      })),
    })),
  };
}

function compactRun(run) {
  return {
    activityType: run.activityType,
    distanceKm: round(num(run.distanceMeters) / 1000, 2),
    durationMinutes: round(num(run.durationSeconds) / 60, 1),
    averagePaceMinPerKm: run.avgPaceSecPerKm
      ? round(num(run.avgPaceSecPerKm) / 60, 2)
      : null,
    caloriesBurned: round(run.caloriesBurned),
    startedAt: safeDate(run.startedAt),
    endedAt: safeDate(run.endedAt),
    source: run.source,
  };
}

function compactDailyLog(log, dateKey, timezone) {
  return {
    date: dateKey || getDateKey(log.date, timezone),
    steps: num(log.steps),
    waterLiters: num(log.water),
    sleepHours: num(log.sleep),
    caloriesBurned: num(log.caloriesBurned),
    stepsCaloriesBurned: num(log.stepsCaloriesBurned),
    exerciseCaloriesBurned: num(log.exerciseCaloriesBurned),
    activityCaloriesBurned: num(log.activityCaloriesBurned),
    manualCaloriesBurned: num(log.manualCaloriesBurned),
    caloriesSource: log.caloriesSource,
    source: log.source,
    activities: (log.activityEntries || []).map((entry) => ({
      type: entry.activityType,
      label: entry.label,
      minutes: num(entry.minutes),
      calories: num(entry.calories),
      loggedAt: safeDate(entry.loggedAt),
    })),
  };
}

async function buildAiContext(userId, options = {}) {
  const now = new Date();
  const user = await User.findById(userId)
    .select("name age height weight goal timezone dietType username totalXp")
    .lean();

  if (!user) throw new Error("User not found while building AI context");

  const timezone = getTimezone(user.timezone);
  const todayKey = getDateKey(now, timezone);
  const yesterdayKey = addCalendarDays(todayKey, -1);
  const sevenDaysAgoKey = addCalendarDays(todayKey, -6);
  const thirtyOneDaysAgoKey = addCalendarDays(todayKey, -(MAX_PROGRESS_DAYS - 1));

  const todayRange = dateKeyRangeForKey(todayKey, timezone);
  const sevenDayRange = {
    start: localMidnightFromDateKey(sevenDaysAgoKey, timezone),
    end: todayRange.end,
  };
  const thirtyOneDayRange = {
    start: localMidnightFromDateKey(thirtyOneDaysAgoKey, timezone),
    end: todayRange.end,
  };

  const dayOfWeek = (() => {
    const d = new Date(`${todayKey}T12:00:00Z`);
    const jsDay = d.getUTCDay();
    return jsDay === 0 ? 7 : jsDay;
  })();

  const [
    profile,
    activeDietPlan,
    progress,
    todayMeals,
    recentMeals,
    todayWater,
    recentWater,
    dailyLogs,
    standardWorkout,
    customWorkout,
    recentWorkoutLogs,
    recentRuns,
    weeklyInsights,
    achievements,
    xpEvents,
  ] = await Promise.all([
    HealthProfile.findOne({ user: userId }).lean(),
    DietPlan.findOne({ user: userId, isActive: true }).sort({ version: -1, updatedAt: -1 }).lean(),
    DietProgress.find({ user: userId, date: { $gte: thirtyOneDaysAgoKey, $lte: todayKey } })
      .sort({ date: -1 })
      .limit(MAX_PROGRESS_DAYS)
      .lean(),
    MealLog.find({ user: userId, loggedAt: { $gte: todayRange.start, $lte: todayRange.end } })
      .sort({ loggedAt: 1 })
      .limit(MAX_RECENT_MEALS)
      .lean(),
    MealLog.find({ user: userId, loggedAt: { $gte: sevenDayRange.start, $lte: sevenDayRange.end } })
      .sort({ loggedAt: -1 })
      .limit(MAX_RECENT_MEALS)
      .lean(),
    WaterLog.findOne({ user: userId, date: todayKey }).lean(),
    WaterLog.find({ user: userId, date: { $gte: sevenDaysAgoKey, $lte: todayKey } })
      .sort({ date: -1 })
      .lean(),
    DailyLog.find({ user: userId, date: { $gte: thirtyOneDayRange.start, $lte: thirtyOneDayRange.end } })
      .sort({ date: -1 })
      .limit(MAX_PROGRESS_DAYS)
      .lean(),
    WorkoutPlan.findOne({ goal: user.goal, day: dayOfWeek })
      .populate("exercises.exerciseId", "name muscleGroup equipment caloriesPerMinute")
      .lean(),
    CustomWorkoutPlan.findOne({ user: userId, isActive: true })
      .populate("days.exercises.exerciseId", "name muscleGroup equipment caloriesPerMinute")
      .lean(),
    WorkoutLog.find({ user: userId, date: { $gte: sevenDayRange.start, $lte: sevenDayRange.end } })
      .sort({ date: -1 })
      .limit(MAX_RECENT_WORKOUTS)
      .lean(),
    RunLog.find({ user: userId, startedAt: { $gte: sevenDayRange.start, $lte: sevenDayRange.end } })
      .sort({ startedAt: -1 })
      .limit(MAX_RECENT_RUNS)
      .lean(),
    WeeklyInsight.find({ user: userId }).sort({ weekEnding: -1 }).limit(8).lean(),
    Achievement.find({ user: userId }).sort({ earnedAt: -1 }).limit(MAX_ACHIEVEMENTS).lean(),
    XpEvent.find({ user: userId }).sort({ earnedAt: -1 }).limit(MAX_XP_EVENTS).lean(),
  ]);

  const progressByDate = new Map(progress.map((item) => [item.date, item]));
  const dailyByDate = new Map(
    dailyLogs.map((item) => [getDateKey(item.date, timezone), item])
  );

  const todayProgress = progressByDate.get(todayKey) || null;
  const todayDaily = dailyByDate.get(todayKey) || null;

  const recentWeights = progress
    .filter((item) => item.weight != null && Number.isFinite(Number(item.weight)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => ({ date: item.date, weightKg: num(item.weight) }));

  const todayMealCalories = todayMeals.reduce(
    (sum, meal) => sum + num(meal.food?.calories),
    0
  );
  const todayMealProtein = todayMeals.reduce(
    (sum, meal) => sum + num(meal.food?.protein),
    0
  );
  const todayMealCarbs = todayMeals.reduce(
    (sum, meal) => sum + num(meal.food?.carbs),
    0
  );
  const todayMealFats = todayMeals.reduce(
    (sum, meal) => sum + num(meal.food?.fats),
    0
  );
  const todayMealFiber = todayMeals.reduce(
    (sum, meal) => sum + num(meal.food?.fiber),
    0
  );

  const sevenDayMealCalories = recentMeals.reduce(
    (sum, meal) => sum + num(meal.food?.calories),
    0
  );

  const sevenDayRunDistance = recentRuns.reduce(
    (sum, run) => sum + num(run.distanceMeters) / 1000,
    0
  );
  const sevenDayRunCalories = recentRuns.reduce(
    (sum, run) => sum + num(run.caloriesBurned),
    0
  );

  const completedWorkouts = recentWorkoutLogs.filter((log) => log.completed).length;
  const workoutCalories = recentWorkoutLogs.reduce(
    (sum, log) => sum + num(log.caloriesBurned),
    0
  );

  const standardTodayPlan = standardWorkout ? compactWorkoutPlan(standardWorkout) : null;
  const customTodayPlan = customWorkout?.days?.find((day) => day.dayOfWeek === dayOfWeek);
  const todayWorkoutPlan = customTodayPlan
    ? compactCustomWorkoutDay(customTodayPlan)
    : standardTodayPlan;

  const activePlanSummary = activeDietPlan
    ? {
        targetCalories: num(activeDietPlan.targetCalories),
        macroTargets: activeDietPlan.summary?.macroTargets || activeDietPlan.macroTargets || {},
        summary: activeDietPlan.summary || {},
        meals: {
          breakfast: (activeDietPlan.meals?.breakfast || []).map(compactDietMeal),
          lunch: (activeDietPlan.meals?.lunch || []).map(compactDietMeal),
          dinner: (activeDietPlan.meals?.dinner || []).map(compactDietMeal),
          snack: (activeDietPlan.meals?.snack || []).map(compactDietMeal),
        },
      }
    : null;

  const context = {
    generatedAt: now.toISOString(),
    timezone,
    today: todayKey,
    yesterday: yesterdayKey,

    user: {
      name: user.name,
      username: user.username || null,
      age: user.age ?? profile?.age ?? null,
      gender: profile?.gender ?? null,
      heightCm: user.height ?? profile?.height ?? null,
      currentWeightKg: user.weight ?? profile?.weight ?? null,
      goal: user.goal,
      nutritionGoal: profile?.goal ?? null,
      activityLevel: profile?.activityLevel ?? null,
      dietType: profile?.dietType ?? null,
      medicalConditions: profile?.diseases || [],
      allergies: profile?.allergies || [],
      timezone,
    },

    targets: {
      bmr: profile?.bmr ?? null,
      maintenanceCalories: profile?.maintenanceCalories ?? null,
      targetCalories: profile?.targetCalories ?? activePlanSummary?.targetCalories ?? null,
      activeCalorieGoal: profile?.activeCalorieGoal ?? null,
      proteinTargetG: profile?.proteinTarget ?? activePlanSummary?.macroTargets?.proteinG ?? null,
      carbTargetG: profile?.carbTarget ?? activePlanSummary?.macroTargets?.carbsG ?? null,
      fatTargetG: profile?.fatTarget ?? activePlanSummary?.macroTargets?.fatsG ?? null,
      dietPlan: activePlanSummary,
    },

    today: {
      nutrition: {
        caloriesConsumedFromMealLogs: round(todayMealCalories),
        proteinGFromMealLogs: round(todayMealProtein),
        carbsGFromMealLogs: round(todayMealCarbs),
        fatsGFromMealLogs: round(todayMealFats),
        fiberGFromMealLogs: round(todayMealFiber),
        mealsLogged: todayMeals.length,
        progressRecord: todayProgress
          ? {
              caloriesConsumed: num(todayProgress.caloriesConsumed),
              mealsCompleted: todayProgress.mealsCompleted || {},
              weightKg: todayProgress.weight ?? null,
              notes: todayProgress.notes || "",
            }
          : null,
        mealLogs: todayMeals.map(compactMealLog),
      },
      hydration: todayWater
        ? {
            totalMl: num(todayWater.totalMl),
            goalMl: num(todayWater.goalMl),
            percent: num(todayWater.goalMl)
              ? round((num(todayWater.totalMl) / num(todayWater.goalMl)) * 100)
              : null,
            events: (todayWater.logs || []).map((entry) => ({
              amountMl: num(entry.amount),
              label: entry.label,
              loggedAt: safeDate(entry.loggedAt),
            })),
          }
        : { totalMl: 0, goalMl: 2500, percent: 0, events: [] },
      activity: todayDaily ? compactDailyLog(todayDaily, todayKey, timezone) : null,
      workout: {
        dayOfWeek,
        plan: todayWorkoutPlan,
        recentTodayLogs: recentWorkoutLogs
          .filter((log) => getDateKey(log.date, timezone) === todayKey)
          .map(compactWorkoutLog),
      },
    },

    recent7Days: {
      nutrition: {
        mealLogs: recentMeals.map(compactMealLog),
        totalCaloriesFromMealLogs: round(sevenDayMealCalories),
        averageCaloriesPerLoggedMealDay: recentMeals.length
          ? round(sevenDayMealCalories / Math.max(new Set(recentMeals.map((m) => getDateKey(m.loggedAt, timezone))).size, 1))
          : 0,
      },
      hydration: recentWater.map((day) => ({
        date: day.date,
        totalMl: num(day.totalMl),
        goalMl: num(day.goalMl),
        percent: num(day.goalMl) ? round((num(day.totalMl) / num(day.goalMl)) * 100) : null,
      })),
      activity: dailyLogs
        .filter((log) => getDateKey(log.date, timezone) >= sevenDaysAgoKey)
        .map((log) => compactDailyLog(log, getDateKey(log.date, timezone), timezone)),
      workouts: {
        logs: recentWorkoutLogs.map(compactWorkoutLog),
        completedCount: completedWorkouts,
        caloriesBurned: round(workoutCalories),
      },
      running: {
        runs: recentRuns.map(compactRun),
        count: recentRuns.length,
        distanceKm: round(sevenDayRunDistance, 2),
        caloriesBurned: round(sevenDayRunCalories),
      },
    },

    progress: {
      dailyDietProgress: progress.map((item) => ({
        date: item.date,
        caloriesConsumed: num(item.caloriesConsumed),
        weightKg: item.weight ?? null,
        mealsCompleted: item.mealsCompleted || {},
        notes: item.notes || "",
      })),
      weightHistory: recentWeights,
      weeklyInsights: weeklyInsights.map((item) => ({
        weekEnding: safeDate(item.weekEnding),
        adjusted: !!item.adjusted,
        oldCalories: item.oldCalories ?? null,
        newCalories: item.newCalories ?? null,
        delta: item.delta ?? null,
        adherencePercent: item.adherence ?? null,
        averageCalories: item.avgCalories ?? null,
        weightChangeKg: item.weightChange ?? null,
        reason: item.reason,
      })),
    },

    achievements: achievements.map((item) => ({
      title: item.title,
      description: item.description,
      category: item.category,
      metric: item.metric,
      value: item.value ?? null,
      earnedAt: safeDate(item.earnedAt),
    })),

    gamification: {
      totalXp: num(user.totalXp),
      recentXpEvents: xpEvents.map((event) => ({
        type: event.type,
        xp: num(event.xp),
        earnedAt: safeDate(event.earnedAt),
      })),
    },
  };

  return context;
}

function contextToPrompt(context) {
  return JSON.stringify(context, null, 2);
}

module.exports = {
  buildAiContext,
  contextToPrompt,
};
