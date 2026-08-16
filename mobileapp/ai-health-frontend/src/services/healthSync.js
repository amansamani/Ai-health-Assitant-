// ─────────────────────────────────────────────────────────────────────────
// Device health sync — steps, sleep, active calories burned
//
// Reads today's totals from the OS's health data hub instead of asking the
// user to type them in:
//   • Android → Health Connect (aggregates Fitbit, Wear OS, Samsung Health,
//     Google Fit, etc. — we never talk to those apps directly, just to
//     Health Connect, which they already sync into)
//   • iOS      → Apple HealthKit (same idea — Apple Watch and third-party
//     apps write into Health, we just read from it)
//
// Water/hydration is deliberately NOT synced here — almost no wearable
// logs it automatically (there's no sensor for "you drank a glass of
// water"), so it stays a manual-only field on the Tracking screen instead
// of pretending to auto-sync something that's realistically always empty.
//
// Neither library works in Expo Go — this needs a custom dev client /
// EAS build (which this project already uses for `eas build --profile
// preview --platform android`), so requiring them is wrapped in try/catch.
// Until the native modules are actually built into the app binary, every
// function below resolves to "unavailable" instead of crashing, so the
// existing manual-entry UI keeps working exactly as before.
// ─────────────────────────────────────────────────────────────────────────
import { Platform } from "react-native";
import { estimateCaloriesFromSteps } from "../utils/metCalories";

let HealthConnect = null;
let HealthKit = null;

if (Platform.OS === "android") {
  try {
    HealthConnect = require("react-native-health-connect");
  } catch (e) {
    console.warn("[healthSync] react-native-health-connect not linked yet:", e.message);
  }
} else if (Platform.OS === "ios") {
  try {
    HealthKit = require("@kingstinct/react-native-healthkit");
  } catch (e) {
    console.warn("[healthSync] @kingstinct/react-native-healthkit not linked yet:", e.message);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────
function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function nowISO() {
  return new Date().toISOString();
}

/** Never let one bad metric take down the whole sync. */
async function safe(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[healthSync] ${label} failed:`, e?.message ?? e);
    return null;
  }
}

// ── Android: Health Connect ─────────────────────────────────────────────
async function androidCheckAvailable() {
  if (!HealthConnect) return false;
  try {
    const status = await HealthConnect.getSdkStatus();
    // SdkAvailabilityStatus.SDK_AVAILABLE === 3 on current versions of the
    // library, but comparing against the exported enum is more future-proof
    // than hardcoding the number.
    const AVAILABLE =
      HealthConnect.SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3;
    return status === AVAILABLE;
  } catch {
    return false;
  }
}

async function androidRequestPermissions() {
  await HealthConnect.initialize();
  const granted = await HealthConnect.requestPermission([
    { accessType: "read", recordType: "Steps" },
    { accessType: "read", recordType: "SleepSession" },
    { accessType: "read", recordType: "ActiveCaloriesBurned" },
  ]);
  const grantedTypes = new Set((granted ?? []).map((p) => p.recordType));
  return {
    steps: grantedTypes.has("Steps"),
    sleep: grantedTypes.has("SleepSession"),
    calories: grantedTypes.has("ActiveCaloriesBurned"),
  };
}

async function androidFetchToday() {
  const timeRangeFilter = {
    operator: "between",
    startTime: startOfTodayISO(),
    endTime: nowISO(),
  };

  const steps = await safe("android steps", async () => {
    const { records } = await HealthConnect.readRecords("Steps", { timeRangeFilter });
    if (!records?.length) return null;
    return records.reduce((total, r) => total + (r.count || 0), 0);
  });

  const sleepHours = await safe("android sleep", async () => {
    const { records } = await HealthConnect.readRecords("SleepSession", { timeRangeFilter });
    if (!records?.length) return null;
    const ms = records.reduce(
      (total, r) => total + (new Date(r.endTime) - new Date(r.startTime)),
      0
    );
    return Math.round((ms / (1000 * 60 * 60)) * 10) / 10; // 1 decimal place
  });

  const caloriesBurned = await safe("android calories", async () => {
    const { records } = await HealthConnect.readRecords("ActiveCaloriesBurned", { timeRangeFilter });
    if (!records?.length) return null;
    // Verified record shape: { energy: { inCalories, inJoules, inKilojoules, inKilocalories } }
    const kcal = records.reduce((total, r) => total + (r.energy?.inKilocalories || 0), 0);
    return Math.round(kcal);
  });

  return { steps, sleepHours, caloriesBurned };
}

// ── iOS: HealthKit ───────────────────────────────────────────────────────
const HK_STEP_COUNT = "HKQuantityTypeIdentifierStepCount";
const HK_ACTIVE_ENERGY_BURNED = "HKQuantityTypeIdentifierActiveEnergyBurned";
const HK_SLEEP_ANALYSIS = "HKCategoryTypeIdentifierSleepAnalysis";
// Apple's HKCategoryValueSleepAnalysis enum — "awake" segments should not
// count toward sleep duration, everything else (in bed / asleep variants) does.
const HK_SLEEP_AWAKE_VALUE = 2;

async function iosCheckAvailable() {
  if (!HealthKit) return false;
  try {
    return await HealthKit.isHealthDataAvailable();
  } catch {
    return false;
  }
}

async function iosRequestPermissions() {
  await HealthKit.requestAuthorization([HK_STEP_COUNT, HK_ACTIVE_ENERGY_BURNED, HK_SLEEP_ANALYSIS]);
  // HealthKit famously never tells a reading app whether "read" access was
  // actually granted (only whether authorization was *requested*) — Apple's
  // deliberate privacy trade-off. We treat "the request didn't throw" as
  // success and let the per-metric fetch below decide what's actually usable.
  return { steps: true, sleep: true, calories: true };
}

async function iosFetchToday() {
  const startDate = startOfTodayISO();
  const endDate = nowISO();

  const steps = await safe("ios steps", async () => {
    const samples = await HealthKit.queryQuantitySamples(HK_STEP_COUNT, {
      filter: { startDate, endDate },
    });
    if (!samples?.length) return null;
    return Math.round(samples.reduce((total, s) => total + (s.quantity || 0), 0));
  });

  const caloriesBurned = await safe("ios calories", async () => {
    const samples = await HealthKit.queryQuantitySamples(HK_ACTIVE_ENERGY_BURNED, {
      filter: { startDate, endDate },
    });
    if (!samples?.length) return null;
    // HealthKit's default preferred unit for energy is kcal in the vast
    // majority of real configurations; fall back to summing raw quantity.
    return Math.round(samples.reduce((total, s) => total + (s.quantity || 0), 0));
  });

  const sleepHours = await safe("ios sleep", async () => {
    const samples = await HealthKit.queryCategorySamples(HK_SLEEP_ANALYSIS, {
      filter: { startDate, endDate },
    });
    if (!samples?.length) return null;
    const ms = samples.reduce((total, s) => {
      if (s.value === HK_SLEEP_AWAKE_VALUE) return total; // skip "awake" segments
      return total + (new Date(s.endDate) - new Date(s.startDate));
    }, 0);
    return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
  });

  return { steps, sleepHours, caloriesBurned };
}

// ── Public API ───────────────────────────────────────────────────────────

/** Is device sync even possible here (right platform + health app present)? */
export async function isHealthSyncAvailable() {
  if (Platform.OS === "android") return androidCheckAvailable();
  if (Platform.OS === "ios") return iosCheckAvailable();
  return false; // web / other
}

/**
 * Ask for read access. Safe to call every time a screen mounts — both
 * platforms no-op instead of re-prompting once the user has already
 * answered (granted or denied).
 * Returns { steps, sleep, calories } booleans (Android tells us per-type;
 * iOS can only tell us "request didn't error", see iosRequestPermissions).
 */
export async function requestHealthSyncPermissions() {
  try {
    if (Platform.OS === "android") {
      if (!HealthConnect || !(await androidCheckAvailable())) {
        return { steps: false, sleep: false, calories: false, unavailable: true };
      }
      return await androidRequestPermissions();
    }
    if (Platform.OS === "ios") {
      if (!HealthKit || !(await iosCheckAvailable())) {
        return { steps: false, sleep: false, calories: false, unavailable: true };
      }
      return await iosRequestPermissions();
    }
  } catch (e) {
    console.warn("[healthSync] permission request failed:", e?.message ?? e);
  }
  return { steps: false, sleep: false, calories: false, unavailable: true };
}

/**
 * Pull today's totals from the device. Any metric that isn't available
 * (no permission, no data source) comes back as `null` rather than failing
 * the whole call — callers should fall back to manual entry per-field, not
 * all-or-nothing.
 *
 * Tier 1 → Tier 2 for calories specifically: if the device gives us steps
 * but not a direct active-calories reading (common on Android without a
 * fitness app installed alongside Health Connect), we estimate walking
 * calories from steps + weight instead of leaving the ring empty. Pass
 * `weightKg` to enable this; omit it to get pure Tier 1 (device-only) data.
 *
 * Returns: {
 *   steps: number|null, sleepHours: number|null, caloriesBurned: number|null,
 *   caloriesEstimated: boolean  // true if caloriesBurned came from the steps fallback, not a direct device reading
 * }
 */
export async function fetchTodayFromDevice(weightKg) {
  let result = { steps: null, sleepHours: null, caloriesBurned: null };
  try {
    if (Platform.OS === "android" && HealthConnect) result = await androidFetchToday();
    else if (Platform.OS === "ios" && HealthKit) result = await iosFetchToday();
  } catch (e) {
    console.warn("[healthSync] fetchTodayFromDevice failed:", e?.message ?? e);
  }

  if (result.caloriesBurned == null && result.steps != null && weightKg) {
    const estimated = estimateCaloriesFromSteps(result.steps, weightKg);
    if (estimated != null) {
      return { ...result, caloriesBurned: estimated, caloriesEstimated: true };
    }
  }

  return { ...result, caloriesEstimated: false };
}
