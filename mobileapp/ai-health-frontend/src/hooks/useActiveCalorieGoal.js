import { useState, useEffect } from "react";
import API from "../services/api";

// Used before the health profile has loaded (or for a user who hasn't
// finished onboarding yet) — matches the clamp range in the backend's
// calculateActiveCalorieGoal, so the UI never flashes an implausible number.
const DEFAULT_ACTIVE_CALORIE_GOAL = 400;
const DEFAULT_WEIGHT_KG = 70;

/**
 * Pulls the personalized Active Burn goal (derived from the user's own
 * BMR/TDEE numbers — see backend/src/modules/health/health.service.js)
 * plus their weight, which the steps→calories Tier 2 fallback needs.
 *
 * Falls back to sane defaults on 404 (profile not created yet) or network
 * error — never blocks rendering.
 */
export function useActiveCalorieGoal() {
  const [activeCalorieGoal, setActiveCalorieGoal] = useState(DEFAULT_ACTIVE_CALORIE_GOAL);
  const [weightKg, setWeightKg] = useState(DEFAULT_WEIGHT_KG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    API.get("/health")
      .then((res) => {
        if (cancelled) return;
        if (res.data?.activeCalorieGoal) setActiveCalorieGoal(res.data.activeCalorieGoal);
        if (res.data?.weight) setWeightKg(res.data.weight);
      })
      .catch(() => {
        // No profile yet, or offline — keep defaults.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { activeCalorieGoal, weightKg, loaded };
}
