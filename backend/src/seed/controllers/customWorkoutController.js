const CustomWorkoutPlan = require("../models/CustomWorkoutPlan");
const Exercise = require("../models/Exercise");
const HealthProfile = require("../modules/health/health.model");
const logger = require("../config/logger");

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ALLOWED_TEMPLATES = new Set(["ppl", "upper_lower", "full_body", "bro_split", "custom"]);
const ALLOWED_GOALS = new Set(["bulk", "lean", "fit"]);
const ALLOWED_MODES = new Set(["equipment", "bodyweight", "mixed"]);

function normalizeDays(days) {
  return Array.from({ length: 7 }, (_, index) => {
    const dayNumber = index + 1;
    const source = Array.isArray(days) ? days.find((item) => Number(item?.dayOfWeek) === dayNumber) : null;
    return {
      dayOfWeek: dayNumber,
      title: String(source?.title || (dayNumber <= 5 ? DAY_NAMES[index] : DAY_NAMES[index])).trim().slice(0, 80) || DAY_NAMES[index],
      focusMuscles: Array.isArray(source?.focusMuscles) ? source.focusMuscles.map(String).slice(0, 6) : [],
      isRestDay: Boolean(source?.isRestDay),
      exercises: Array.isArray(source?.exercises) ? source.exercises : [],
    };
  });
}

async function validateAndHydrateDays(days) {
  const normalized = normalizeDays(days);
  const exerciseIds = [];
  const seenByDay = new Set();

  for (const day of normalized) {
    if (day.exercises.length > 12) throw new Error(`${DAY_NAMES[day.dayOfWeek - 1]} can contain at most 12 exercises`);
    if (day.isRestDay && day.exercises.length > 0) throw new Error(`${DAY_NAMES[day.dayOfWeek - 1]} cannot be a rest day with exercises`);

    for (const entry of day.exercises) {
      const id = String(entry?.exerciseId || "");
      if (!id) throw new Error("Every custom exercise must reference an exercise from the library");
      if (seenByDay.has(`${day.dayOfWeek}:${id}`)) throw new Error(`Duplicate exercise found on ${DAY_NAMES[day.dayOfWeek - 1]}`);
      seenByDay.add(`${day.dayOfWeek}:${id}`);
      exerciseIds.push(id);
    }
  }

  const uniqueIds = [...new Set(exerciseIds)];
  const docs = uniqueIds.length ? await Exercise.find({ _id: { $in: uniqueIds }, active: true }).lean() : [];
  if (docs.length !== uniqueIds.length) throw new Error("One or more selected exercises are unavailable");
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));

  const hydrated = normalized.map((day) => ({
    ...day,
    exercises: day.exercises.map((entry) => {
      const exercise = byId.get(String(entry.exerciseId));
      const sets = Math.min(Math.max(Number(entry.sets) || exercise.defaultSets || 3, 1), 10);
      const reps = String(entry.reps ?? exercise.defaultReps ?? "10").trim().slice(0, 40) || String(exercise.defaultReps || "10");
      const restSeconds = Math.min(Math.max(Number(entry.restSeconds) || exercise.defaultRestSeconds || 60, 0), 600);
      return { exerciseId: exercise._id, sets, reps, restSeconds };
    }),
  }));

  return hydrated;
}

function serializePlan(plan) {
  return plan.toObject ? plan.toObject() : plan;
}

exports.getPlans = async (req, res) => {
  try {
    const plans = await CustomWorkoutPlan.find({ user: req.user.id })
      .sort({ isActive: -1, updatedAt: -1 })
      .lean();
    return res.json(plans);
  } catch (err) {
    logger.error({ err }, "Get custom workout plans error");
    return res.status(500).json({ message: "Failed to load custom workout plans" });
  }
};

exports.getActivePlan = async (req, res) => {
  try {
    const plan = await CustomWorkoutPlan.findOne({ user: req.user.id, isActive: true }).lean();
    return res.json(plan || null);
  } catch (err) {
    logger.error({ err }, "Get active custom workout plan error");
    return res.status(500).json({ message: "Failed to load active workout plan" });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (name.length < 2) return res.status(400).json({ message: "Plan name is required" });
    if (!ALLOWED_TEMPLATES.has(body.template || "custom")) return res.status(400).json({ message: "Invalid plan template" });
    if (!ALLOWED_GOALS.has(body.goal || "fit")) return res.status(400).json({ message: "Invalid goal" });
    if (!ALLOWED_MODES.has(body.mode || "mixed")) return res.status(400).json({ message: "Invalid equipment mode" });

    const existing = await CustomWorkoutPlan.findOne({ user: req.user.id, name });
    if (existing) return res.status(409).json({ message: "A plan with this name already exists" });

    const days = await validateAndHydrateDays(body.days || []);
    const makeActive = body.isActive !== false;

    if (makeActive) {
      await CustomWorkoutPlan.updateMany({ user: req.user.id }, { $set: { isActive: false } });
    }

    const plan = await CustomWorkoutPlan.create({
      user: req.user.id,
      name,
      template: body.template || "custom",
      goal: body.goal || "fit",
      mode: body.mode || "mixed",
      days,
      isActive: makeActive,
    });

    return res.status(201).json(serializePlan(plan));
  } catch (err) {
    logger.error({ err }, "Create custom workout plan error");
    return res.status(400).json({ message: err.message || "Failed to create custom workout plan" });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await CustomWorkoutPlan.findOne({ _id: req.params.id, user: req.user.id });
    if (!plan) return res.status(404).json({ message: "Custom workout plan not found" });

    const body = req.body || {};
    if (body.name !== undefined) plan.name = String(body.name).trim().slice(0, 80);
    if (body.template !== undefined && !ALLOWED_TEMPLATES.has(body.template)) return res.status(400).json({ message: "Invalid plan template" });
    if (body.goal !== undefined && !ALLOWED_GOALS.has(body.goal)) return res.status(400).json({ message: "Invalid goal" });
    if (body.mode !== undefined && !ALLOWED_MODES.has(body.mode)) return res.status(400).json({ message: "Invalid equipment mode" });
    if (body.template !== undefined) plan.template = body.template;
    if (body.goal !== undefined) plan.goal = body.goal;
    if (body.mode !== undefined) plan.mode = body.mode;
    if (body.days !== undefined) plan.days = await validateAndHydrateDays(body.days);
    if (body.isActive === true) {
      await CustomWorkoutPlan.updateMany({ user: req.user.id, _id: { $ne: plan._id } }, { $set: { isActive: false } });
      plan.isActive = true;
    } else if (body.isActive === false) {
      plan.isActive = false;
    }

    plan.version += 1;
    await plan.save();
    return res.json(serializePlan(plan));
  } catch (err) {
    logger.error({ err }, "Update custom workout plan error");
    return res.status(400).json({ message: err.message || "Failed to update custom workout plan" });
  }
};

exports.activatePlan = async (req, res) => {
  try {
    const plan = await CustomWorkoutPlan.findOne({ _id: req.params.id, user: req.user.id });
    if (!plan) return res.status(404).json({ message: "Custom workout plan not found" });
    await CustomWorkoutPlan.updateMany({ user: req.user.id, _id: { $ne: plan._id } }, { $set: { isActive: false } });
    plan.isActive = true;
    plan.version += 1;
    await plan.save();
    return res.json(serializePlan(plan));
  } catch (err) {
    logger.error({ err }, "Activate custom workout plan error");
    return res.status(500).json({ message: "Failed to activate custom workout plan" });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const result = await CustomWorkoutPlan.deleteOne({ _id: req.params.id, user: req.user.id });
    if (!result.deletedCount) return res.status(404).json({ message: "Custom workout plan not found" });
    return res.json({ message: "Custom workout plan deleted" });
  } catch (err) {
    logger.error({ err }, "Delete custom workout plan error");
    return res.status(500).json({ message: "Failed to delete custom workout plan" });
  }
};


function fallbackMet(mode, goal) {
  const table = {
    equipment: { bulk: 6, lean: 7, fit: 5.5 },
    bodyweight: { bulk: 5, lean: 6.5, fit: 4.5 },
    mixed: { bulk: 6, lean: 6.5, fit: 5 },
  };
  return table[mode]?.[goal] || 5;
}

exports.getPlanDay = async (req, res) => {
  try {
    const plan = await CustomWorkoutPlan.findOne({ _id: req.params.id, user: req.user.id }).lean();
    if (!plan) return res.status(404).json({ message: "Custom workout plan not found" });
    const day = Number(req.params.day);
    const workoutDay = plan.days.find((item) => Number(item.dayOfWeek) === day);
    if (!workoutDay) return res.status(404).json({ message: "Workout day not found" });

    const ids = workoutDay.exercises.map((entry) => entry.exerciseId);
    const profile = await HealthProfile.findOne({ user: req.user.id }).select("weight").lean();
    const weightKg = Number(profile?.weight) || 0;
    const exercises = ids.length ? await Exercise.find({ _id: { $in: ids } }).lean() : [];
    const byId = new Map(exercises.map((item) => [String(item._id), item]));

    const hydrated = workoutDay.exercises.map((entry) => {
      const exercise = byId.get(String(entry.exerciseId));
      return {
        ...entry,
        exerciseId: entry.exerciseId,
        name: exercise?.name || "Exercise",
        imageKey: exercise?.imageKey || "",
        primaryMuscle: exercise?.primaryMuscle || "other",
        secondaryMuscles: exercise?.secondaryMuscles || [],
        durationMinutes: exercise?.durationMinutes || 4,
        met: exercise?.met || null,
        caloriesPerExercise: weightKg ? Math.max(1, Math.round(((Number(exercise?.met) || fallbackMet(plan.mode, plan.goal)) * 3.5 * weightKg / 200) * (Number(exercise?.durationMinutes) || 4))) : 0,
      };
    });

    return res.json({
      planId: plan._id,
      planName: plan.name,
      goal: plan.goal,
      mode: plan.mode,
      day: workoutDay.dayOfWeek,
      title: workoutDay.title,
      isRestDay: workoutDay.isRestDay,
      exercises: hydrated,
    });
  } catch (err) {
    logger.error({ err }, "Get custom workout day error");
    return res.status(500).json({ message: "Failed to load custom workout day" });
  }
};

module.exports.DAY_NAMES = DAY_NAMES;
