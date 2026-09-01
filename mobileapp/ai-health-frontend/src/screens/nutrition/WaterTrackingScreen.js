"use strict";
/**
 * WaterTrackingScreen.js
 * Routed at app/(app)/water-tracking.tsx
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { showToast } from "../../services/uiFeedback";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Animated, Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { COLORS } from "../../constants/theme";

// ── Quick-add preset amounts ──────────────────────────────────────────────────
const QUICK_OPTIONS = [
  { label: "Sip",    amount: 100, icon: "water-outline" },
  { label: "Glass",  amount: 250, icon: "pint-outline" },
  { label: "Bottle", amount: 500, icon: "flask-outline" },
  { label: "Large",  amount: 750, icon: "water" },
];

const DRINK_LABELS = ["Water", "Lemon water", "Coconut water", "Milk", "Juice", "Herbal tea"];

// ── Wave animation for the fill gauge ────────────────────────────────────────
function WaterGauge({ pct, totalMl, goalMl }) {
  const fillAnim = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: pct / 100,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, { toValue: 1, duration: 2200, useNativeDriver: true })
    ).start();
  }, []);

  const gaugeColor =
    pct >= 100 ? "#22C55E" :
    pct >= 70  ? "#3B82F6" :
    pct >= 40  ? "#60A5FA" :
                 "#93C5FD";

  const HEIGHT = 220;
  const markers = [
    { pct: 75, icon: "happy" },
    { pct: 50, icon: "remove-outline" },
    { pct: 25, icon: "sad-outline" },
  ];

  return (
    <View style={g.wrap}>
      <View style={[g.tank, { height: HEIGHT }]}>
        <Animated.View
          style={[
            g.fill,
            {
              height: fillAnim.interpolate({ inputRange: [0, 1], outputRange: [0, HEIGHT] }),
              backgroundColor: gaugeColor,
            },
          ]}
        />
        <Animated.View
          style={[
            g.wave,
            {
              backgroundColor: gaugeColor + "55",
              transform: [{
                translateX: waveAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 30] }),
              }],
            },
          ]}
        />
      </View>

      <View style={g.overlay}>
        <Text style={g.pctTxt}>{pct}%</Text>
        <Text style={g.mlTxt}>{totalMl} ml</Text>
        <Text style={g.goalTxt}>of {goalMl} ml</Text>
        {pct >= 100 && (
          <View style={g.doneRow}>
            <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
            <Text style={g.done}>Goal reached!</Text>
          </View>
        )}
      </View>

      <View style={g.markers}>
        {markers.map((m) => (
          <Ionicons
            key={m.pct}
            name={m.icon}
            size={16}
            color={pct >= m.pct ? "#fff" : COLORS.textMuted}
            style={[g.marker, { bottom: (m.pct / 100) * HEIGHT - 10 }]}
          />
        ))}
      </View>
    </View>
  );
}

// ── Log timeline entry ────────────────────────────────────────────────────────
function LogEntry({ entry, isLast }) {
  const time = new Date(entry.loggedAt).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit",
  });
  return (
    <View style={le.row}>
      <View style={le.dot} />
      {!isLast && <View style={le.line} />}
      <View style={le.info}>
        <Text style={le.label}>{entry.label || "Water"}</Text>
        <Text style={le.time}>{time}</Text>
      </View>
      <Text style={le.amount}>+{entry.amount} ml</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WaterTrackingScreen() {
  const [log, setLog]           = useState(null);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [undoing, setUndoing]   = useState(false);
  const [customAmt, setCustomAmt] = useState("");
  const [selectedLabel, setSelectedLabel] = useState("Water");
  const [goalModal, setGoalModal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  const fetchLog = useCallback(async () => {
    try {
      const res = await API.get("/nutrition/water");
      setLog(res.data);
    } catch (err) {
      console.warn("Water log fetch failed:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchLog(); }, [fetchLog]));

  const addWater = async (amount) => {
    if (adding) return;
    setAdding(true);
    try {
      const res = await API.post("/nutrition/water", { amount, label: selectedLabel });
      setLog(res.data);
    } catch (err) {
      showToast("Could not log water. Please try again.", { title: "Couldn't log water", type: "error" });
    } finally {
      setAdding(false);
    }
  };

  const handleCustom = () => {
    const ml = parseInt(customAmt, 10);
    if (!ml || ml < 10 || ml > 2000) {
      showToast("Enter a value between 10 and 2000 ml.", { title: "Invalid amount", type: "warning" });
      return;
    }
    addWater(ml);
    setCustomAmt("");
  };

  const handleUndo = async () => {
    if (!log?.logs?.length) return;
    setUndoing(true);
    try {
      const res = await API.delete("/nutrition/water/last");
      setLog(res.data);
    } catch {
      showToast("Undo failed. Please try again.", { title: "Undo failed", type: "error" });
    } finally {
      setUndoing(false);
    }
  };

  const handleSetGoal = async () => {
    const goal = parseInt(goalInput, 10);
    if (!goal || goal < 500 || goal > 6000) {
      showToast("Enter a value between 500 and 6000 ml.", { title: "Invalid goal", type: "warning" });
      return;
    }
    try {
      await API.put("/nutrition/water/goal", { goalMl: goal });
      setGoalModal(false);
      setGoalInput("");
      fetchLog();
    } catch {
      showToast("Could not update goal.", { title: "Couldn't update goal", type: "error" });
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  const totalMl = log?.totalMl ?? 0;
  const goalMl  = log?.goalMl  ?? 2500;
  const pct     = log?.pct     ?? 0;
  const logs    = [...(log?.logs ?? [])].reverse(); // newest first

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.titleRow}>
            <Ionicons name="water" size={20} color="#1E3A5F" style={{ marginRight: 6 }} />
            <Text style={s.title}>Water Intake</Text>
          </View>
          <TouchableOpacity
            style={s.goalBtn}
            onPress={() => setGoalModal(true)}
            accessibilityRole="button"
            accessibilityLabel={`Edit daily goal, currently ${goalMl} milliliters`}
          >
            <Text style={s.goalBtnTxt}>Edit Goal</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.sub}>Daily goal: {goalMl} ml</Text>

        {/* Gauge */}
        <WaterGauge pct={pct} totalMl={totalMl} goalMl={goalMl} />

        {/* Drink label selector */}
        <Text style={s.sectionLabel}>DRINK TYPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.labelRow}>
          {DRINK_LABELS.map((label) => (
            <TouchableOpacity
              key={label}
              style={[s.labelChip, selectedLabel === label && s.labelChipActive]}
              onPress={() => setSelectedLabel(label)}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedLabel === label }}
              accessibilityLabel={label}
            >
              <Text style={[s.labelChipTxt, selectedLabel === label && s.labelChipTxtActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Quick add buttons */}
        <Text style={s.sectionLabel}>QUICK ADD</Text>
        <View style={s.quickGrid}>
          {QUICK_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={s.quickBtn}
              onPress={() => addWater(opt.amount)}
              disabled={adding}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Add ${opt.label}, ${opt.amount} milliliters`}
            >
              <Ionicons name={opt.icon} size={24} color="#3B82F6" style={{ marginBottom: 4 }} />
              <Text style={s.quickAmt}>{opt.amount} ml</Text>
              <Text style={s.quickLbl}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom amount */}
        <Text style={s.sectionLabel}>CUSTOM AMOUNT</Text>
        <View style={s.customRow}>
          <TextInput
            style={s.customInput}
            placeholder="Enter ml (e.g. 330)"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            value={customAmt}
            onChangeText={setCustomAmt}
            accessibilityLabel="Custom amount in milliliters"
          />
          <TouchableOpacity
            style={[s.customBtn, !customAmt && s.customBtnDisabled]}
            onPress={handleCustom}
            disabled={!customAmt || adding}
            accessibilityRole="button"
            accessibilityLabel="Add custom amount"
          >
            <Text style={s.customBtnTxt}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Undo */}
        {logs.length > 0 && (
          <TouchableOpacity
            style={s.undoBtn}
            onPress={handleUndo}
            disabled={undoing}
            accessibilityRole="button"
            accessibilityLabel={`Undo last entry, ${logs[0]?.amount} milliliters`}
          >
            <View style={s.undoRow}>
              {!undoing && <Ionicons name="arrow-undo-outline" size={14} color="#713F12" style={{ marginRight: 6 }} />}
              <Text style={s.undoBtnTxt}>
                {undoing ? "Undoing…" : `Undo last (${logs[0]?.amount} ml)`}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Timeline */}
        {logs.length > 0 && (
          <>
            <Text style={s.sectionLabel}>TODAY'S LOG</Text>
            <View style={s.timeline}>
              {logs.map((entry, i) => (
                <LogEntry key={i} entry={entry} isLast={i === logs.length - 1} />
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Goal edit modal */}
      <Modal visible={goalModal} transparent animationType="fade" onRequestClose={() => setGoalModal(false)}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.title}>Set Daily Goal</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. 2500"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={goalInput}
              onChangeText={setGoalInput}
              accessibilityLabel="Daily goal in milliliters"
            />
            <Text style={m.hint}>500 – 6000 ml recommended</Text>
            <View style={m.row}>
              <TouchableOpacity style={m.cancel} onPress={() => setGoalModal(false)} accessibilityRole="button" accessibilityLabel="Cancel">
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.save} onPress={handleSetGoal} accessibilityRole="button" accessibilityLabel="Save goal">
                <Text style={m.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Gauge styles ──────────────────────────────────────────────────────────────
const g = StyleSheet.create({
  wrap:    { alignItems: "center", marginVertical: 20, position: "relative" },
  tank: {
    width: 140,
    borderRadius: 70,
    backgroundColor: "#EFF6FF",
    borderWidth: 3,
    borderColor: "#BFDBFE",
    overflow: "hidden",
    justifyContent: "flex-end",
    position: "relative",
  },
  fill:    { width: "100%", position: "absolute", bottom: 0, borderRadius: 70 },
  wave:    { width: "130%", height: 18, position: "absolute", bottom: "45%", left: -15, borderRadius: 9 },
  overlay: { position: "absolute", alignItems: "center", justifyContent: "center", height: "100%", width: 140 },
  pctTxt:  { fontSize: 32, fontWeight: "800", color: "#1E3A5F" },
  mlTxt:   { fontSize: 16, fontWeight: "700", color: "#1E3A5F" },
  goalTxt: { fontSize: 12, color: COLORS.textLight, fontWeight: "500" },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  done:    { fontSize: 13, fontWeight: "800", color: "#16A34A" },
  markers: { position: "absolute", right: -28, top: 0, bottom: 0, justifyContent: "flex-end" },
  marker:  { position: "absolute", right: 0 },
});

// ── Log entry styles ──────────────────────────────────────────────────────────
const le = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, position: "relative" },
  dot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: "#3B82F6", marginTop: 4, marginRight: 12 },
  line:   { position: "absolute", left: 4.5, top: 22, bottom: -8, width: 1, backgroundColor: "#BFDBFE" },
  info:   { flex: 1 },
  label:  { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  time:   { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "700", color: "#3B82F6" },
});

// ── Modal styles ──────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  sheet:     { backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, width: "80%" },
  title:     { fontSize: 18, fontWeight: "800", color: COLORS.textDark, marginBottom: 16 },
  input:     { borderWidth: 1.5, borderColor: "#BFDBFE", borderRadius: 12, padding: 12, fontSize: 16, color: COLORS.textDark, marginBottom: 6 },
  hint:      { fontSize: 11, color: COLORS.textMuted, marginBottom: 16 },
  row:       { flexDirection: "row", gap: 10 },
  cancel:    { flex: 1, padding: 12, borderRadius: 12, backgroundColor: COLORS.surfaceMuted, alignItems: "center", minHeight: 44, justifyContent: "center" },
  cancelTxt: { fontWeight: "700", color: COLORS.textLight },
  save:      { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#3B82F6", alignItems: "center", minHeight: 44, justifyContent: "center" },
  saveTxt:   { fontWeight: "700", color: "#fff" },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: "#F0F9FF" },
  container: { flex: 1 },
  content:   { padding: 20 },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },

  header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  titleRow:   { flexDirection: "row", alignItems: "center" },
  title:      { fontSize: 24, fontWeight: "800", color: "#1E3A5F" },
  sub:        { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  goalBtn:    { backgroundColor: "#DBEAFE", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minHeight: 34, justifyContent: "center" },
  goalBtnTxt: { fontSize: 12, fontWeight: "700", color: "#1D4ED8" },

  sectionLabel: { fontSize: 11, fontWeight: "800", color: COLORS.textMuted, letterSpacing: 1, marginBottom: 10, marginTop: 20 },

  labelRow:       { marginBottom: 4, flexDirection: "row" },
  labelChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#E0F2FE", marginRight: 8, minHeight: 36, justifyContent: "center" },
  labelChipActive:{ backgroundColor: "#3B82F6" },
  labelChipTxt:   { fontSize: 13, fontWeight: "600", color: "#0369A1" },
  labelChipTxtActive: { color: "#fff" },

  quickGrid: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  quickBtn:  {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 16, paddingVertical: 16,
    alignItems: "center",
    boxShadow: "0px 2px 6px rgba(23,15,54,0.07)",
  },
  quickAmt:  { fontSize: 13, fontWeight: "800", color: "#1E3A5F" },
  quickLbl:  { fontSize: 10, color: COLORS.textMuted, fontWeight: "600", marginTop: 2 },

  customRow:       { flexDirection: "row", gap: 10 },
  customInput:     { flex: 1, backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.textDark, borderWidth: 1.5, borderColor: "#BFDBFE" },
  customBtn:       { backgroundColor: "#3B82F6", borderRadius: 12, paddingHorizontal: 20, justifyContent: "center", minHeight: 48 },
  customBtnDisabled: { backgroundColor: "#CBD5E1" },
  customBtnTxt:    { color: "#fff", fontWeight: "800", fontSize: 15 },

  undoBtn:    { marginTop: 16, backgroundColor: "#FEF9C3", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#FDE047" },
  undoRow:    { flexDirection: "row", alignItems: "center" },
  undoBtnTxt: { fontSize: 13, fontWeight: "700", color: "#713F12" },

  timeline: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    boxShadow: "0px 2px 6px rgba(23,15,54,0.06)",
  },
});
