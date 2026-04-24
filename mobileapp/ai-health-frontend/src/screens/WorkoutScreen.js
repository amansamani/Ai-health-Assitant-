import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, Pressable, Animated, Dimensions, Platform,
} from "react-native";
import { useEffect, useState, useCallback, useRef, useContext } from "react";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// ── Goal config ───────────────────────────────────────────────────────────────
const GOAL_META = {
  bulk:  { label: "Bulk",  emoji: "💪", color: "#F59E0B", bg: "#FEF3C7" },
  lean:  { label: "Lean",  emoji: "🔥", color: "#EF4444", bg: "#FEE2E2" },
  fit:   { label: "Fit",   emoji: "⚡", color: "#22C55E", bg: "#DCFCE7" },
};

// ── Cross-platform shadow helper ───────────────────────────────────────────────
const shadow = (elevation = 4) =>
  Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: 0.12,
      shadowRadius: elevation,
    },
    android: { elevation },
    default: {},
  });

// ── Fade + slide in ───────────────────────────────────────────────────────────
function FadeSlideIn({ delay = 0, children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 450, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 450, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ── Workout Card ──────────────────────────────────────────────────────────────
function WorkoutCard({ item, index, goalColor, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  const dayColors = ["#6366F1", "#F59E0B", "#22C55E", "#EF4444", "#8B5CF6", "#3B82F6", "#EC4899"];
  const accentColor = dayColors[(item.day - 1) % dayColors.length];

  return (
    <FadeSlideIn delay={index * 60}>
      <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut}>
        <Animated.View style={[styles.card, shadow(4), { transform: [{ scale }] }]}>
          {/* Accent bar */}
          <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

          <View style={styles.cardContent}>
            {/* Left: day badge */}
            <View style={styles.cardLeft}>
              <View style={[styles.dayBadge, { backgroundColor: accentColor + "18" }]}>
                <Text style={[styles.dayNum, { color: accentColor }]}>{item.day}</Text>
                <Text style={[styles.dayWord, { color: accentColor }]}>DAY</Text>
              </View>
            </View>

            {/* Middle: title + meta */}
            <View style={styles.cardMid}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={styles.cardMeta}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaText}>🏋️ {item.exercises.length} exercises</Text>
                </View>
                {item.duration ? (
                  <View style={[styles.metaPill, { marginLeft: 8 }]}>
                    <Text style={styles.metaText}>⏱ {item.duration} min</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Right: arrow */}
            <View style={[styles.cardArrow, { backgroundColor: accentColor + "15" }]}>
              <Text style={[styles.cardArrowText, { color: accentColor }]}>→</Text>
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </FadeSlideIn>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WorkoutScreen() {
  const navigation          = useNavigation();
  const { token, userGoal } = useContext(AuthContext);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [mode, setMode]         = useState("bodyweight");

  const goal = GOAL_META[userGoal] ?? GOAL_META.fit;

  // ── FIX: useCallback so the fn reference is stable ─────────────────────────
  const fetchWorkouts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/workouts?goal=${userGoal}&mode=${mode}`);
      setWorkouts(res.data);
    } catch {
      setError("Failed to load workouts");
    } finally {
      setLoading(false);
    }
  }, [userGoal, mode]);

  useEffect(() => {
    if (!token || !userGoal) {
      // ── FIX: don't spin forever if userGoal is missing ────────────────────
      if (!userGoal) setLoading(false);
      return;
    }
    fetchWorkouts();
  }, [fetchWorkouts, token, userGoal]);

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading workouts…</Text>
      </View>
    );
  }

  // ── No goal set ──
  if (!userGoal) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>🎯</Text>
        <Text style={styles.errorText}>No goal set. Please update your profile.</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={fetchWorkouts} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  // ── Empty ──
  if (workouts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>🏖️</Text>
        <Text style={styles.errorText}>No workouts available.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={workouts}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}

        ListHeaderComponent={() => (
          <>
            {/* Title row */}
            <FadeSlideIn delay={0}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.screenTitle}>Workouts</Text>
                  <Text style={styles.screenSub}>Your weekly training plan</Text>
                </View>
                <View style={[styles.goalChip, { backgroundColor: goal.bg, borderColor: goal.color + "40" }]}>
                  <Text style={styles.goalChipEmoji}>{goal.emoji}</Text>
                  <Text style={[styles.goalChipText, { color: goal.color }]}>{goal.label}</Text>
                </View>
              </View>
            </FadeSlideIn>

            {/* Stats bar */}
            <FadeSlideIn delay={80}>
              <LinearGradient colors={["#0F172A", "#1E293B"]} style={[styles.statsBar, shadow(8)]}>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{workouts.length}</Text>
                  <Text style={styles.statLabel}>Days</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>
                    {workouts.reduce((sum, w) => sum + w.exercises.length, 0)}
                  </Text>
                  <Text style={styles.statLabel}>Exercises</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{mode === "bodyweight" ? "0" : "🏋️"}</Text>
                  <Text style={styles.statLabel}>{mode === "bodyweight" ? "Equipment" : "Equipped"}</Text>
                </View>
              </LinearGradient>
            </FadeSlideIn>

            {/* Toggle */}
            <FadeSlideIn delay={140}>
              <View style={styles.toggleWrap}>
                <View style={[styles.toggleRow, shadow(2)]}>
                  {[
                    { key: "bodyweight", label: "No Equipment", icon: "🤸" },
                    { key: "equipment",  label: "With Equipment", icon: "🏋️" },
                  ].map((opt) => (
                    <Pressable
                      key={opt.key}
                      style={[styles.toggleBtn, mode === opt.key && styles.toggleActive]}
                      onPress={() => setMode(opt.key)}
                    >
                      <Text style={styles.toggleIcon}>{opt.icon}</Text>
                      <Text style={[styles.toggleText, mode === opt.key && styles.toggleTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </FadeSlideIn>

            <Text style={styles.sectionLabel}>THIS WEEK'S PLAN</Text>
          </>
        )}

        renderItem={({ item, index }) => (
          <WorkoutCard
            item={item}
            index={index}
            goalColor={goal.color}
            onPress={() => navigation.navigate("WorkoutDetail", { workout: item })}
          />
        )}
      />
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F8FAFC" },
  listContent: { padding: 20, paddingTop: 10, paddingBottom: 40 },

  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  loadingText: { marginTop: 12, color: "#94A3B8", fontSize: 14, fontWeight: "500" },
  errorEmoji:  { fontSize: 40, marginBottom: 12 },
  errorText:   { fontSize: 15, color: "#64748B", fontWeight: "600", marginBottom: 16 },
  retryBtn: {
    backgroundColor: "#6366F1", borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Header
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 18,
  },
  screenTitle: { fontSize: 26, fontWeight: "900", color: "#0F172A", letterSpacing: -0.6 },
  screenSub:   { fontSize: 14, color: "#94A3B8", marginTop: 3, fontWeight: "500" },
  goalChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  goalChipEmoji: { fontSize: 15, marginRight: 5 },
  goalChipText:  { fontSize: 13, fontWeight: "800" },

  // Stats bar
  statsBar: {
    borderRadius: 20, padding: 18,
    flexDirection: "row", justifyContent: "space-around",
    alignItems: "center", marginBottom: 16,
  },
  statItem:   { alignItems: "center" },
  statNum:    { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  statLabel:  { fontSize: 11, color: "#64748B", marginTop: 3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  statDivider:{ width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.08)" },

  // Toggle
  toggleWrap: { marginBottom: 20 },
  toggleRow: {
    flexDirection: "row", backgroundColor: "#fff",
    borderRadius: 16, padding: 5,
  },
  toggleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11, borderRadius: 12,
  },
  toggleActive:     { backgroundColor: "#0F172A" },
  toggleIcon:       { fontSize: 15, marginRight: 6 },
  toggleText:       { fontSize: 14, fontWeight: "700", color: "#94A3B8" },
  toggleTextActive: { color: "#fff" },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: "#CBD5E1",
    letterSpacing: 1.2, marginBottom: 12, marginLeft: 4,
  },

  // Workout card
  card: {
    backgroundColor: "#fff", borderRadius: 20,
    marginBottom: 12, overflow: "hidden",
  },
  cardAccent:  { height: 3, width: "100%" },
  cardContent: {
    flexDirection: "row", alignItems: "center",
    padding: 16,
  },
  cardLeft: { justifyContent: "center", marginRight: 14 },
  dayBadge: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  dayNum:  { fontSize: 20, fontWeight: "900", lineHeight: 22 },
  dayWord: { fontSize: 9,  fontWeight: "800", letterSpacing: 1 },

  cardMid:   { flex: 1, marginRight: 14 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A", marginBottom: 8, letterSpacing: -0.2 },
  cardMeta:  { flexDirection: "row", flexWrap: "wrap" },
  metaPill: {
    backgroundColor: "#F1F5F9", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  metaText: { fontSize: 11, color: "#64748B", fontWeight: "600" },

  cardArrow: {
    width: 34, height: 34, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  cardArrowText: { fontSize: 16, fontWeight: "800" },
});