// ─────────────────────────────────────────────────────────────────────────
// METs (Metabolic Equivalent of Task) calorie math — Tier 2/3 of the
// calorie-source hierarchy: used when there's no wearable to measure real
// active calories, so we estimate instead.
//
// Standard ACSM formula: kcal/min = METs × 3.5 × weight(kg) / 200
// This mirrors backend/src/controllers/workoutController.js's formula
// exactly (can't share JS modules across the RN app / Node backend, so
// it's duplicated — keep both in sync if you tweak the constants).
// ─────────────────────────────────────────────────────────────────────────

const DEFAULT_WEIGHT_KG = 70; // fallback if the health profile hasn't loaded yet

export function kcalFromMET(met, weightKg, minutes) {
  const w = weightKg || DEFAULT_WEIGHT_KG;
  if (!met || !minutes) return 0;
  return Math.round(((met * 3.5 * w) / 200) * minutes);
}

// Tier 2a: no wearable, but the phone still has a step count (steps work
// without a watch on both Health Connect and HealthKit — it's the one
// metric that never needs a fallback of its own). Assumes a moderate
// walking pace (~100 steps/min) to convert step count into minutes.
const WALKING_MET = 3.5;
const AVG_WALKING_CADENCE_STEPS_PER_MIN = 100;

export function estimateCaloriesFromSteps(steps, weightKg) {
  if (!steps) return null;
  const minutes = steps / AVG_WALKING_CADENCE_STEPS_PER_MIN;
  return kcalFromMET(WALKING_MET, weightKg, minutes);
}

// Tier 3: quick-add presets for activities a phone can't see (swimming,
// most cycling, yoga off-body). MET values are representative averages,
// not lab measurements.
export const QUICK_ADD_ACTIVITIES = [
  { key: "walk",     label: "Walk",     icon: "walk-outline",     met: 3.5, minutes: 30 },
  { key: "cycling",  label: "Cycling",  icon: "bicycle-outline",  met: 6,   minutes: 30 },
  { key: "swimming", label: "Swimming", icon: "water-outline",    met: 7,   minutes: 30 },
  { key: "yoga",     label: "Yoga",     icon: "body-outline",     met: 3,   minutes: 20 },
];
