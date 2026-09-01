const logger = require("../config/logger");
const WorkoutPlan = require("../models/WorkoutPlan");
const CustomWorkoutPlan = require("../models/CustomWorkoutPlan");
const Exercise = require("../models/Exercise");
const WorkoutLog = require("../models/WorkoutLog");
const HealthProfile = require("../modules/health/health.model");
const User = require("../models/User");
const { addEstimatedCaloriesForToday } = require("./trackingController");
const { checkAndAwardStreakAchievements } = require("../modules/social/achievement.service");
const { awardXp } = require("../modules/social/gamification.service");
const { getDayRange } = require("../utils/date");

// MET estimates by workout style. These remain fallback estimates only —
// device-synced active calories still take priority in DailyLog.
const MET_TABLE = {
  equipment: { bulk: 6, lean: 7, fit: 5.5 },
  bodyweight: { bulk: 5, lean: 6.5, fit: 4.5 },
};
const DEFAULT_MET = 5;
const MINUTES_PER_EXERCISE = 4;


async function getPlanContext(planId, planType = "standard", dayOfWeek) {
  if (planType === "custom") {
    const custom = await CustomWorkoutPlan.findById(planId).lean();
    if (!custom) return null;
    const day = custom.days.find((item) => Number(item.dayOfWeek) === Number(dayOfWeek || 1));
    if (!day) return null;

    const ids = day.exercises.map((entry) => entry.exerciseId);
    const library = ids.length ? await Exercise.find({ _id: { $in: ids }, active: true }).lean() : [];
    const byId = new Map(library.map((item) => [String(item._id), item]));
    const exercises = day.exercises.map((entry) => {
      const item = byId.get(String(entry.exerciseId));
      return {
        exerciseId: entry.exerciseId,
        name: item?.name || "Exercise",
        sets: entry.sets,
        reps: entry.reps,
        restSeconds: entry.restSeconds,
        imageKey: item?.imageKey || "",
        primaryMuscle: item?.primaryMuscle || "other",
        secondaryMuscles: item?.secondaryMuscles || [],
        durationMinutes: Number(item?.durationMinutes || 4),
        met: item?.met == null ? null : Number(item.met),
      };
    });

    return {
      planModel: "CustomWorkoutPlan",
      plan: custom,
      day,
      workout: {
        _id: custom._id,
        title: day.title,
        day: day.dayOfWeek,
        goal: custom.goal,
        mode: custom.mode,
        exercises,
      },
    };
  }

  const standard = await WorkoutPlan.findById(planId).lean();
  if (!standard) return null;
  const ids = (standard.exercises || []).map((item) => item.exerciseId).filter(Boolean);
  const library = ids.length ? await Exercise.find({ _id: { $in: ids }, active: true }).lean() : [];
  const byId = new Map(library.map((item) => [String(item._id), item]));
  const exercises = (standard.exercises || []).map((item) => {
    const lib = byId.get(String(item.exerciseId));
    return {
      exerciseId: item.exerciseId,
      name: lib?.name || "Exercise",
      sets: item.sets,
      reps: item.reps,
      imageKey: lib?.imageKey || "",
      primaryMuscle: lib?.primaryMuscle || "other",
      secondaryMuscles: lib?.secondaryMuscles || [],
      durationMinutes: Number(lib?.durationMinutes || MINUTES_PER_EXERCISE),
      met: lib?.met == null ? null : Number(lib.met),
    };
  });
  return { planModel: "WorkoutPlan", plan: standard, workout: { ...standard, exercises } };
}

function getLogPlanModel(planType) {
  return planType === "custom" ? "CustomWorkoutPlan" : "WorkoutPlan";
}

function exerciseKey(item) {
  return item?.exerciseId ? String(item.exerciseId) : String(item?.name || "");
}

function getExerciseCalories(plan, exercise, weightKg) {
  if (!weightKg) return 0;
  const met = Number(exercise?.met) || getWorkoutMet(plan);
  const duration = Math.max(0.25, Number(exercise?.durationMinutes) || MINUTES_PER_EXERCISE);
  const kcalPerMinute = (met * 3.5 * Number(weightKg)) / 200;
  return Math.max(1, Math.round(kcalPerMinute * duration));
}

function getWorkoutMet(plan) {
  return MET_TABLE[plan.mode]?.[plan.goal] ?? DEFAULT_MET;
}

function estimateExerciseCalories(plan, weightKg) {
  if (!weightKg) return 0;

  const met = getWorkoutMet(plan);
  const kcalPerMinute = (met * 3.5 * Number(weightKg)) / 200;
  const kcal = kcalPerMinute * MINUTES_PER_EXERCISE;

  return Math.max(1, Math.round(kcal));
}

function estimateWorkoutCalories(plan, weightKg, exerciseCount = plan.exercises?.length || 0) {
  if (!weightKg || exerciseCount <= 0) return 0;
  return estimateExerciseCalories(plan, weightKg) * exerciseCount;
}

async function getUserTodayRange(userId) {
  const user = await User.findById(userId).select("timezone").lean();
  const timezone = user?.timezone || "UTC";
  return getDayRange(new Date(), timezone);
}

function getCurrentAttempt(log) {
  if (!log?.attempts?.length) return null;
  return log.attempts[log.attempts.length - 1];
}

async function findWorkoutLog(userId, start, end, workoutPlanId, planModel, dayOfWeek = null) {
  const planFilter = {
    user: userId,
    date: { $gte: start, $lte: end },
    workoutPlan: workoutPlanId,
    $or: planModel === "WorkoutPlan"
      ? [{ planModel: "WorkoutPlan" }, { planModel: { $exists: false } }]
      : [{ planModel }],
  };

  if (planModel === "CustomWorkoutPlan") {
    planFilter.dayOfWeek = Number(dayOfWeek || 1);
  }

  return WorkoutLog.findOne(planFilter);
}

function serializeProgress(log, plan) {
  const attempt = getCurrentAttempt(log);
  const totalExercises = plan?.exercises?.length || 0;
  const legacyCompleted = Boolean(log?.completed) && !log?.attempts?.length;
  const completedExerciseNames = legacyCompleted
    ? (plan?.exercises || []).map((exercise) => exercise.name)
    : (attempt?.completedExercises?.map((item) => item.name) || []);
  const completedExerciseIds = legacyCompleted
    ? (plan?.exercises || []).map((exercise) => exercise.exerciseId).filter(Boolean).map(String)
    : (attempt?.completedExercises?.map((item) => item.exerciseId).filter(Boolean).map(String) || []);

  return {
    hasLog: Boolean(log),
    completedToday: Boolean(log?.completed),
    attemptNumber: attempt?.attemptNumber || 1,
    attemptCompleted: legacyCompleted || Boolean(attempt?.completed),
    completedExerciseNames,
    completedExerciseIds,
    completedCount: Math.max(completedExerciseNames.length, completedExerciseIds.length),
    totalExercises,
    workoutCalories: legacyCompleted ? Number(log?.caloriesBurned || 0) : Number(attempt?.caloriesBurned || 0),
    dayCalories: Number(log?.caloriesBurned || 0),
    recordedDate: log?.date || null,
  };
}

exports.getWorkouts = async (req, res) => {
  try {
    const { goal, mode } = req.query;

    if (!goal || !mode) {
      return res.status(400).json({ message: "goal and mode are required" });
    }

    const validGoals = ["bulk", "lean", "fit"];
    const validModes = ["equipment", "bodyweight"];

    if (!validGoals.includes(goal) || !validModes.includes(mode)) {
      return res.status(400).json({ message: "Invalid goal or mode value" });
    }

    const [workouts, profile, dayRange] = await Promise.all([
      WorkoutPlan.find({ goal, mode }).sort({ day: 1 }).lean(),
      HealthProfile.findOne({ user: req.user.id }).select("weight").lean(),
      getUserTodayRange(req.user.id),
    ]);

    const workoutIds = workouts.map((workout) => workout._id);
    const todayLogs = workoutIds.length
      ? await WorkoutLog.find({
          user: req.user.id,
          date: { $gte: dayRange.start, $lte: dayRange.end },
          workoutPlan: { $in: workoutIds },
          $or: [{ planModel: "WorkoutPlan" }, { planModel: { $exists: false } }],
        }).lean()
      : [];
    const todayLogByPlan = new Map(todayLogs.map((log) => [String(log.workoutPlan), log]));

    const weightKg = Number(profile?.weight) || 0;

    // Calorie estimates are user-specific, so they are calculated when the
    // workout is fetched instead of being stored in WorkoutPlan.
    const libraryIds = workouts.flatMap((item) => (item.exercises || []).map((exercise) => exercise.exerciseId).filter(Boolean));
    const library = libraryIds.length ? await Exercise.find({ _id: { $in: libraryIds }, active: true }).lean() : [];
    const byId = new Map(library.map((item) => [String(item._id), item]));

    const enrichedWorkouts = workouts.map((workout) => {
      const exercises = (workout.exercises || []).map((exercise) => {
        const lib = byId.get(String(exercise.exerciseId));
        return {
          exerciseId: exercise.exerciseId,
          name: lib?.name || "Exercise",
          sets: exercise.sets,
          reps: exercise.reps,
          imageKey: lib?.imageKey || "",
          primaryMuscle: lib?.primaryMuscle || "other",
          secondaryMuscles: lib?.secondaryMuscles || [],
          durationMinutes: Number(lib?.durationMinutes || MINUTES_PER_EXERCISE),
          met: lib?.met == null ? null : Number(lib.met),
        };
      });
      const enrichedExercises = exercises.map((exercise) => ({
        ...exercise,
        caloriesPerExercise: getExerciseCalories(workout, exercise, weightKg),
      }));
      const caloriesPerExercise = enrichedExercises.length ? Number(enrichedExercises[0].caloriesPerExercise || 0) : 0;
      const estimatedWorkoutCalories = enrichedExercises.reduce((sum, exercise) => sum + Number(exercise.caloriesPerExercise || 0), 0);
      const workoutTodayLog = todayLogByPlan.get(String(workout._id));
      const sameWorkoutToday = Boolean(workoutTodayLog);
      const currentAttempt = sameWorkoutToday ? getCurrentAttempt(workoutTodayLog) : null;
      const legacyCompleted = sameWorkoutToday && workoutTodayLog.completed && !workoutTodayLog.attempts?.length;
      const todayCompletedCount = legacyCompleted
        ? workout.exercises?.length || 0
        : currentAttempt?.completedExercises?.length || 0;

      return {
        ...workout,
        exercises: enrichedExercises,
        caloriesPerExercise,
        estimatedWorkoutCalories,
        todayCompleted: sameWorkoutToday ? Boolean(workoutTodayLog.completed) : false,
        todayCompletedCount,
        todayCaloriesBurned: legacyCompleted
          ? Number(workoutTodayLog.caloriesBurned || 0)
          : currentAttempt?.caloriesBurned || 0,
      };
    });

    res.status(200).json(enrichedWorkouts);
  } catch (err) {
    logger.error({ err }, "Get workouts error");
    res.status(500).json({ message: "Failed to fetch workouts" });
  }
};

exports.getWorkoutProgress = async (req, res) => {
  try {
    const { workoutPlanId, planType = "standard", dayOfWeek } = req.query;
    if (!workoutPlanId) return res.status(400).json({ message: "workoutPlanId is required" });

    const context = await getPlanContext(workoutPlanId, planType, dayOfWeek);
    if (!context) return res.status(404).json({ message: "Workout plan not found" });

    const { start, end } = await getUserTodayRange(req.user.id);
    const log = await findWorkoutLog(
      req.user.id,
      start,
      end,
      workoutPlanId,
      context.planModel,
      dayOfWeek
    ).then((doc) => doc?.toObject?.() || null);
    if (log && (String(log.workoutPlan) !== String(workoutPlanId) || log.planModel !== context.planModel)) {
      return res.status(409).json({ message: "A different workout is already tracked for today." });
    }

    const progress = serializeProgress(log, context.workout);
    const exerciseCalories = context.workout.exercises.map((exercise) => ({ key: exerciseKey(exercise), calories: 0 }));
    return res.status(200).json({ ...progress, caloriesPerExercise: exerciseCalories });
  } catch (err) {
    logger.error({ err }, "Get workout progress error");
    return res.status(500).json({ message: "Failed to fetch workout progress" });
  }
};

exports.confirmExercises = async (req, res) => {
  try {
    const { workoutPlanId, exerciseNames, exerciseIds, planType = "standard", dayOfWeek } = req.body;
    if (!workoutPlanId) return res.status(400).json({ message: "workoutPlanId is required" });

    const context = await getPlanContext(workoutPlanId, planType, dayOfWeek);
    if (!context) return res.status(404).json({ message: "Workout plan not found" });

    const requestedNames = Array.isArray(exerciseNames) ? exerciseNames.map((v) => String(v).trim()).filter(Boolean) : [];
    const requestedIds = Array.isArray(exerciseIds) ? exerciseIds.map((v) => String(v)).filter(Boolean) : [];
    const selected = [];
    for (const exercise of context.workout.exercises || []) {
      const key = exerciseKey(exercise);
      if ((exercise.exerciseId && requestedIds.includes(key)) || (!exercise.exerciseId && requestedNames.includes(exercise.name))) selected.push(exercise);
    }
    if (!selected.length) return res.status(400).json({ message: "Select at least one valid exercise" });

    const profile = await HealthProfile.findOne({ user: req.user.id }).select("weight").lean();
    const weightKg = Number(profile?.weight) || 0;
    const { start, end } = await getUserTodayRange(req.user.id);
    let log = await findWorkoutLog(
      req.user.id,
      start,
      end,
      workoutPlanId,
      context.planModel,
      dayOfWeek
    );

    if (!log) {
      log = await WorkoutLog.create({
        user: req.user.id,
        date: start,
        workoutPlan: workoutPlanId,
        planModel: context.planModel,
        dayOfWeek: context.planModel === "CustomWorkoutPlan" ? Number(dayOfWeek || 1) : null,
        completed: false,
        caloriesBurned: 0,
        attempts: [{
          attemptNumber: 1,
          completedExercises: [],
          caloriesBurned: 0,
          completed: false,
          startedAt: new Date(),
        }],
      });
    } else if (String(log.workoutPlan) !== String(workoutPlanId) || log.planModel !== context.planModel) {
      return res.status(409).json({ message: "A different workout is already tracked for today." });
    }

    let attempt = getCurrentAttempt(log);
    if (!attempt) {
      log.attempts.push({ attemptNumber: 1, completedExercises: [], caloriesBurned: 0, completed: false, startedAt: new Date() });
      attempt = getCurrentAttempt(log);
    }

    const completedKeys = new Set((attempt.completedExercises || []).map((item) => item.exerciseId ? String(item.exerciseId) : String(item.name)));
    const newExercises = selected.filter((exercise) => !completedKeys.has(exerciseKey(exercise)));
    if (!newExercises.length) return res.status(200).json({ message: "Selected exercises were already recorded", caloriesAdded: 0, progress: serializeProgress(log, context.workout) });

    const completedAt = new Date();
    for (const exercise of newExercises) {
      const calories = getExerciseCalories(context.plan, exercise, weightKg);
      attempt.completedExercises.push({ exerciseId: exercise.exerciseId || null, name: exercise.name, calories, completedAt });
    }

    attempt.caloriesBurned = attempt.completedExercises.reduce((sum, item) => sum + Number(item.calories || 0), 0);
    const totalExercises = context.workout.exercises?.length || 0;
    const completedCount = attempt.completedExercises.length;
    if (totalExercises > 0 && completedCount >= totalExercises) {
      attempt.completed = true;
      attempt.completedAt = completedAt;
      log.completed = true;
    }
    log.caloriesBurned = (log.attempts || []).reduce((sum, item) => sum + Number(item.caloriesBurned || 0), 0);
    await log.save();

    const selectedCalories = newExercises.reduce((sum, exercise) => sum + getExerciseCalories(context.plan, exercise, weightKg), 0);
    let caloriesAdded = 0;
    if (selectedCalories > 0) {
      const calorieLog = await addEstimatedCaloriesForToday(
        req.user.id,
        selectedCalories,
        null,
        "exercise"
      );
      if (calorieLog?.source === "estimated") caloriesAdded = selectedCalories;
    }
    for (const exercise of newExercises) {
      awardXp(
        req.user.id,
        "exerciseConfirmed",
        `exercise:${log._id}:attempt:${attempt.attemptNumber}:${exerciseKey(exercise)}`,
        { workoutPlanId, planType, exercise: exercise.name }
      ).catch(() => {});
    }

    if (attempt.completed) {
      awardXp(
        req.user.id,
        "workoutCompleted",
        `workout:${log._id}:attempt:${attempt.attemptNumber}:completed`,
        { workoutPlanId, planType }
      ).catch(() => {});
      checkAndAwardStreakAchievements(req.user.id).catch(() => {});
    }

    return res.status(200).json({
      message: attempt.completed ? "Exercises recorded — workout complete" : "Exercises recorded",
      completedCount: newExercises.length,
      caloriesAdded,
      progress: serializeProgress(log, context.workout),
    });
  } catch (err) {
    logger.error({ err }, "Confirm exercises error");
    return res.status(400).json({ message: err.message || "Failed to record exercises" });
  }
};

exports.markExerciseComplete = async (req, res) => {
  // Legacy compatibility endpoint. New clients should use /workouts/exercises-confirm.
  try {
    const { workoutPlanId, exerciseName, planType = "standard", dayOfWeek } = req.body;
    if (!workoutPlanId || !exerciseName) {
      return res.status(400).json({ message: "workoutPlanId and exerciseName are required" });
    }
    const context = await getPlanContext(workoutPlanId, planType, dayOfWeek);
    if (!context) return res.status(404).json({ message: "Workout plan not found" });
    const exercise = context.workout.exercises.find((item) => item.name === exerciseName);
    if (!exercise) return res.status(400).json({ message: "Exercise is not part of this workout" });
    return exports.confirmExercises({
      ...req,
      body: {
        ...req.body,
        workoutPlanId,
        planType,
        dayOfWeek,
        exerciseIds: exercise.exerciseId ? [String(exercise.exerciseId)] : [],
        exerciseNames: exercise.exerciseId ? [] : [exercise.name],
      },
    }, res);
  } catch (err) {
    logger.error({ err }, "Legacy mark exercise complete error");
    return res.status(500).json({ message: "Failed to record exercise completion" });
  }
};

exports.retryWorkout = async (req, res) => {
  try {
    const {
      workoutPlanId,
      planType = "standard",
      dayOfWeek,
    } = req.body;

    if (!workoutPlanId) {
      return res.status(400).json({
        message: "workoutPlanId is required",
      });
    }

    // Load the requested workout and resolve its exercises.
    const context = await getPlanContext(
      workoutPlanId,
      planType,
      dayOfWeek
    );

    if (!context) {
      return res.status(404).json({
        message: "Workout plan not found",
      });
    }

    const { start, end } = await getUserTodayRange(req.user.id);

    // Find today's log for this exact workout.
    const log = await findWorkoutLog(
      req.user.id,
      start,
      end,
      workoutPlanId,
      context.planModel,
      dayOfWeek
    );

    if (!log) {
      return res.status(400).json({
        message: "No workout has been recorded today yet",
      });
    }

    const currentAttempt = getCurrentAttempt(log);

    if (!currentAttempt) {
      return res.status(400).json({
        message: "No workout attempt exists for today",
      });
    }

    // Retry should only be available after the current attempt
    // has been completely finished.
    const totalExercises = context.workout.exercises?.length || 0;
    const completedCount =
      currentAttempt.completedExercises?.length || 0;

    if (!currentAttempt.completed || completedCount < totalExercises) {
      return res.status(400).json({
        message:
          "Complete the current workout before starting a retry",
      });
    }

    // Create a fresh attempt while preserving the previous attempt.
    const nextAttemptNumber =
      (currentAttempt.attemptNumber || 0) + 1;

    log.attempts.push({
      attemptNumber: nextAttemptNumber,
      completedExercises: [],
      caloriesBurned: 0,
      completed: false,
      startedAt: new Date(),
      completedAt: null,
    });

    // The overall workout is no longer considered complete because
    // the user has started a new attempt.
    log.completed = false;

    await log.save();

    const newAttempt = getCurrentAttempt(log);

    return res.status(200).json({
      message: "New workout attempt started",
      attemptNumber: newAttempt.attemptNumber,
      completedCount: 0,
      totalExercises,
      caloriesBurned: 0,
      progress: serializeProgress(log, context.workout),
    });
  } catch (err) {
    logger.error({ err }, "Retry workout error");

    return res.status(500).json({
      message: err.message || "Failed to retry workout",
    });
  }
};

exports.markWorkoutComplete = async (req, res) => {
  // Legacy compatibility endpoint. It now confirms all exercise IDs for the standard plan.
  try {
    const { workoutPlanId } = req.body;
    if (!workoutPlanId) return res.status(400).json({ message: "workoutPlanId is required" });
    const context = await getPlanContext(workoutPlanId, "standard");
    if (!context) return res.status(404).json({ message: "Workout plan not found" });
    return exports.confirmExercises({
      ...req,
      body: {
        ...req.body,
        workoutPlanId,
        planType: "standard",
        exerciseIds: context.workout.exercises.map((exercise) => String(exercise.exerciseId)),
        exerciseNames: [],
      },
    }, res);
  } catch (err) {
    logger.error({ err }, "Legacy mark workout complete error");
    return res.status(500).json({ message: "Failed to mark workout complete" });
  }
};

exports.getRecentCompletions = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 30);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await WorkoutLog.find({
      user: req.user.id,
      date: { $gte: since },
    }).sort({ date: -1 });

    res.status(200).json(logs);
  } catch (err) {
    logger.error({ err }, "Get recent completions error");
    res.status(500).json({ message: "Failed to fetch completion history" });
  }
};
