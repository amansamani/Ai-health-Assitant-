const EARTH_RADIUS_M = 6371000;

export function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const MIN_ACCEPTED_JUMP_M = 1.5;
const MAX_PLAUSIBLE_SPEED_MPS = 12;

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
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatDistanceKm(meters, decimals = 2) {
  return (Math.max(0, meters || 0) / 1000).toFixed(decimals);
}

export function formatPace(secPerKm) {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm <= 0) return "--:--";
  const rounded = Math.round(secPerKm);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function paceSecPerKm(distanceMeters, durationSeconds) {
  // A pace at 20–30 m is dominated by normal consumer-GPS error. Avoid
  // showing misleading values such as 63:53/km until ~100 m is recorded.
  if (!distanceMeters || distanceMeters < 100 || !durationSeconds || durationSeconds < 30) return 0;
  return durationSeconds / (distanceMeters / 1000);
}

// Representative MET curves for GPS activities. They are estimates, not a
// clinical measurement; terrain, grade, wind, fitness and actual effort vary.
const ACTIVITY_MET_CURVES = {
  run: [
    { kmh: 6.4, met: 6.0 }, { kmh: 8.0, met: 8.3 }, { kmh: 9.7, met: 9.8 },
    { kmh: 11.3, met: 11.0 }, { kmh: 12.9, met: 11.8 }, { kmh: 14.5, met: 12.8 },
    { kmh: 16.1, met: 14.5 }, { kmh: 19.3, met: 19.0 },
  ],
  walk: [
    { kmh: 2.0, met: 2.3 }, { kmh: 3.2, met: 2.8 }, { kmh: 4.0, met: 3.5 },
    { kmh: 5.0, met: 3.8 }, { kmh: 5.6, met: 4.3 }, { kmh: 6.4, met: 5.0 },
    { kmh: 7.2, met: 6.3 },
  ],
  cycle: [
    { kmh: 8.0, met: 3.5 }, { kmh: 12.0, met: 5.0 }, { kmh: 16.1, met: 6.8 },
    { kmh: 19.3, met: 8.0 }, { kmh: 22.5, met: 10.0 }, { kmh: 25.7, met: 12.0 },
  ],
};

function interpolateMet(curve, speedKmh) {
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

const DEFAULT_WEIGHT_KG = 70;

export function estimateActivityCalories({ activityType = "run", distanceMeters, durationSeconds, weightKg }) {
  const w = Number(weightKg) > 0 ? Number(weightKg) : DEFAULT_WEIGHT_KG;
  const seconds = Math.max(0, Number(durationSeconds) || 0);
  const minutes = seconds / 60;
  if (!minutes) return 0;
  const distanceKm = Math.max(0, Number(distanceMeters) || 0) / 1000;
  const speedKmh = distanceKm / (seconds / 3600 || 1);
  const curve = ACTIVITY_MET_CURVES[activityType] || ACTIVITY_MET_CURVES.walk;
  const met = interpolateMet(curve, speedKmh);
  return Math.max(0, Math.round(((met * 3.5 * w) / 200) * minutes));
}
