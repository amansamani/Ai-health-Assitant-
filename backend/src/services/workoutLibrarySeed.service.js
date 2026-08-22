const WorkoutPlan = require("../models/WorkoutPlan");
const Exercise = require("../models/Exercise");

const normalize = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

function inferExerciseMeta(name, reps, imageKey) {
  const n = normalize(name);
  const repText = String(reps || "").toLowerCase();

  let primaryMuscle = "other";
  let secondaryMuscles = [];
  let category = "strength";
  let equipment = ["bodyweight"];
  let difficulty = "beginner";
  let movementPattern = "";
  let defaultRestSeconds = 60;
  let durationMinutes = 4;

  if (/treadmill|cycling|rowing|battle rope|jump rope|brisk walking|jog|elliptical|high knees|jumping jacks|burpees|mountain climbers/.test(n)) {
    category = "cardio";
    primaryMuscle = "cardio";
    movementPattern = "conditioning";
    defaultRestSeconds = 30;
    durationMinutes = 5;
  } else if (/plank|crunch|leg raise|russian twist|ab rollout|core|dead bug/.test(n)) {
    category = "core";
    primaryMuscle = "core";
    movementPattern = "core";
    durationMinutes = 4;
  } else if (/stretch|yoga|foam rolling|deep breathing|mobility|recovery/.test(n)) {
    category = "mobility";
    primaryMuscle = "mobility";
    defaultRestSeconds = 20;
    durationMinutes = 5;
  }

  if (/bench press|incline.*press|decline.*press|chest fly|push-up|push ups|dips|chest hold/.test(n)) {
    primaryMuscle = "chest";
    secondaryMuscles = ["triceps", "shoulders"];
    movementPattern = "horizontal_push";
  } else if (/lat pulldown|pull-up|pull up|chin-up|row|deadlift|face pull|superman|dead hang/.test(n)) {
    primaryMuscle = "back";
    secondaryMuscles = ["biceps", "forearms"];
    movementPattern = "pull";
  } else if (/shoulder press|overhead press|lateral raise|front raise|rear delt|upright row|pike push|handstand|shoulder tap|arm circle|shrug/.test(n)) {
    primaryMuscle = "shoulders";
    secondaryMuscles = ["triceps"];
    movementPattern = "vertical_push";
  } else if (/bicep|curl|hammer curl|preacher curl/.test(n)) {
    primaryMuscle = "biceps";
    secondaryMuscles = ["forearms"];
    movementPattern = "elbow_flexion";
  } else if (/tricep|skull crusher|pushdown|extension/.test(n)) {
    primaryMuscle = "triceps";
    secondaryMuscles = ["chest", "shoulders"];
    movementPattern = "elbow_extension";
  } else if (/squat|leg press|leg extension|lunge|jump squat|wall sit/.test(n)) {
    primaryMuscle = "quads";
    secondaryMuscles = ["glutes", "hamstrings"];
    movementPattern = "squat";
  } else if (/romanian deadlift|leg curl|hamstring/.test(n)) {
    primaryMuscle = "hamstrings";
    secondaryMuscles = ["glutes"];
    movementPattern = "hinge";
  } else if (/glute|hip thrust/.test(n)) {
    primaryMuscle = "glutes";
    secondaryMuscles = ["hamstrings"];
    movementPattern = "hip_extension";
  } else if (/calf/.test(n)) {
    primaryMuscle = "calves";
    movementPattern = "plantar_flexion";
  }

  if (/barbell|bench|cable|dumbbell|machine|pulldown|leg press|leg curl|leg extension|treadmill|rowing|elliptical|battle rope|kettlebell/.test(n)) {
    equipment = ["gym"];
  }
  if (/dumbbell/.test(n)) equipment = ["dumbbell", "gym"];
  if (/barbell/.test(n)) equipment = ["barbell", "gym"];
  if (/cable|pushdown|cable crunch/.test(n)) equipment = ["cable", "gym"];
  if (/bench press|incline.*press|decline.*press|fly/.test(n)) equipment = ["barbell", "dumbbell", "bench", "gym"];
  if (/towel|isometric towel/.test(n)) equipment = ["towel", "bodyweight"];

  if (repText.includes("min")) {
    const value = Number.parseFloat(repText);
    if (Number.isFinite(value) && value > 0) durationMinutes = Math.min(value, 120);
  } else if (repText.includes("sec")) {
    const value = Number.parseFloat(repText);
    if (Number.isFinite(value) && value > 0) durationMinutes = Math.max(0.25, Math.min(value / 60, 30));
  }

  if (/max|10|12|15|20|25|30/.test(repText) && difficulty === "beginner") {
    if (/pull-up|handstand|deadlift|romanian deadlift|barbell|squat/.test(n)) difficulty = "intermediate";
  }

  return {
    primaryMuscle,
    secondaryMuscles,
    category,
    equipment,
    difficulty,
    movementPattern,
    defaultRestSeconds,
    durationMinutes,
    imageKey: imageKey || "",
  };
}

async function seedWorkoutExerciseLibrary() {
  const plans = await WorkoutPlan.find({}).select("exercises").lean();
  const unique = new Map();

  for (const plan of plans) {
    for (const exercise of plan.exercises || []) {
      const key = normalize(exercise.name);
      if (!key || unique.has(key)) continue;
      unique.set(key, exercise);
    }
  }

  let inserted = 0;
  for (const exercise of unique.values()) {
    const normalizedName = normalize(exercise.name);
    const meta = inferExerciseMeta(exercise.name, exercise.reps, exercise.imageKey);
    const update = {
      $setOnInsert: {
        name: exercise.name,
        normalizedName,
        ...meta,
        defaultSets: Number(exercise.sets) || 3,
        defaultReps: String(exercise.reps || "10"),
        active: true,
      },
    };
    const result = await Exercise.updateOne({ normalizedName }, update, { upsert: true });
    if (result.upsertedCount) inserted += result.upsertedCount;
  }

  return { discovered: unique.size, inserted };
}


async function migrateWorkoutPlansToExerciseIds() {
  const plans = await WorkoutPlan.find({}).select("exercises").lean();
  let updatedPlans = 0;
  let migratedExercises = 0;
  let unresolvedExercises = 0;

  for (const plan of plans) {
    let changed = false;
    const nextExercises = [];

    for (const exercise of plan.exercises || []) {
      let exerciseDoc = null;

      if (exercise.exerciseId) {
        exerciseDoc = await Exercise.findOne({ _id: exercise.exerciseId, active: true }).lean();
      }

      if (!exerciseDoc && exercise.name) {
        const normalizedName = normalize(exercise.name);
        exerciseDoc = await Exercise.findOne({ normalizedName, active: true }).lean();
      }

      if (!exerciseDoc) {
        unresolvedExercises += 1;
        nextExercises.push(exercise);
        continue;
      }

      const next = {
        exerciseId: exerciseDoc._id,
        sets: Number(exercise.sets) || Number(exerciseDoc.defaultSets) || 3,
        reps: String(exercise.reps || exerciseDoc.defaultReps || "10"),
      };

      if (String(exercise.exerciseId || "") !== String(next.exerciseId) || exercise.name || exercise.imageKey) {
        changed = true;
        migratedExercises += 1;
      }

      nextExercises.push(next);
    }

    if (changed) {
      await WorkoutPlan.updateOne(
        { _id: plan._id },
        { $set: { exercises: nextExercises } },
      );
      updatedPlans += 1;
    }
  }

  return { updatedPlans, migratedExercises, unresolvedExercises };
}

module.exports = { seedWorkoutExerciseLibrary, migrateWorkoutPlansToExerciseIds };
