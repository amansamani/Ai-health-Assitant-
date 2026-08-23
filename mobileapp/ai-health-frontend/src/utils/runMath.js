// ─────────────────────────────────────────────────────────────────────────
// Run-tracking math: distance (haversine), pace/duration formatting, and a
// speed-aware calorie estimate for GPS activities (run/walk/cycle).
//
// Kept separate from metCalories.js because that file's MET table is a
// fixed "one MET per activity" model (fine for quick-add presets), while a
// GPS run needs MET to scale with actual pace — a 5:00/km run and a
// 7:30/km run burn very differently even over the same distance.
// ─────────────────────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two {lat,lng} points, in meters. */
export function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

// GPS jitter while stationary (waiting at a crossing, tying a shoelace)
// otherwise silently inflates distance. Anything faster than ~43 km/h is
// almost certainly a GPS spike, not a human runner — drop it rather than
// let one bad sample wreck the whole run's stats.
const MIN_ACCEPTED_JUMP_M = 1.5;
const MAX_PLAUSIBLE_SPEED_MPS = 12; // ~43 km/h

/**
 * Adds one new GPS point to a route, returning the extra distance (in
 * meters) it contributes — 0 if it's filtered out as noise.
 */
export function distanceDelta(prevPoint, nextPoint) {
  if (!prevPoint) return 0;

  const meters = haversineMeters(prevPoint, nextPoint);
  if (meters < MIN_ACCEPTED_JUMP_M) return 0;

  const dtSeconds = Math.max(0.001, (nextPoint.ts - prevPoint.ts) / 1000);
  const speedMps = meters / dtSeconds;
  if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) return 0;

  return meters;
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDistanceKm(meters, decimals = 2) {
  return (Math.max(0, meters || 0) / 1000).toFixed(decimals);
}

/** secPerKm -> "5:24" (min:sec per km). Returns "--:--" when not enough data. */
export function formatPace(secPerKm) {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "--:--";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function paceSecPerKm(distanceMeters, durationSeconds) {
  if (!distanceMeters || distanceMeters <= 0) return 0;
  return durationSeconds / (distanceMeters / 1000);
}

// Running MET rises with speed — this is a piecewise-linear fit against the
// standard Compendium of Physical Activities running values (kmh -> MET):
// 8→8.3, 9.7→9.8, 11.3→11.0, 12.9→11.8, 14.5→12.8, 16.1→14.5, 19.3→19.0.
const RUNNING_MET_CURVE = [
  { kmh: 4, met: 6.0 },
  { kmh: 8, met: 8.3 },
  { kmh: 9.7, met: 9.8 },
  { kmh: 11.3, met: 11.0 },
  { kmh: 12.9, met: 11.8 },
  { kmh: 14.5, met: 12.8 },
  { kmh: 16.1, met: 14.5 },
  { kmh: 19.3, met: 19.0 },
];

function metForRunningSpeed(speedKmh) {
  const curve = RUNNING_MET_CURVE;
  if (speedKmh <= curve[0].kmh) return curve[0].met;
  if (speedKmh >= curve[curve.length - 1].kmh) return curve[curve.length - 1].met;

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (speedKmh >= a.kmh && speedKmh <= b.kmh) {
      const t = (speedKmh - a.kmh) / (b.kmh - a.kmh);
      return a.met + t * (b.met - a.met);
    }
  }
  return curve[curve.length - 1].met;
}

// Flat METs for activities where GPS speed is a poor proxy for effort
// (cycling gearing varies wildly; brisk walking barely changes MET with pace).
const FLAT_MET = { walk: 3.8, cycle: 7.5 };

const DEFAULT_WEIGHT_KG = 70;

/**
 * Estimates calories burned for a completed GPS activity.
 * Mirrors the ACSM formula used everywhere else in the app:
 * kcal = MET × 3.5 × weightKg / 200 × minutes
 */
export function estimateActivityCalories({
  activityType = "run",
  distanceMeters,
  durationSeconds,
  weightKg,
}) {
  const w = weightKg || DEFAULT_WEIGHT_KG;
  const minutes = (durationSeconds || 0) / 60;
  if (!minutes) return 0;

  let met;
  if (activityType === "run") {
    const speedKmh = distanceMeters / 1000 / (durationSeconds / 3600 || 1);
    met = metForRunningSpeed(speedKmh);
  } else {
    met = FLAT_MET[activityType] || FLAT_MET.walk;
  }

  return Math.round(((met * 3.5 * w) / 200) * minutes);
}
