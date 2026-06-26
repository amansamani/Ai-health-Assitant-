"use strict";
/**
 * MealCompletionCard.js
 * Drop-in component for NutritionDashboardScreen.js
 *
 * USAGE in NutritionDashboardScreen:
 *   1. Import: import MealCompletionCard from "../../components/MealCompletionCard";
 *   2. Add below the MacroBar card in the ScrollView:
 *        <MealCompletionCard plan={plan} />
 *
 * This replaces the old TrackingScreen boolean toggles with a card that:
 *   - Shows each meal name from the actual plan (not just "Breakfast")
 *   - Shows planned calories per meal
 *   - Tapping a meal toggles completion and auto-sends calories to the backend
 *   - Shows a running "eaten today" total vs target
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ActivityIndicator,
} from "react-native";
import API from "../services/api";

const MEAL_META = {
  breakfast: { icon: "🌅", color: "#FF8F00" },
  lunch:     { icon: "☀️",  color: "#43A047" },
  dinner:    { icon: "🌙",  color: "#1E88E5" },
  snack:     { icon: "🍎",  color: "#8E24AA" },
};
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ── Individual meal row ───────────────────────────────────────────────────────
function MealRow({ mealType, combo, completed, onToggle, saving }) {
  const meta    = MEAL_META[mealType];
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const checkAnim = useRef(new Animated.Value(completed ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(checkAnim, {
      toValue: completed ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 8,
    }).start();
  }, [completed]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onToggle(mealType, !completed);
  };

  const name     = combo?.mealName || mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const calories = combo?.calories ?? 0;

  return (
    <TouchableOpacity onPress={handlePress} disabled={saving} activeOpacity={0.8}>
      <Animated.View style={[
        mr.row,
        completed && { backgroundColor: meta.color + "10", borderColor: meta.color + "40" },
        { transform: [{ scale: scaleAnim }] },
      ]}>
        {/* Check circle */}
        <Animated.View style={[
          mr.check,
          {
            backgroundColor: checkAnim.interpolate({
              inputRange: [0, 1], outputRange: ["#fff", meta.color],
            }),
            borderColor: checkAnim.interpolate({
              inputRange: [0, 1], outputRange: [meta.color, meta.color],
            }),
            transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
          },
        ]}>
          {completed && <Text style={mr.tick}>✓</Text>}
        </Animated.View>

        {/* Icon */}
        <View style={[mr.iconWrap, { backgroundColor: meta.color + "18" }]}>
          <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
        </View>

        {/* Info */}
        <View style={mr.info}>
          <Text style={[mr.name, completed && { color: meta.color }]}>{name}</Text>
          <Text style={mr.cal}>{calories} kcal planned</Text>
        </View>

        {/* Status badge */}
        {saving ? (
          <ActivityIndicator size="small" color={meta.color} />
        ) : (
          <View style={[mr.badge, { backgroundColor: completed ? meta.color : "#F1F5F9" }]}>
            <Text style={[mr.badgeTxt, { color: completed ? "#fff" : "#94A3B8" }]}>
              {completed ? "Done" : "Mark"}
            </Text>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────
export default function MealCompletionCard({ plan }) {
  const [completed, setCompleted]   = useState({});
  const [savingMeal, setSavingMeal] = useState(null);
  const [eatenCals, setEatenCals]   = useState(0);
  const [loaded, setLoaded]         = useState(false);

  const targetCals = plan?.summary?.targetCalories ?? 0;

  // Fetch today's log on mount
  useEffect(() => {
    async function fetchLog() {
      try {
        const res = await API.get("/nutrition/log");
        const mc  = res.data?.log?.mealsCompleted ?? {};
        setCompleted(mc);
        setEatenCals(res.data?.log?.caloriesConsumed ?? 0);
      } catch {
        // Start fresh
      } finally {
        setLoaded(true);
      }
    }
    fetchLog();
  }, []);

  const handleToggle = async (mealType, newVal) => {
    const prev = { ...completed };
    const next = { ...completed, [mealType]: newVal };
    setCompleted(next);
    setSavingMeal(mealType);

    try {
      const res = await API.post("/nutrition/log", {
        date: todayStr(),
        mealsCompleted: next,
        // No caloriesConsumed — let backend compute from plan
      });
      // Update eaten total from response
      setEatenCals(res.data?.caloriesConsumed ?? 0);
    } catch {
      // Rollback on error
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
  const pct = targetCals > 0 ? Math.min(Math.round((eatenCals / targetCals) * 100), 100) : 0;

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Text style={s.heading}>✅ MEAL COMPLETION</Text>
        <Text style={s.countBadge}>{completedCount}/4 done</Text>
      </View>

      {/* Progress bar */}
      <View style={s.barWrap}>
        <View style={s.barTrack}>
          <View style={[s.barFill, {
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? "#22C55E" : pct >= 60 ? "#4CAF50" : "#FF8F00",
          }]} />
        </View>
        <Text style={s.barLabel}>
          {eatenCals} / {targetCals} kcal eaten ({pct}%)
        </Text>
      </View>

      {/* Meal rows */}
      {MEAL_ORDER.map((mt) => {
        const combos = plan?.meals?.[mt] ?? [];
        return (
          <MealRow
            key={mt}
            mealType={mt}
            combo={combos[0] ?? null}
            completed={!!completed[mt]}
            onToggle={handleToggle}
            saving={savingMeal === mt}
          />
        );
      })}

      {completedCount === 4 && (
        <View style={s.allDone}>
          <Text style={s.allDoneTxt}>🎉 All meals complete! Great job today.</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  tick:    { color: "#fff", fontWeight: "900", fontSize: 13 },
  iconWrap:{ width: 38, height: 38, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  info:    { flex: 1 },
  name:    { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  cal:     { fontSize: 11, color: "#94A3B8", marginTop: 1 },
  badge:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  badgeTxt:{ fontSize: 11, fontWeight: "700" },
});

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  headerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  heading:     { fontSize: 11, fontWeight: "800", color: "#aaa", letterSpacing: 1 },
  countBadge:  { backgroundColor: "#F0FDF4", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  barWrap:     { marginBottom: 12 },
  barTrack:    { height: 8, backgroundColor: "#F0F0F0", borderRadius: 4, overflow: "hidden", marginBottom: 5 },
  barFill:     { height: "100%", borderRadius: 4 },
  barLabel:    { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  allDone:     { backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, marginTop: 8, alignItems: "center" },
  allDoneTxt:  { fontSize: 13, fontWeight: "700", color: "#15803D" },
});