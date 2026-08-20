// ─────────────────────────────────────────────────────────────────────────────
// FitLip Device Health Sync
//
// Sources:
//   Android → Health Connect
//   iOS     → Apple HealthKit
//
// Metrics:
//   • Steps
//   • Sleep
//   • Active calories
//
// IMPORTANT SLEEP BEHAVIOUR
// ─────────────────────────────────────────────────────────────────────────────
//
// Sleep is different from steps/calories.
//
// Steps:
//
//   today 00:00 → now
//
// Sleep:
//
//   We look back 24 hours because the sleep belonging to "today"
//   commonly starts yesterday:
//
//       yesterday 23:00
//              ↓
//       today   07:00
//
// If we queried only:
//
//       today 00:00 → now
//
// we'd lose the first hour.
//
// iOS additionally reports sleep as category samples:
//
//   0 = inBed
//   1 = asleepUnspecified
//   2 = awake
//   3 = asleepCore
//   4 = asleepDeep
//   5 = asleepREM
//
// We DO NOT count:
//
//   inBed
//   awake
//
// We DO count actual asleep states.
//
// Overlapping samples are merged before calculating duration so that
// multiple providers/stages cannot accidentally turn 8 hours of sleep
// into 12+ hours.
//
// Water is intentionally NOT synced here.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from "react-native";
import { estimateCaloriesFromSteps } from "../utils/metCalories";

let HealthConnect = null;
let HealthKit = null;

/*
 * Native modules are optional at JavaScript bundle time.
 *
 * Expo Go does not contain these native modules.
 * A development build / EAS build is required.
 */
if (Platform.OS === "android") {
  try {
    HealthConnect = require(
      "react-native-health-connect"
    );
  } catch (error) {
    console.warn(
      "[healthSync] react-native-health-connect not linked:",
      error?.message ?? error
    );
  }
}

if (Platform.OS === "ios") {
  try {
    HealthKit = require(
      "@kingstinct/react-native-healthkit"
    );
  } catch (error) {
    console.warn(
      "[healthSync] @kingstinct/react-native-healthkit not linked:",
      error?.message ?? error
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Time helpers
// ─────────────────────────────────────────────────────────────────────────────

function startOfToday() {
  const date = new Date();

  date.setHours(
    0,
    0,
    0,
    0
  );

  return date;
}

function startOfTodayISO() {
  return startOfToday().toISOString();
}

function nowISO() {
  return new Date().toISOString();
}

/**
 * Sleep query starts 24 hours before now.
 *
 * This catches:
 *
 *   yesterday 22:30 → today 06:30
 *
 * and similar overnight sessions.
 */
function sleepLookbackStart() {
  const date = new Date();

  date.setTime(
    date.getTime() -
      24 * 60 * 60 * 1000
  );

  return date;
}

function sleepLookbackStartISO() {
  return sleepLookbackStart().toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic safety helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Never allow one health metric to crash the entire synchronization.
 */
async function safe(
  label,
  fn
) {
  try {
    return await fn();
  } catch (error) {
    console.warn(
      `[healthSync] ${label} failed:`,
      error?.message ?? error
    );

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Interval helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a possible date value into a timestamp.
 */
function toTimestamp(
  value
) {
  const timestamp =
    new Date(value).getTime();

  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;
}

/**
 * Merge overlapping intervals.
 *
 * Input:
 *
 * [
 *   { start: 10, end: 20 },
 *   { start: 15, end: 25 }
 * ]
 *
 * Output:
 *
 * [
 *   { start: 10, end: 25 }
 * ]
 *
 * This prevents double-counting overlapping sleep samples.
 */
function mergeIntervals(
  intervals
) {
  if (
    !Array.isArray(
      intervals
    ) ||
    intervals.length === 0
  ) {
    return [];
  }

  const sorted =
    intervals
      .filter(
        (interval) =>
          Number.isFinite(
            interval.start
          ) &&
          Number.isFinite(
            interval.end
          ) &&
          interval.end >
            interval.start
      )
      .sort(
        (a, b) =>
          a.start - b.start
      );

  if (!sorted.length) {
    return [];
  }

  const merged = [
    {
      start:
        sorted[0].start,
      end:
        sorted[0].end,
    },
  ];

  for (
    let i = 1;
    i < sorted.length;
    i += 1
  ) {
    const current =
      sorted[i];

    const previous =
      merged[
        merged.length - 1
      ];

    /*
     * Overlap or directly touching interval.
     */
    if (
      current.start <=
      previous.end
    ) {
      previous.end =
        Math.max(
          previous.end,
          current.end
        );
    } else {
      merged.push({
        start:
          current.start,
        end:
          current.end,
      });
    }
  }

  return merged;
}

/**
 * Calculate total milliseconds from merged intervals.
 */
function totalIntervalMilliseconds(
  intervals
) {
  return intervals.reduce(
    (
      total,
      interval
    ) =>
      total +
      (
        interval.end -
        interval.start
      ),
    0
  );
}

/**
 * Convert milliseconds → hours rounded to one decimal.
 */
function millisecondsToHours(
  milliseconds
) {
  return Math.round(
    (
      milliseconds /
      (1000 * 60 * 60)
    ) * 10
  ) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Android — Health Connect
// ─────────────────────────────────────────────────────────────────────────────

async function androidCheckAvailable() {
  if (!HealthConnect) {
    return false;
  }

  try {
    const status =
      await HealthConnect.getSdkStatus();

    const AVAILABLE =
      HealthConnect
        .SdkAvailabilityStatus
        ?.SDK_AVAILABLE ?? 3;

    return (
      status === AVAILABLE
    );
  } catch {
    return false;
  }
}

async function androidRequestPermissions() {
  if (!HealthConnect) {
    return {
      steps: false,
      sleep: false,
      calories: false,
      unavailable: true,
    };
  }

  await HealthConnect.initialize();

  const granted =
    await HealthConnect.requestPermission(
      [
        {
          accessType:
            "read",
          recordType:
            "Steps",
        },
        {
          accessType:
            "read",
          recordType:
            "SleepSession",
        },
        {
          accessType:
            "read",
          recordType:
            "ActiveCaloriesBurned",
        },
      ]
    );

  const grantedTypes =
    new Set(
      (granted ?? []).map(
        (permission) =>
          permission.recordType
      )
    );

  return {
    steps:
      grantedTypes.has(
        "Steps"
      ),

    sleep:
      grantedTypes.has(
        "SleepSession"
      ),

    calories:
      grantedTypes.has(
        "ActiveCaloriesBurned"
      ),

    unavailable: false,
  };
}

/**
 * Read today's step count.
 */
async function androidFetchSteps() {
  return safe(
    "android steps",
    async () => {
      const {
        records,
      } =
        await HealthConnect.readRecords(
          "Steps",
          {
            timeRangeFilter: {
              operator:
                "between",

              startTime:
                startOfTodayISO(),

              endTime:
                nowISO(),
            },
          }
        );

      if (
        !records?.length
      ) {
        return null;
      }

      const total =
        records.reduce(
          (
            sum,
            record
          ) =>
            sum +
            Number(
              record.count ||
                0
            ),
          0
        );

      return Math.max(
        0,
        Math.round(total)
      );
    }
  );
}

/**
 * Read sleep over the previous 24 hours.
 *
 * This deliberately differs from steps/calories.
 */
async function androidFetchSleep() {
  return safe(
    "android sleep",
    async () => {
      const {
        records,
      } =
        await HealthConnect.readRecords(
          "SleepSession",
          {
            timeRangeFilter: {
              operator:
                "between",

              startTime:
                sleepLookbackStartISO(),

              endTime:
                nowISO(),
            },
          }
        );

      if (
        !records?.length
      ) {
        return null;
      }

      const intervals =
        records
          .map(
            (record) => {
              const start =
                toTimestamp(
                  record.startTime
                );

              const end =
                toTimestamp(
                  record.endTime
                );

              return {
                start,
                end,
              };
            }
          )
          .filter(
            (interval) =>
              interval.start !==
                null &&
              interval.end !==
                null &&
              interval.end >
                interval.start
          );

      const merged =
        mergeIntervals(
          intervals
        );

      const milliseconds =
        totalIntervalMilliseconds(
          merged
        );

      if (
        milliseconds <= 0
      ) {
        return null;
      }

      return millisecondsToHours(
        milliseconds
      );
    }
  );
}

/**
 * Read today's active calories.
 */
async function androidFetchCalories() {
  return safe(
    "android calories",
    async () => {
      const {
        records,
      } =
        await HealthConnect.readRecords(
          "ActiveCaloriesBurned",
          {
            timeRangeFilter: {
              operator:
                "between",

              startTime:
                startOfTodayISO(),

              endTime:
                nowISO(),
            },
          }
        );

      if (
        !records?.length
      ) {
        return null;
      }

      const kcal =
        records.reduce(
          (
            total,
            record
          ) =>
            total +
            Number(
              record.energy
                ?.inKilocalories ||
                0
            ),
          0
        );

      if (
        !Number.isFinite(
          kcal
        )
      ) {
        return null;
      }

      return Math.max(
        0,
        Math.round(kcal)
      );
    }
  );
}

async function androidFetchToday() {
  /*
   * Fetch independently.
   *
   * If sleep fails, steps and calories should still work.
   */
  const [
    steps,
    sleepHours,
    caloriesBurned,
  ] = await Promise.all([
    androidFetchSteps(),
    androidFetchSleep(),
    androidFetchCalories(),
  ]);

  return {
    steps,
    sleepHours,
    caloriesBurned,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// iOS — HealthKit
// ─────────────────────────────────────────────────────────────────────────────

const HK_STEP_COUNT =
  "HKQuantityTypeIdentifierStepCount";

const HK_ACTIVE_ENERGY_BURNED =
  "HKQuantityTypeIdentifierActiveEnergyBurned";

const HK_SLEEP_ANALYSIS =
  "HKCategoryTypeIdentifierSleepAnalysis";

/*
 * HealthKit sleep values:
 *
 * 0 = inBed
 * 1 = asleepUnspecified
 * 2 = awake
 * 3 = asleepCore
 * 4 = asleepDeep
 * 5 = asleepREM
 *
 * Only actual asleep states count toward sleep duration.
 */
const HK_ASLEEP_VALUES =
  new Set([
    1,
    3,
    4,
    5,
  ]);

async function iosCheckAvailable() {
  if (!HealthKit) {
    return false;
  }

  try {
    return await HealthKit.isHealthDataAvailable();
  } catch {
    return false;
  }
}

async function iosRequestPermissions() {
  if (!HealthKit) {
    return {
      steps: false,
      sleep: false,
      calories: false,
      unavailable: true,
    };
  }

  await HealthKit.requestAuthorization(
    [
      HK_STEP_COUNT,
      HK_ACTIVE_ENERGY_BURNED,
      HK_SLEEP_ANALYSIS,
    ]
  );

  /*
   * HealthKit intentionally doesn't expose read authorization
   * state in the same way Health Connect does.
   *
   * A successful request means the OS accepted the request;
   * actual data availability is determined during reads.
   */
  return {
    steps: true,
    sleep: true,
    calories: true,
    unavailable: false,
  };
}

async function iosFetchSteps() {
  return safe(
    "ios steps",
    async () => {
      const samples =
        await HealthKit.queryQuantitySamples(
          HK_STEP_COUNT,
          {
            filter: {
              startDate:
                startOfTodayISO(),

              endDate:
                nowISO(),
            },
          }
        );

      if (
        !samples?.length
      ) {
        return null;
      }

      const total =
        samples.reduce(
          (
            sum,
            sample
          ) =>
            sum +
            Number(
              sample.quantity ||
                0
            ),
          0
        );

      if (
        !Number.isFinite(
          total
        )
      ) {
        return null;
      }

      return Math.max(
        0,
        Math.round(total)
      );
    }
  );
}

async function iosFetchCalories() {
  return safe(
    "ios calories",
    async () => {
      const samples =
        await HealthKit.queryQuantitySamples(
          HK_ACTIVE_ENERGY_BURNED,
          {
            filter: {
              startDate:
                startOfTodayISO(),

              endDate:
                nowISO(),
            },
          }
        );

      if (
        !samples?.length
      ) {
        return null;
      }

      const total =
        samples.reduce(
          (
            sum,
            sample
          ) =>
            sum +
            Number(
              sample.quantity ||
                0
            ),
          0
        );

      if (
        !Number.isFinite(
          total
        )
      ) {
        return null;
      }

      return Math.max(
        0,
        Math.round(total)
      );
    }
  );
}

/**
 * Read actual asleep intervals from HealthKit.
 *
 * We:
 *
 * 1. Look back 24 hours.
 * 2. Ignore "inBed".
 * 3. Ignore "awake".
 * 4. Keep asleep/REM/core/deep.
 * 5. Merge overlapping intervals.
 */
async function iosFetchSleep() {
  return safe(
    "ios sleep",
    async () => {
      const samples =
        await HealthKit.queryCategorySamples(
          HK_SLEEP_ANALYSIS,
          {
            filter: {
              startDate:
                sleepLookbackStartISO(),

              endDate:
                nowISO(),
            },
          }
        );

      if (
        !samples?.length
      ) {
        return null;
      }

      const intervals =
        samples
          .filter(
            (sample) => {
              const value =
                Number(
                  sample.value
                );

              return HK_ASLEEP_VALUES.has(
                value
              );
            }
          )
          .map(
            (sample) => {
              const start =
                toTimestamp(
                  sample.startDate
                );

              const end =
                toTimestamp(
                  sample.endDate
                );

              return {
                start,
                end,
              };
            }
          )
          .filter(
            (interval) =>
              interval.start !==
                null &&
              interval.end !==
                null &&
              interval.end >
                interval.start
          );

      const merged =
        mergeIntervals(
          intervals
        );

      const milliseconds =
        totalIntervalMilliseconds(
          merged
        );

      if (
        milliseconds <= 0
      ) {
        return null;
      }

      return millisecondsToHours(
        milliseconds
      );
    }
  );
}

async function iosFetchToday() {
  const [
    steps,
    sleepHours,
    caloriesBurned,
  ] = await Promise.all([
    iosFetchSteps(),
    iosFetchSleep(),
    iosFetchCalories(),
  ]);

  return {
    steps,
    sleepHours,
    caloriesBurned,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine whether device health synchronization is possible.
 */
export async function isHealthSyncAvailable() {
  if (
    Platform.OS ===
    "android"
  ) {
    return androidCheckAvailable();
  }

  if (
    Platform.OS ===
    "ios"
  ) {
    return iosCheckAvailable();
  }

  return false;
}

/**
 * Request read permissions.
 */
export async function requestHealthSyncPermissions() {
  try {
    if (
      Platform.OS ===
      "android"
    ) {
      if (
        !HealthConnect ||
        !(await androidCheckAvailable())
      ) {
        return {
          steps: false,
          sleep: false,
          calories: false,
          unavailable: true,
        };
      }

      return await androidRequestPermissions();
    }

    if (
      Platform.OS ===
      "ios"
    ) {
      if (
        !HealthKit ||
        !(await iosCheckAvailable())
      ) {
        return {
          steps: false,
          sleep: false,
          calories: false,
          unavailable: true,
        };
      }

      return await iosRequestPermissions();
    }
  } catch (error) {
    console.warn(
      "[healthSync] permission request failed:",
      error?.message ?? error
    );
  }

  return {
    steps: false,
    sleep: false,
    calories: false,
    unavailable: true,
  };
}

/**
 * Fetch device health data.
 *
 * Steps:
 *   current local calendar day
 *
 * Sleep:
 *   previous 24 hours so overnight sleep isn't lost
 *
 * Calories:
 *   current local calendar day
 *
 * If direct active calories aren't available but steps are,
 * calories are estimated from steps.
 *
 * Returns:
 *
 * {
 *   steps: number | null,
 *   sleepHours: number | null,
 *   caloriesBurned: number | null,
 *   caloriesEstimated: boolean
 * }
 */
export async function fetchTodayFromDevice(
  weightKg
) {
  let result = {
    steps: null,
    sleepHours: null,
    caloriesBurned: null,
  };

  try {
    if (
      Platform.OS ===
        "android" &&
      HealthConnect
    ) {
      /*
       * Ensure the native module is initialized before reading.
       */
      await HealthConnect.initialize();

      result =
        await androidFetchToday();
    } else if (
      Platform.OS ===
        "ios" &&
      HealthKit
    ) {
      result =
        await iosFetchToday();
    }
  } catch (error) {
    console.warn(
      "[healthSync] fetchTodayFromDevice failed:",
      error?.message ?? error
    );
  }

  /*
   * Tier 2 fallback:
   *
   * Device gives steps but not active calories.
   */
  if (
    result.caloriesBurned ==
      null &&
    result.steps !=
      null &&
    Number.isFinite(
      Number(weightKg)
    ) &&
    Number(weightKg) > 0
  ) {
    const estimated =
      estimateCaloriesFromSteps(
        result.steps,
        Number(weightKg)
      );

    if (
      estimated !=
      null
    ) {
      return {
        ...result,
        caloriesBurned:
          estimated,
        caloriesEstimated:
          true,
      };
    }
  }

  return {
    ...result,
    caloriesEstimated:
      false,
  };
}