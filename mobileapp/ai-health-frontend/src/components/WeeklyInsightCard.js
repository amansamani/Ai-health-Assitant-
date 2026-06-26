"use strict";
/**
 * WeeklyInsightCard.js
 * Drop-in card for HomeScreen.js (or WeeklySummaryScreen.js)
 *
 * USAGE in HomeScreen.js:
 *   1. Import: import WeeklyInsightCard from "../components/WeeklyInsightCard";
 *   2. Add anywhere in the ScrollView (recommended: after StatSquares, before ActionCards):
 *        <WeeklyInsightCard />
 *
 * Shows the most recent weekly insight: calorie adjustment, adherence %, weight
 * change, and the AI's plain-English reason — so users understand WHY their
 * plan changed.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ActivityIndicator,
} from "react-native";
import API from "../services/api";

// ── Mini stat chip ────────────────────────────────────────────────────────────
function StatChip({ label, value, color, bg }) {
  return (
    <View style={[chip.wrap, { backgroundColor: bg }]}>
      <Text style={[chip.val, { color }]}>{value}</Text>
      <Text style={chip.lbl}>{label}</Text>
    </View>
  );
}
const chip = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  val:  { fontSize: 16, fontWeight: "900" },
  lbl:  { fontSize: 10, color: "#64748B", fontWeight: "600", marginTop: 2 },
});

// ── Delta badge (calorie change) ──────────────────────────────────────────────
function DeltaBadge({ delta }) {
  if (delta == null || delta === 0) {
    return (
      <View style={[db.wrap, { backgroundColor: "#F0FDF4" }]}>
        <Text style={[db.txt, { color: "#15803D" }]}>On track ✓</Text>
      </View>
    );
  }
  const up    = delta > 0;
  const color = up ? "#D97706" : "#2563EB";
  const bg    = up ? "#FEF3C7" : "#EFF6FF";
  return (
    <View style={[db.wrap, { backgroundColor: bg }]}>
      <Text style={[db.txt, { color }]}>
        {up ? "▲" : "▼"} {Math.abs(delta)} kcal/day
      </Text>
    </View>
  );
}
const db = StyleSheet.create({
  wrap: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start", marginBottom: 8 },
  txt:  { fontSize: 12, fontWeight: "800" },
});

// ── Main card ─────────────────────────────────────────────────────────────────
export default function WeeklyInsightCard({ onPress }) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    async function fetchInsight() {
      try {
        const res = await API.get("/nutrition/weekly-insight");
        if (res.data) setInsight(res.data);
      } catch {
        // No insight yet — card stays hidden
      } finally {
        setLoading(false);
      }
    }
    fetchInsight();
  }, []);

  useEffect(() => {
    if (!loading && insight) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, insight]);

  if (loading || !insight) return null;

  const {
    adherence,
    avgCalories,
    weightChange,
    delta,
    reason,
    adjusted,
    newCalories,
    oldCalories,
    weekEnding,
  } = insight;

  const adherencePct = typeof adherence === "number" ? Math.round(adherence) : null;
  const weekLabel    = weekEnding
    ? new Date(weekEnding).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "This week";

  const adherenceColor =
    adherencePct >= 70 ? "#15803D" :
    adherencePct >= 40 ? "#D97706" : "#DC2626";

  const weightLabel =
    weightChange == null ? "—" :
    weightChange > 0     ? `+${weightChange.toFixed(1)} kg` :
    weightChange < 0     ? `${weightChange.toFixed(1)} kg` :
                           "0.0 kg";

  const weightColor =
    weightChange == null  ? "#64748B" :
    Math.abs(weightChange) < 0.2 ? "#15803D" :
    weightChange > 0      ? "#D97706" : "#2563EB";

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Header */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={s.iconWrap}>
            <Text style={{ fontSize: 18 }}>📊</Text>
          </View>
          <View>
            <Text style={s.title}>Weekly Insight</Text>
            <Text style={s.sub}>Week ending {weekLabel}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setExpanded((p) => !p)} style={s.expandBtn}>
          <Text style={s.expandIcon}>{expanded ? "▲" : "▼"}</Text>
        </TouchableOpacity>
      </View>

      {/* Delta badge */}
      <DeltaBadge delta={delta} />

      {/* Reason */}
      <Text style={s.reason} numberOfLines={expanded ? undefined : 2}>
        {reason || "Your plan is on track. Keep going!"}
      </Text>
      {!expanded && (
        <TouchableOpacity onPress={() => setExpanded(true)}>
          <Text style={s.more}>Show more ›</Text>
        </TouchableOpacity>
      )}

      {/* Stats row */}
      {expanded && (
        <View style={s.statsRow}>
          {adherencePct != null && (
            <StatChip
              label="Adherence"
              value={`${adherencePct}%`}
              color={adherenceColor}
              bg={adherenceColor + "18"}
            />
          )}
          {weightChange != null && (
            <StatChip
              label="Weight Δ"
              value={weightLabel}
              color={weightColor}
              bg={weightColor + "18"}
            />
          )}
          {avgCalories != null && (
            <StatChip
              label="Avg kcal"
              value={Math.round(avgCalories)}
              color="#6366F1"
              bg="#EEF2FF"
            />
          )}
        </View>
      )}

      {/* Calorie change */}
      {expanded && adjusted && oldCalories && newCalories && (
        <View style={s.calChange}>
          <Text style={s.calChangeLbl}>Calorie adjustment</Text>
          <View style={s.calChangeRow}>
            <Text style={s.calOld}>{oldCalories} kcal</Text>
            <Text style={s.arrow}> → </Text>
            <Text style={s.calNew}>{newCalories} kcal</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center",
  },
  title:       { fontSize: 15, fontWeight: "800", color: "#1E1B4B" },
  sub:         { fontSize: 11, color: "#94A3B8", fontWeight: "500", marginTop: 1 },
  expandBtn:   { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center" },
  expandIcon:  { fontSize: 10, color: "#6366F1", fontWeight: "800" },
  reason:      { fontSize: 13, color: "#374151", lineHeight: 20, marginBottom: 4 },
  more:        { fontSize: 12, color: "#6366F1", fontWeight: "700", marginBottom: 8 },
  statsRow:    { flexDirection: "row", gap: 8, marginTop: 12 },
  calChange:   { marginTop: 12, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 12 },
  calChangeLbl:{ fontSize: 11, fontWeight: "700", color: "#94A3B8", marginBottom: 4 },
  calChangeRow:{ flexDirection: "row", alignItems: "center" },
  calOld:      { fontSize: 16, fontWeight: "700", color: "#94A3B8", textDecorationLine: "line-through" },
  arrow:       { fontSize: 16, color: "#6366F1", fontWeight: "800" },
  calNew:      { fontSize: 18, fontWeight: "900", color: "#4F46E5" },
});