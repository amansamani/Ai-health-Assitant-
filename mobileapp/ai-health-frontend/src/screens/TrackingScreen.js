import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView,
  Platform, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";

const { width } = Dimensions.get("window");

// ── Fade slide in ─────────────────────────────────────────────────────────────
function FadeSlideIn({ delay = 0, children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 460, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 460, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ── Track Input Card ──────────────────────────────────────────────────────────
function TrackInputCard({ icon, label, unit, value, onChangeText, color, goal, placeholder }) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim  = useRef(new Animated.Value(1)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1], outputRange: ["#E2E8F0", color],
  });

  const numVal  = parseFloat(value) || 0;
  const progress = Math.min(numVal / goal, 1);
  const pct      = Math.round(progress * 100);

  return (
    <Animated.View style={[styles.trackCard, { borderColor }]}>
      {/* Color accent top bar */}
      <View style={[styles.trackAccent, { backgroundColor: color }]} />

      <View style={styles.trackCardInner}>
        {/* Left: icon + label */}
        <View style={[styles.trackIconWrap, { backgroundColor: color + "18" }]}>
          <Text style={styles.trackIcon}>{icon}</Text>
        </View>

        {/* Middle: label + input */}
        <View style={styles.trackMid}>
          <Text style={styles.trackLabel}>{label}</Text>
          <TextInput
            style={[styles.trackInput, focused && { color }]}
            placeholder={placeholder}
            placeholderTextColor="#CBD5E1"
            keyboardType="numeric"
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={onBlur}
          />
        </View>

        {/* Right: unit + progress */}
        <View style={styles.trackRight}>
          <Text style={[styles.trackUnit, { color }]}>{unit}</Text>
          <Text style={styles.trackPct}>{pct}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.trackBarBg}>
        <Animated.View style={[
          styles.trackBarFill,
          { width: `${pct}%`, backgroundColor: color },
        ]} />
      </View>
    </Animated.View>
  );
}

// ── Log Stat Row ──────────────────────────────────────────────────────────────
function LogStat({ icon, label, value, color }) {
  return (
    <View style={styles.logStat}>
      <View style={[styles.logStatIcon, { backgroundColor: color + "18" }]}>
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View style={styles.logStatText}>
        <Text style={styles.logStatLabel}>{label}</Text>
        <Text style={[styles.logStatValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
const STEP_GOAL  = 10000;
const WATER_GOAL = 3;
const SLEEP_GOAL = 8;

export default function TrackingScreen({ navigation, route }) {
  const { token } = useContext(AuthContext);
  const [steps, setSteps]       = useState("");
  const [water, setWater]       = useState("");
  const [sleep, setSleep]       = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [todayLog, setTodayLog] = useState(null);

  const btnScale = useRef(new Animated.Value(1)).current;
  const onBtnIn  = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const onBtnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      if (route.params?.updatedToday) {
        setLoading(false);
        navigation.setParams({ updatedToday: undefined });
      } else {
        setLoading(true);
        fetchToday();
      }
    }, [route.params, token])
  );

  const fetchToday = async () => {
    try {
      const res = await API.get("/track/today");
      if (res.data) {
        setTodayLog(res.data);
        setSteps(res.data.steps?.toString() || "");
        setWater(res.data.water?.toString() || "");
        setSleep(res.data.sleep?.toString() || "");
      }
    } catch {
      console.log("No tracking data for today");
    } finally {
      setLoading(false);
    }
  };

  const saveToday = async () => {
    try {
      setSaving(true);
      await API.post("/track/today", {
        steps: Number(steps),
        water: Number(water),
        sleep: Number(sleep),
      });
      setSaved(true);
      setTodayLog({ steps: Number(steps), water: Number(water), sleep: Number(sleep) });
      setTimeout(() => setSaved(false), 2500);
      navigation.navigate("Home", {
        updatedToday: { steps: Number(steps), water: Number(water), sleep: Number(sleep) },
      });
    } catch (err) {
      alert("Failed to save data");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading today's data…</Text>
      </View>
    );
  }

  // Overall progress
  const totalPct = Math.round(
    ((Math.min(parseFloat(steps) || 0, STEP_GOAL) / STEP_GOAL +
      Math.min(parseFloat(water) || 0, WATER_GOAL) / WATER_GOAL +
      Math.min(parseFloat(sleep) || 0, SLEEP_GOAL) / SLEEP_GOAL) / 3) * 100
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── HEADER ── */}
          <FadeSlideIn delay={0}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Daily Tracking</Text>
                <Text style={styles.subtitle}>Log your activity for today</Text>
              </View>
              <View style={styles.overallBadge}>
                <Text style={styles.overallNum}>{totalPct}%</Text>
                <Text style={styles.overallLabel}>Overall</Text>
              </View>
            </View>
          </FadeSlideIn>

          {/* ── HERO PROGRESS ── */}
          <FadeSlideIn delay={80}>
            <LinearGradient colors={["#0F172A", "#1E293B"]} style={styles.heroCard}>
              <View style={styles.heroDecor} />
              <Text style={styles.heroBadge}>📅  TODAY</Text>
              <Text style={styles.heroTitle}>
                {totalPct === 100 ? "🎉 All goals complete!" : `${totalPct}% of daily goals done`}
              </Text>
              <View style={styles.heroBarBg}>
                <View style={[styles.heroBarFill, { width: `${totalPct}%` }]} />
              </View>
              <View style={styles.heroStats}>
                <Text style={styles.heroStat}>👟 {steps || "0"} steps</Text>
                <Text style={styles.heroStat}>💧 {water || "0"} L</Text>
                <Text style={styles.heroStat}>🌙 {sleep || "0"}h</Text>
              </View>
            </LinearGradient>
          </FadeSlideIn>

          {/* ── INPUT CARDS ── */}
          <FadeSlideIn delay={160}>
            <Text style={styles.sectionLabel}>UPDATE TODAY'S DATA</Text>
            <TrackInputCard
              icon="👟" label="Steps" unit="steps"
              placeholder="e.g. 8000" value={steps}
              onChangeText={setSteps} color="#22C55E" goal={STEP_GOAL}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={220}>
            <TrackInputCard
              icon="💧" label="Water" unit="litres"
              placeholder="e.g. 2.5" value={water}
              onChangeText={setWater} color="#3B82F6" goal={WATER_GOAL}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={280}>
            <TrackInputCard
              icon="🌙" label="Sleep" unit="hours"
              placeholder="e.g. 7.5" value={sleep}
              onChangeText={setSleep} color="#A855F7" goal={SLEEP_GOAL}
            />
          </FadeSlideIn>

          {/* ── SAVE BUTTON ── */}
          <FadeSlideIn delay={340}>
            <Pressable onPress={saveToday} onPressIn={onBtnIn}
              onPressOut={onBtnOut} disabled={saving}>
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <LinearGradient
                  colors={saved
                    ? ["#22C55E", "#16A34A"]
                    : saving
                    ? ["#94A3B8", "#94A3B8"]
                    : ["#6366F1", "#8B5CF6", "#A855F7"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.saveBtn}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>
                        {saved ? "✓  Saved!" : "💾  Save Today's Data"}
                      </Text>
                  }
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </FadeSlideIn>

          {/* ── TODAY'S LOG ── */}
          {todayLog && (
            <FadeSlideIn delay={400}>
              <View style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logTitle}>Today's Log</Text>
                  <View style={styles.logDot} />
                </View>
                <View style={styles.logRow}>
                  <LogStat icon="👟" label="Steps"   value={`${todayLog.steps?.toLocaleString() ?? 0}`}      color="#22C55E" />
                  <LogStat icon="💧" label="Water"   value={`${todayLog.water ?? 0} L`}    color="#3B82F6" />
                  <LogStat icon="🌙" label="Sleep"   value={`${todayLog.sleep ?? 0} hrs`}  color="#A855F7" />
                </View>
              </View>
            </FadeSlideIn>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F8FAFC" },
  scroll:      { padding: 20, paddingTop: 10 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  loadingText: { marginTop: 12, color: "#94A3B8", fontSize: 14, fontWeight: "500" },

  // Header
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  title:    { fontSize: 26, fontWeight: "900", color: "#0F172A", letterSpacing: -0.6 },
  subtitle: { fontSize: 14, color: "#94A3B8", marginTop: 3, fontWeight: "500" },
  overallBadge: {
    backgroundColor: "#fff", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10,
    alignItems: "center",
    boxShadow: "0px 2px 10px rgba(15,23,42,0.08)",
  },
  overallNum:   { fontSize: 20, fontWeight: "900", color: "#6366F1", letterSpacing: -0.5 },
  overallLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "700", textTransform: "uppercase" },

  // Hero
  heroCard: {
    borderRadius: 22, padding: 20,
    marginBottom: 24, overflow: "hidden",
    boxShadow: "0px 6px 20px rgba(15,23,42,0.25)",
  },
  heroDecor: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: "rgba(255,255,255,0.03)",
    right: -50, top: -50,
  },
  heroBadge: { color: "#FACC15", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginBottom: 8 },
  heroTitle: { fontSize: 17, fontWeight: "800", color: "#fff", marginBottom: 14, letterSpacing: -0.3 },
  heroBarBg: {
    height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 14, overflow: "hidden",
  },
  heroBarFill: { height: "100%", borderRadius: 3, backgroundColor: "#6366F1", maxWidth: "100%" },
  heroStats:   { flexDirection: "row", gap: 16 },
  heroStat:    { fontSize: 13, color: "#94A3B8", fontWeight: "600" },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: "#CBD5E1",
    letterSpacing: 1.2, marginBottom: 10,
  },

  // Track input card
  trackCard: {
    backgroundColor: "#fff", borderRadius: 20,
    marginBottom: 12, overflow: "hidden",
    borderWidth: 1.5,
    boxShadow: "0px 2px 10px rgba(15,23,42,0.07)",
  },
  trackAccent:    { height: 3 },
  trackCardInner: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  trackIconWrap:  {
    width: 46, height: 46, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  trackIcon:  { fontSize: 22 },
  trackMid:   { flex: 1 },
  trackLabel: { fontSize: 11, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  trackInput: {
    fontSize: 20, fontWeight: "900", color: "#0F172A",
    padding: 0, letterSpacing: -0.5,
  },
  trackRight: { alignItems: "flex-end" },
  trackUnit:  { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  trackPct:   { fontSize: 11, color: "#94A3B8", fontWeight: "600" },
  trackBarBg: {
    height: 4, backgroundColor: "#F1F5F9",
    marginHorizontal: 14, marginBottom: 12, borderRadius: 2, overflow: "hidden",
  },
  trackBarFill: { height: "100%", borderRadius: 2, maxWidth: "100%" },

  // Save button
  saveBtn: {
    borderRadius: 18, paddingVertical: 17,
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
    boxShadow: "0px 6px 18px rgba(99,102,241,0.35)",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },

  // Log card
  logCard: {
    backgroundColor: "#fff", borderRadius: 22,
    padding: 18,
    boxShadow: "0px 2px 12px rgba(15,23,42,0.07)",
  },
  logHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 16,
  },
  logTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  logDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  logRow:   { flexDirection: "row", justifyContent: "space-between" },
  logStat:  { flex: 1, alignItems: "center", gap: 8 },
  logStatIcon: {
    width: 44, height: 44, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
    marginBottom: 6,
  },
  logStatText:  { alignItems: "center" },
  logStatLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  logStatValue: { fontSize: 16, fontWeight: "900", marginTop: 2, letterSpacing: -0.3 },
});