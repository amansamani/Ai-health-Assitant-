"use strict";

import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from "react-native";
import API from "../services/api";

const MEAL_META = {
  breakfast: { icon: "☀️", color: "#FF8F00", short: "Breakfast" },
  lunch: { icon: "🥗", color: "#43A047", short: "Lunch" },
  dinner: { icon: "🌙", color: "#1E88E5", short: "Dinner" },
  snack: { icon: "🍎", color: "#8E24AA", short: "Snack" },
};

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];


function moneyRound(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function sumMealMacros(plan, mealsCompleted, loggedByMeal) {
  const quick = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  };

  for (const mealType of MEAL_ORDER) {
    if (!mealsCompleted?.[mealType]) continue;
    // An actual food log for this meal replaces the quick plan credit.
    if ((loggedByMeal?.[mealType] || 0) > 0) continue;

    const combos = Array.isArray(plan?.meals?.[mealType]) ? plan.meals[mealType] : [];
    for (const combo of combos) {
      quick.calories += Number(combo?.calories) || 0;
      quick.protein += Number(combo?.protein) || 0;
      quick.carbs += Number(combo?.carbs) || 0;
      quick.fats += Number(combo?.fats) || 0;
    }
  }

  return Object.fromEntries(Object.entries(quick).map(([key, value]) => [key, moneyRound(value)]));
}

function MealRow({ mealType, combo, completed, onToggle, saving, readOnly }) {
  const meta = MEAL_META[mealType];
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const checkAnim = React.useRef(new Animated.Value(completed ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(checkAnim, {
      toValue: completed ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [completed, checkAnim]);

  const handlePress = () => {
    if (readOnly) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onToggle(mealType, !completed);
  };

  const name = combo?.mealName || meta.short;
  const calories = combo?.calories ?? 0;

  const row = (
    <Animated.View
      style={[
        mr.row,
        completed && { backgroundColor: meta.color + "0D", borderColor: meta.color + "35" },
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {!readOnly ? (
        <Animated.View
          style={[
            mr.check,
            {
              backgroundColor: checkAnim.interpolate({ inputRange: [0, 1], outputRange: ["#fff", meta.color] }),
              borderColor: meta.color,
              transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
            },
          ]}
        >
          {completed && <Text style={mr.tick}>✓</Text>}
        </Animated.View>
      ) : (
        <View style={[mr.statusDot, { backgroundColor: completed ? meta.color : "#E2E8F0" }]}>
          {completed && <Text style={mr.dotTick}>✓</Text>}
        </View>
      )}

      <View style={[mr.iconWrap, { backgroundColor: meta.color + "18" }]}>
        <Text style={{ fontSize: 17 }}>{meta.icon}</Text>
      </View>

      <View style={mr.info}>
        <Text style={[mr.name, completed && { color: meta.color }]}>{name}</Text>
        <Text style={mr.cal}>{calories} kcal planned</Text>
      </View>

      {readOnly ? (
        <Text style={[mr.stateText, { color: completed ? meta.color : "#94A3B8" }]}>
          {completed ? "Completed" : "Pending"}
        </Text>
      ) : saving ? (
        <ActivityIndicator size="small" color={meta.color} />
      ) : (
        <View style={[mr.badge, { backgroundColor: completed ? meta.color : "#F1F5F9" }]}>
          <Text style={[mr.badgeTxt, { color: completed ? "#fff" : "#94A3B8" }]}>
            {completed ? "Done" : "Mark"}
          </Text>
        </View>
      )}
    </Animated.View>
  );

  return readOnly ? row : (
    <TouchableOpacity onPress={handlePress} disabled={saving} activeOpacity={0.82}>
      {row}
    </TouchableOpacity>
  );
}

export default function MealCompletionCard({ plan, readOnly = false }) {
  const [completed, setCompleted] = useState({});
  const [savingMeal, setSavingMeal] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [dailyLog, setDailyLog] = useState(null);
  const [macroLog, setMacroLog] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });

  useEffect(() => {
    let active = true;

    async function fetchLog() {
      try {
        const [progressRes, mealLogRes] = await Promise.all([
          API.get("/nutrition/log"),
          API.get("/nutrition/today-log"),
        ]);

        if (!active) return;

        const progressLog = progressRes.data?.log || null;
        const todayMealData = mealLogRes.data?.data || {};
        const totals = mealLogRes.data?.totals || {};

        setCompleted(progressLog?.mealsCompleted || {});
        setDailyLog({
          caloriesConsumed: Number(progressLog?.caloriesConsumed) || 0,
          targetCalories: Number(progressRes.data?.plan?.targetCalories) || Number(plan?.summary?.targetCalories) || 0,
        });

        const loggedByMeal = {};
        for (const mealType of MEAL_ORDER) {
          const logs = mealType === "snack" ? todayMealData.snacks : todayMealData[mealType];
          loggedByMeal[mealType] = Array.isArray(logs)
            ? logs.reduce((sum, item) => sum + (Number(item?.food?.calories) || 0), 0)
            : 0;
        }

        const quick = sumMealMacros(plan, progressLog?.mealsCompleted || {}, loggedByMeal);
        setMacroLog({
          calories: (Number(totals.calories) || 0) + quick.calories,
          protein: (Number(totals.protein) || 0) + quick.protein,
          carbs: (Number(totals.carbs) || 0) + quick.carbs,
          fats: (Number(totals.fats) || 0) + quick.fats,
        });
      } catch {
        // Start fresh rather than breaking the Home screen.
      } finally {
        if (active) setLoaded(true);
      }
    }

    fetchLog();
    return () => { active = false; };
  }, [plan]);

  const handleToggle = async (mealType, newVal) => {
    const prev = { ...completed };
    const next = { ...completed, [mealType]: newVal };
    setCompleted(next);
    setSavingMeal(mealType);

    try {
      await API.post("/nutrition/log", {
        // Let the backend derive the calendar date from the user's
        // authenticated timezone instead of using UTC here.
        mealsCompleted: next,
      });
      // Refresh after the server resolves the single calorie total.
      const [progressRes, mealLogRes] = await Promise.all([
        API.get("/nutrition/log"),
        API.get("/nutrition/today-log"),
      ]);
      const progressLog = progressRes.data?.log || null;
      const todayMealData = mealLogRes.data?.data || {};
      const totals = mealLogRes.data?.totals || {};
      const loggedByMeal = {};
      for (const mt of MEAL_ORDER) {
        const logs = mt === "snack" ? todayMealData.snacks : todayMealData[mt];
        loggedByMeal[mt] = Array.isArray(logs)
          ? logs.reduce((sum, item) => sum + (Number(item?.food?.calories) || 0), 0)
          : 0;
      }
      const quick = sumMealMacros(plan, progressLog?.mealsCompleted || {}, loggedByMeal);
      setDailyLog({
        caloriesConsumed: Number(progressLog?.caloriesConsumed) || 0,
        targetCalories: Number(progressRes.data?.plan?.targetCalories) || Number(plan?.summary?.targetCalories) || 0,
      });
      setMacroLog({
        calories: (Number(totals.calories) || 0) + quick.calories,
        protein: (Number(totals.protein) || 0) + quick.protein,
        carbs: (Number(totals.carbs) || 0) + quick.carbs,
        fats: (Number(totals.fats) || 0) + quick.fats,
      });
    } catch {
      setCompleted(prev);
    } finally {
      setSavingMeal(null);
    }
  };

  if (!loaded) {
    return (
      <View style={[s.card, { alignItems: "center", paddingVertical: 24 }]}>
        <ActivityIndicator color="#4CAF50" />
      </View>
    );
  }

  const completedCount = Object.values(completed).filter(Boolean).length;
  const targetCalories = Number(dailyLog?.targetCalories || plan?.summary?.targetCalories || plan?.targetCalories || 0);
  const calorieTotal = readOnly
    ? Math.max(Number(dailyLog?.caloriesConsumed || 0), Number(macroLog.calories || 0))
    : Number(dailyLog?.caloriesConsumed || 0);
  const remainingCalories = targetCalories > 0 ? targetCalories - calorieTotal : null;

  const targets = plan?.summary?.macroTargets || plan?.macroTargets || {};
  const macroTargets = {
    protein: Number(targets.proteinG ?? targets.protein ?? 0),
    carbs: Number(targets.carbsG ?? targets.carbs ?? 0),
    fats: Number(targets.fatsG ?? targets.fats ?? 0),
  };

  return (
    <View style={[s.card, readOnly && s.homeCard]}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.heading}>TODAY&apos;S FOOD</Text>
          <Text style={s.subHeading}>{readOnly ? "Quick snapshot of your nutrition" : "Tap a meal to mark it complete"}</Text>
        </View>
        <View style={s.countBadge}>
          <Text style={s.countBig}>{completedCount}</Text>
          <Text style={s.countSmall}>/ 4</Text>
        </View>
      </View>

      {readOnly && (
        <View style={s.summaryBlock}>
          <View style={s.calorieTopRow}>
            <View>
              <Text style={s.summaryEyebrow}>CALORIES EATEN</Text>
              <Text style={s.calorieValue}>{Math.round(calorieTotal)}</Text>
            </View>
            <View style={s.remainingPill}>
              <Text style={s.remainingValue}>
                {remainingCalories == null ? "—" : remainingCalories >= 0 ? `${Math.round(remainingCalories)} left` : `${Math.abs(Math.round(remainingCalories))} over`}
              </Text>
              {targetCalories > 0 && <Text style={s.remainingTarget}>of {Math.round(targetCalories)} kcal</Text>}
            </View>
          </View>

          {targetCalories > 0 && (
            <View style={s.progressBg}>
              <View style={[s.progressFill, { width: `${Math.min(calorieTotal / targetCalories, 1) * 100}%` }]} />
            </View>
          )}

          <View style={s.macroGrid}>
            <MacroMini label="Protein" value={macroLog.protein} target={macroTargets.protein} color="#3B82F6" unit="g" />
            <MacroMini label="Carbs" value={macroLog.carbs} target={macroTargets.carbs} color="#22C55E" unit="g" />
            <MacroMini label="Fat" value={macroLog.fats} target={macroTargets.fats} color="#F59E0B" unit="g" />
          </View>
        </View>
      )}

      {readOnly ? (
        <View style={s.mealGrid}>
          {MEAL_ORDER.map((mt) => {
            const combos = plan?.meals?.[mt] ?? [];
            const meta = MEAL_META[mt];
            return (
              <View key={mt} style={s.mealPill}>
                <View style={[s.mealPillIcon, { backgroundColor: meta.color + "16" }]}>
                  <Text style={{ fontSize: 14 }}>{meta.icon}</Text>
                </View>
                <Text style={[s.mealPillText, completed[mt] && { color: meta.color }]} numberOfLines={1}>
                  {combos[0]?.mealName || meta.short}
                </Text>
                <View style={[s.mealDot, { backgroundColor: completed[mt] ? meta.color : "#E2E8F0" }]}>
                  {completed[mt] && <Text style={s.mealDotText}>✓</Text>}
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        MEAL_ORDER.map((mt) => {
          const combos = plan?.meals?.[mt] ?? [];
          return (
            <MealRow
              key={mt}
              mealType={mt}
              combo={combos[0] ?? null}
              completed={!!completed[mt]}
              onToggle={handleToggle}
              saving={savingMeal === mt}
              readOnly={false}
            />
          );
        })
      )}

      {readOnly && completedCount === 4 && (
        <View style={s.allDone}>
          <Text style={s.allDoneTxt}>All four meals tracked today</Text>
        </View>
      )}
    </View>
  );
}

function MacroMini({ label, value, target, color, unit }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={s.macroItem}>
      <View style={s.macroLabelRow}>
        <Text style={s.macroLabel}>{label}</Text>
        <Text style={[s.macroValue, { color }]}>{Math.round(value)}{unit}</Text>
      </View>
      <View style={s.macroTrack}>
        <View style={[s.macroFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.macroTarget}>{target > 0 ? `of ${Math.round(target)}g` : "today"}</Text>
    </View>
  );
}

const mr = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    borderRadius: 12, marginVertical: 3,
    borderWidth: 1, borderColor: "transparent",
  },
  check: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, justifyContent: "center", alignItems: "center",
  },
  statusDot: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
  },
  dotTick: { color: "#fff", fontSize: 12, fontWeight: "900" },
  tick: { color: "#fff", fontWeight: "800", fontSize: 13 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  cal: { fontSize: 11, color: "#94A3B8", marginTop: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeTxt: { fontSize: 11, fontWeight: "700" },
  stateText: { fontSize: 10.5, fontWeight: "800" },
});

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  homeCard: { paddingBottom: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  heading: { fontSize: 11, fontWeight: "900", color: "#8B91A0", letterSpacing: 1.1 },
  subHeading: { marginTop: 3, fontSize: 10, color: "#A7ACB8", fontWeight: "600" },
  countBadge: { minWidth: 66, backgroundColor: "#F0FDF4", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, alignItems: "center", justifyContent: "center", flexDirection: "row", borderWidth: 1, borderColor: "#DCFCE7" },
  countBig: { fontSize: 18, lineHeight: 20, fontWeight: "900", color: "#15803D" },
  countSmall: { fontSize: 10, fontWeight: "800", color: "#4B7F5A", marginLeft: 2 },
  summaryBlock: { backgroundColor: "#F8FAFC", borderRadius: 15, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: "#EEF2F7" },
  calorieTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryEyebrow: { fontSize: 9, color: "#94A3B8", fontWeight: "900", letterSpacing: 0.8 },
  calorieValue: { marginTop: 2, fontSize: 27, lineHeight: 31, color: "#111827", fontWeight: "900", letterSpacing: -0.6 },
  remainingPill: { alignItems: "flex-end" },
  remainingValue: { fontSize: 13, color: "#15803D", fontWeight: "900" },
  remainingTarget: { marginTop: 2, fontSize: 9.5, color: "#94A3B8", fontWeight: "700" },
  progressBg: { height: 7, backgroundColor: "#E5E7EB", borderRadius: 99, overflow: "hidden", marginTop: 10 },
  progressFill: { height: "100%", backgroundColor: "#84CC16", borderRadius: 99 },
  macroGrid: { flexDirection: "row", gap: 8, marginTop: 13 },
  macroItem: { flex: 1, minWidth: 0 },
  macroLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  macroLabel: { fontSize: 9.5, color: "#64748B", fontWeight: "800" },
  macroValue: { fontSize: 11.5, fontWeight: "900" },
  macroTrack: { height: 5, borderRadius: 99, backgroundColor: "#E2E8F0", overflow: "hidden", marginTop: 5 },
  macroFill: { height: "100%", borderRadius: 99 },
  macroTarget: { marginTop: 3, fontSize: 8.5, color: "#94A3B8", fontWeight: "700" },
  mealGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mealPill: { width: "48%", minHeight: 48, borderRadius: 12, backgroundColor: "#FAFAFA", borderWidth: 1, borderColor: "#F1F5F9", flexDirection: "row", alignItems: "center", paddingHorizontal: 9, gap: 7 },
  mealPillIcon: { width: 29, height: 29, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  mealPillText: { flex: 1, color: "#334155", fontSize: 10.5, fontWeight: "800" },
  mealDot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  mealDotText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  allDone: { backgroundColor: "#F0FDF4", borderRadius: 12, padding: 10, marginTop: 9, alignItems: "center" },
  allDoneTxt: { fontSize: 11, fontWeight: "800", color: "#15803D" },
});
