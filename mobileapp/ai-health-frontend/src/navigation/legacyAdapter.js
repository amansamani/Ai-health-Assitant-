// ─────────────────────────────────────────────────────────────────────────
// Legacy React-Navigation adapter
//
// The screens under src/screens were originally written for
// @react-navigation/native-stack and expect two props: `navigation`
// (navigate/goBack/replace/setParams) and `route` (params).
//
// The app now uses Expo Router (real, URL-addressable file routes) instead
// of a single hand-rolled stack. Rather than rewrite every screen's internal
// calls in one pass, this hook bridges the old prop shape onto the new
// router so existing screen components keep working untouched. Screens
// being redesigned should migrate off this and call useRouter() /
// useLocalSearchParams() directly instead.
// ─────────────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";

// Old React Navigation screen name -> new Expo Router path.
export const ROUTE_MAP = {
  // auth stack
  Login: "/(auth)/login",
  ForgotPassword: "/(auth)/forgot-password",
  VerifyOtp: "/(auth)/verify-otp",
  ResetPassword: "/(auth)/reset-password",
  Register: "/(auth)/register",
  HealthProfile: "/(auth)/health-profile",

  // main stack
  Home: "/(app)/home",
  Profile: "/(app)/profile",
  Workout: "/(app)/workout",
  Tracking: "/(app)/tracking",
  WeeklySummary: "/(app)/weekly-summary",
  WaterTracking: "/(app)/water-tracking",
  TrackDetail: "/(app)/track-detail",
  WorkoutDetail: "/(app)/workout-detail",
  NutritionDashboard: "/(app)/diet",
  MealLogger: "/(app)/nutrition/meal-logger",
  LogMeal: "/(app)/nutrition/log-meal",
  LogMealPhoto: "/(app)/nutrition/log-meal-photo",
  Camera: "/(app)/camera",
  Progress: "/(app)/nutrition/progress",
  EditHealthProfile: "/(app)/edit-health-profile",
  AiChat: "/(app)/coach",
};

// Expo Router params are always strings (they live in a URL). Every value
// gets JSON-encoded on the way out and decoded on the way in so plain
// strings, numbers, and whole objects (e.g. a full workout record) all
// round-trip to their original type. This also avoids the classic bug where
// a numeric-looking string ("123456" as a password) would otherwise get
// misread as a number.
function encodeParams(params) {
  if (!params) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    out[key] = JSON.stringify(value);
  }
  return out;
}

function decodeParams(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    if (typeof value !== "string") {
      out[key] = value;
      continue;
    }
    try {
      out[key] = JSON.parse(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function useLegacyNav() {
  const router = useRouter();
  const rawParams = useLocalSearchParams();

  const navigation = useMemo(
    () => ({
      navigate: (name, params) =>
        router.navigate({ pathname: ROUTE_MAP[name] ?? name, params: encodeParams(params) }),
      push: (name, params) =>
        router.push({ pathname: ROUTE_MAP[name] ?? name, params: encodeParams(params) }),
      replace: (name, params) =>
        router.replace({ pathname: ROUTE_MAP[name] ?? name, params: encodeParams(params) }),
      goBack: () => router.back(),
      canGoBack: () => router.canGoBack(),
      setParams: (params) => router.setParams(encodeParams(params) ?? {}),
    }),
    [router],
  );

  const route = useMemo(() => ({ params: decodeParams(rawParams) }), [rawParams]);

  return { navigation, route };
}
