// ─────────────────────────────────────────────────────────────────────────────
// Legacy React Navigation adapter
//
// The older screens under src/screens were originally written for
// @react-navigation/native-stack and expect:
//
//   navigation.navigate()
//   navigation.push()
//   navigation.replace()
//   navigation.goBack()
//   navigation.canGoBack()
//   navigation.setParams()
//
// They also expect:
//
//   route.params
//
// The application now uses Expo Router.
//
// This adapter keeps the older screens working while the application
// transitions to Expo Router.
//
// IMPORTANT:
// All route paths below must match the actual files inside:
//
// app/(auth)
// app/(app)
// app/(app)/(tabs)
// app/(app)/nutrition
// app/(app)/social
//
// Expo Router paths are case-sensitive in production/Linux builds.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

/**
 * Mapping between the old React Navigation screen names
 * and the new Expo Router paths.
 */
export const ROUTE_MAP = {
  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  Login: "/(auth)/login",

  Register: "/(auth)/register",

  ForgotPassword: "/(auth)/forgot-password",

  VerifyOtp: "/(auth)/verify-otp",

  ResetPassword: "/(auth)/reset-password",

  HealthProfile: "/(auth)/health-profile",

  // ---------------------------------------------------------------------------
  // Main application
  // ---------------------------------------------------------------------------

  Home: "/(app)/(tabs)/home",

  Workout: "/(app)/(tabs)/workout",

  Camera: "/(app)/(tabs)/camera",

  NutritionDashboard: "/(app)/(tabs)/diet",

  Tracking: "/(app)/(tabs)/tracking",

  // ---------------------------------------------------------------------------
  // Non-tab application screens
  // ---------------------------------------------------------------------------

  Profile: "/(app)/profile",

  Coach: "/(app)/coach",

  AiChat: "/(app)/coach",

  EditHealthProfile: "/(app)/edit-health-profile",

  WeeklySummary: "/(app)/weekly-summary",

  TrackDetail: "/(app)/track-detail",

  WaterTracking: "/(app)/water-tracking",

  WorkoutDetail: "/(app)/workout-detail",

  // ---------------------------------------------------------------------------
  // Nutrition
  // ---------------------------------------------------------------------------

  MealLogger: "/(app)/nutrition/meal-logger",

  LogMeal: "/(app)/nutrition/log-meal",

  LogMealPhoto: "/(app)/nutrition/log-meal-photo",

  Progress: "/(app)/nutrition/progress",

  // ---------------------------------------------------------------------------
  // Social
  // ---------------------------------------------------------------------------

  Friends: "/(app)/social/friends",

  Duels: "/(app)/social/duels",

  CreateDuel: "/(app)/social/create-duel",

  DuelDetail: "/(app)/social/duel-detail",

  Achievements: "/(app)/social/achievements",

  Streaks: "/(app)/social/streaks",
};

/**
 * Encode navigation parameters.
 *
 * Expo Router parameters travel through URL-like route params,
 * so complex JavaScript values need to be serialized.
 *
 * JSON.stringify preserves:
 *
 *   string
 *   number
 *   boolean
 *   array
 *   object
 *
 * It also prevents numeric-looking strings from accidentally
 * becoming numbers during decoding.
 */
function encodeParams(params) {
  if (!params || typeof params !== "object") {
    return undefined;
  }

  const encoded = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    try {
      encoded[key] = JSON.stringify(value);
    } catch (error) {
      console.warn(
        `[legacyAdapter] Could not encode navigation param "${key}"`,
        error,
      );
    }
  }

  return Object.keys(encoded).length > 0 ? encoded : undefined;
}

/**
 * Decode parameters coming from Expo Router.
 *
 * useLocalSearchParams() normally gives strings, but depending
 * on the route/runtime a value can also be an array or another
 * primitive, so we handle both cases safely.
 */
function decodeValue(value) {
  if (Array.isArray(value)) {
    return value.map(decodeValue);
  }

  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function decodeParams(rawParams) {
  const decoded = {};

  for (const [key, value] of Object.entries(rawParams ?? {})) {
    decoded[key] = decodeValue(value);
  }

  return decoded;
}

/**
 * Resolve an old React Navigation screen name to an Expo Router path.
 *
 * If the screen name isn't present in ROUTE_MAP, we keep the
 * supplied value. This allows already-modern screens to pass
 * an explicit Expo Router path.
 */
function resolveRoute(name) {
  if (!name) {
    throw new Error("[legacyAdapter] Navigation route is required.");
  }

  return ROUTE_MAP[name] ?? name;
}

/**
 * Legacy navigation hook.
 *
 * Usage inside an older screen:
 *
 *   const { navigation, route } = useLegacyNav();
 *
 *   navigation.navigate("Home");
 *
 *   navigation.navigate("WorkoutDetail", {
 *     workoutId: "123",
 *   });
 *
 *   route.params.workoutId
 */
export function useLegacyNav() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();

  const navigation = useMemo(
    () => ({
      /**
       * React Navigation equivalent:
       *
       * navigation.navigate("Home")
       */
      navigate: (name, params) => {
        const pathname = resolveRoute(name);

        router.navigate({
          pathname,
          params: encodeParams(params),
        });
      },

      /**
       * React Navigation equivalent:
       *
       * navigation.push("WorkoutDetail", {...})
       */
      push: (name, params) => {
        const pathname = resolveRoute(name);

        router.push({
          pathname,
          params: encodeParams(params),
        });
      },

      /**
       * React Navigation equivalent:
       *
       * navigation.replace("Home")
       */
      replace: (name, params) => {
        const pathname = resolveRoute(name);

        router.replace({
          pathname,
          params: encodeParams(params),
        });
      },

      /**
       * Go to the previous route.
       */
      goBack: () => {
        if (router.canGoBack()) {
          router.back();
        }
      },

      /**
       * Check whether navigation history exists.
       */
      canGoBack: () => router.canGoBack(),

      /**
       * React Navigation equivalent:
       *
       * navigation.setParams({...})
       */
      setParams: (params) => {
        const encodedParams = encodeParams(params);

        if (encodedParams) {
          router.setParams(encodedParams);
        }
      },
    }),
    [router],
  );

  const route = useMemo(
    () => ({
      params: decodeParams(rawParams),
    }),
    [rawParams],
  );

  return {
    navigation,
    route,
  };
}

export default useLegacyNav;