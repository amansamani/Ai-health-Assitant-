const Exercise = require("../models/Exercise");
const logger = require("../config/logger");
const { seedWorkoutExerciseLibrary } = require("../services/workoutLibrarySeed.service");

const ALLOWED_MUSCLES = new Set([
  "chest", "back", "shoulders", "biceps", "triceps", "forearms",
  "quads", "hamstrings", "glutes", "calves", "core", "full_body",
  "cardio", "mobility", "other",
]);
const ALLOWED_EQUIPMENT = new Set(["bodyweight", "gym", "barbell", "dumbbell", "cable", "bench", "towel"]);

exports.listExercises = async (req, res) => {
  try {
    const { q = "", muscle, equipment, category, limit = 40 } = req.query;
    const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 40, 1), 100);
    const filter = { active: true };

    if (muscle && ALLOWED_MUSCLES.has(muscle)) {
      filter.$or = [{ primaryMuscle: muscle }, { secondaryMuscles: muscle }];
    }
    if (equipment && ALLOWED_EQUIPMENT.has(equipment)) {
      filter.equipment = equipment;
    }
    if (category) filter.category = category;
    if (String(q).trim()) {
      filter.name = { $regex: String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    }

    const exercises = await Exercise.find(filter)
      .select("name primaryMuscle secondaryMuscles equipment category difficulty imageKey defaultSets defaultReps defaultRestSeconds durationMinutes met")
      .sort({ primaryMuscle: 1, name: 1 })
      .limit(safeLimit)
      .lean();

    return res.json(exercises);
  } catch (err) {
    logger.error({ err }, "List exercises error");
    return res.status(500).json({ message: "Failed to load exercise library" });
  }
};

exports.createExercise = async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (name.length < 2) return res.status(400).json({ message: "Exercise name is required" });

    const normalizedName = name.toLowerCase().replace(/\s+/g, " ");
    const exists = await Exercise.findOne({ normalizedName });
    if (exists) return res.status(409).json({ message: "Exercise already exists" });

    const exercise = await Exercise.create({
      ...body,
      name,
      normalizedName,
      imageKey: String(body.imageKey || "").trim() || normalizedName.replace(/[^a-z0-9]+/g, "_"),
    });

    return res.status(201).json(exercise);
  } catch (err) {
    logger.error({ err }, "Create exercise error");
    return res.status(500).json({ message: "Failed to create exercise" });
  }
};

exports.updateExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!exercise) return res.status(404).json({ message: "Exercise not found" });
    return res.json(exercise);
  } catch (err) {
    logger.error({ err }, "Update exercise error");
    return res.status(500).json({ message: "Failed to update exercise" });
  }
};

exports.seedExerciseLibrary = async (req, res) => {
  try {
    const result = await seedWorkoutExerciseLibrary();
    return res.json({ message: "Exercise library synchronized", ...result });
  } catch (err) {
    logger.error({ err }, "Seed exercise library error");
    return res.status(500).json({ message: "Failed to synchronize exercise library" });
  }
};
