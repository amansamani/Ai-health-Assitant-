"use strict";
/**
 * WaterTrackingScreen.js
 * Place in: mobileapp/ai-health-frontend/src/screens/nutrition/WaterTrackingScreen.js
 *
 * Add to your navigation stack (e.g. MainNavigator or NutritionStack):
 *   import WaterTrackingScreen from "../screens/nutrition/WaterTrackingScreen";
 *   <Stack.Screen name="WaterTracking" component={WaterTrackingScreen} />
 *
 * Link from NutritionDashboard or HomeScreen action card:
 *   navigation.navigate("WaterTracking")
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Animated, Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";

// ── Quick-add preset amounts ──────────────────────────────────────────────────
const QUICK_OPTIONS = [
  { label: "Sip",    amount: 100, icon: "💧" },
  { label: "Glass",  amount: 250, icon: "🥛" },
  { label: "Bottle", amount: 500, icon: "🍶" },
  { label: "Large",  amount: 750, icon: "🫙" },
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

  return (
    <View style={g.wrap}>
      <View style={[g.tank, { height: HEIGHT }]}>
        {/* Fill level */}
        <Animated.View
          style={[
            g.fill,
            {
              height: fillAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, HEIGHT],
              }),
              backgroundColor: gaugeColor,
            },
          ]}
        />
        {/* Wave overlay */}
        <Animated.View
          style={[
            g.wave,
            {
              backgroundColor: gaugeColor + "55",
              transform: [
                {
                  translateX: waveAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-30, 30],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {/* Centre text overlay */}
      <View style={g.overlay}>
        <Text style={g.pctTxt}>{pct}%</Text>
        <Text style={g.mlTxt}>{totalMl} ml</Text>
        <Text style={g.goalTxt}>of {goalMl} ml</Text>
        {pct >= 100 && <Text style={g.done}>🎉 Goal reached!</Text>}
      </View>

      {/* Emoji level markers */}
      <View style={g.markers}>
        {[{ pct: 75, icon: "😊" }, { pct: 50, icon: "😐" }, { pct: 25, icon: "😟" }].map((m) => (
          <Text
            key={m.pct}
            style={[
              g.marker,
              {
                bottom: (m.pct / 100) * HEIGHT - 10,
                color: pct >= m.pct ? "#fff" : "#94A3B8",
              },
            ]}
          >
            {m.icon}
          </Text>
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
export default function WaterTrackingScreen({ navigation }) {
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
      Alert.alert("Error", "Could not log water. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const handleCustom = () => {
    const ml = parseInt(customAmt, 10);
    if (!ml || ml < 10 || ml > 2000) {
      Alert.alert("Invalid amount", "Enter a value between 10 and 2000 ml.");
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
      Alert.alert("Error", "Undo failed. Please try again.");
    } finally {
      setUndoing(false);
    }
  };

  const handleSetGoal = async () => {
    const goal = parseInt(goalInput, 10);
    if (!goal || goal < 500 || goal > 6000) {
      Alert.alert("Invalid goal", "Enter a value between 500 and 6000 ml.");
      return;
    }
    try {
      await API.put("/nutrition/water/goal", { goalMl: goal });
      setGoalModal(false);
      setGoalInput("");
      fetchLog();
    } catch {
      Alert.alert("Error", "Could not update goal.");
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
          <View>
            <Text style={s.title}>💧 Water Intake</Text>
            <Text style={s.sub}>Daily goal: {goalMl} ml</Text>
          </View>
          <TouchableOpacity style={s.goalBtn} onPress={() => setGoalModal(true)}>
            <Text style={s.goalBtnTxt}>Edit Goal</Text>
          </TouchableOpacity>
        </View>

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
            >
              <Text style={s.quickIcon}>{opt.icon}</Text>
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
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={customAmt}
            onChangeText={setCustomAmt}
          />
          <TouchableOpacity
            style={[s.customBtn, !customAmt && s.customBtnDisabled]}
            onPress={handleCustom}
            disabled={!customAmt || adding}
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
          >
            <Text style={s.undoBtnTxt}>
              {undoing ? "Undoing…" : `↩ Undo last (${logs[0]?.amount} ml)`}
            </Text>
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
      <Modal visible={goalModal} transparent animationType="fade">
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.title}>Set Daily Goal</Text>
            <TextInput
              style={m.input}
              placeholder="e.g. 2500"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={goalInput}
              onChangeText={setGoalInput}
            />
            <Text style={m.hint}>500 – 6000 ml recommended</Text>
            <View style={m.row}>
              <TouchableOpacity style={m.cancel} onPress={() => setGoalModal(false)}>
                <Text style={m.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.save} onPress={handleSetGoal}>
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
  pctTxt:  { fontSize: 32, fontWeight: "900", color: "#1E3A5F" },
  mlTxt:   { fontSize: 16, fontWeight: "700", color: "#1E3A5F" },
  goalTxt: { fontSize: 12, color: "#64748B", fontWeight: "500" },
  done:    { fontSize: 14, fontWeight: "800", color: "#16A34A", marginTop: 4 },
  markers: { position: "absolute", right: -28, top: 0, bottom: 0, justifyContent: "flex-end" },
  marker:  { position: "absolute", right: 0, fontSize: 16 },
});

// ── Log entry styles ──────────────────────────────────────────────────────────
const le = StyleSheet.create({
  row:    { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, position: "relative" },
  dot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: "#3B82F6", marginTop: 4, marginRight: 12 },
  line:   { position: "absolute", left: 4.5, top: 22, bottom: -8, width: 1, backgroundColor: "#BFDBFE" },
  info:   { flex: 1 },
  label:  { fontSize: 14, fontWeight: "600", color: "#1E293B" },
  time:   { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "700", color: "#3B82F6" },
});

// ── Modal styles ──────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  sheet:     { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "80%" },
  title:     { fontSize: 18, fontWeight: "800", color: "#1a1a1a", marginBottom: 16 },
  input:     { borderWidth: 1.5, borderColor: "#BFDBFE", borderRadius: 12, padding: 12, fontSize: 16, color: "#1a1a1a", marginBottom: 6 },
  hint:      { fontSize: 11, color: "#94A3B8", marginBottom: 16 },
  row:       { flexDirection: "row", gap: 10 },
  cancel:    { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  cancelTxt: { fontWeight: "700", color: "#64748B" },
  save:      { flex: 1, padding: 12, borderRadius: 12, backgroundColor: "#3B82F6", alignItems: "center" },
  saveTxt:   { fontWeight: "700", color: "#fff" },
});

// ── Main styles ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: "#F0F9FF" },
  container: { flex: 1 },
  content:   { padding: 20 },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },

  header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  title:      { fontSize: 24, fontWeight: "900", color: "#1E3A5F" },
  sub:        { fontSize: 13, color: "#64748B", marginTop: 2 },
  goalBtn:    { backgroundColor: "#DBEAFE", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  goalBtnTxt: { fontSize: 12, fontWeight: "700", color: "#1D4ED8" },

  sectionLabel: { fontSize: 11, fontWeight: "800", color: "#94A3B8", letterSpacing: 1, marginBottom: 10, marginTop: 20 },

  labelRow:       { marginBottom: 4, flexDirection: "row" },
  labelChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#E0F2FE", marginRight: 8 },
  labelChipActive:{ backgroundColor: "#3B82F6" },
  labelChipTxt:   { fontSize: 13, fontWeight: "600", color: "#0369A1" },
  labelChipTxtActive: { color: "#fff" },

  quickGrid: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  quickBtn:  {
    flex: 1, backgroundColor: "#fff", borderRadius: 16, paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  quickIcon: { fontSize: 26, marginBottom: 4 },
  quickAmt:  { fontSize: 13, fontWeight: "800", color: "#1E3A5F" },
  quickLbl:  { fontSize: 10, color: "#94A3B8", fontWeight: "600", marginTop: 2 },

  customRow:       { flexDirection: "row", gap: 10 },
  customInput:     { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, fontSize: 15, color: "#1a1a1a", borderWidth: 1.5, borderColor: "#BFDBFE" },
  customBtn:       { backgroundColor: "#3B82F6", borderRadius: 12, paddingHorizontal: 20, justifyContent: "center" },
  customBtnDisabled: { backgroundColor: "#CBD5E1" },
  customBtnTxt:    { color: "#fff", fontWeight: "800", fontSize: 15 },

  undoBtn:    { marginTop: 16, backgroundColor: "#FEF9C3", borderRadius: 12, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#FDE047" },
  undoBtnTxt: { fontSize: 13, fontWeight: "700", color: "#713F12" },

  timeline:   { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
});