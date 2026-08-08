import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, Pressable, Animated, Dimensions, Platform,
} from "react-native";
import { useEffect, useState, useCallback, useRef, useContext } from "react";
import { Ionicons } from "@expo/vector-icons";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";

const { width } = Dimensions.get("window");

// ── Goal config ───────────────────────────────────────────────────────────────
const GOAL_META = {
  bulk: { label: "Bulk", icon: "barbell-outline", color: COLORS.warning, bg: "#FEF3C7" },
  lean: { label: "Lean", icon: "flame-outline", color: COLORS.error, bg: "#FEE2E2" },
  fit:  { label: "Fit",  icon: "flash-outline", color: COLORS.success, bg: "#DCFCE7" },
};

// ── Cross-platform shadow helper ───────────────────────────────────────────────
const shadow = (elevation = 4) =>
  Platform.select({
    ios: {
      shadowColor: COLORS.textDark,
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
const DAY_COLORS = [COLORS.primary, "#F59E0B", "#22C55E", "#EF4444", "#6339B8", "#3B82F6", "#EC4899"];

function WorkoutCard({ item, index, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  const accentColor = DAY_COLORS[(item.day - 1) % DAY_COLORS.length];

  return (
    <FadeSlideIn delay={index * 60}>
      <Pressable
        onPress={onPress} onPressIn={onIn} onPressOut={onOut}
        accessibilityRole="button"
        accessibilityLabel={`Day ${item.day}: ${item.title}, ${item.exercises.length} exercises`}
      >
        <Animated.View style={[styles.card, shadow(4), { transform: [{ scale }] }]}>
          <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

          <View style={styles.cardContent}>
            <View style={styles.cardLeft}>
              <View style={[styles.dayBadge, { backgroundColor: accentColor + "18" }]}>
                <Text style={[styles.dayNum, { color: accentColor }]}>{item.day}</Text>
                <Text style={[styles.dayWord, { color: accentColor }]}>DAY</Text>
              </View>
            </View>

            <View style={styles.cardMid}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={styles.cardMeta}>
                <View style={styles.metaPill}>
                  <Ionicons name="barbell-outline" size={11} color={COLORS.textLight} />
                  <Text style={styles.metaText}>{item.exercises.length} exercises</Text>
                </View>
                {item.duration ? (
                  <View style={[styles.metaPill, { marginLeft: 8 }]}>
                    <Ionicons name="time-outline" size={11} color={COLORS.textLight} />
                    <Text style={styles.metaText}>{item.duration} min</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={[styles.cardArrow, { backgroundColor: accentColor + "15" }]}>
              <Ionicons name="arrow-forward" size={16} color={accentColor} />
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </FadeSlideIn>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WorkoutScreen() {
  const router               = useRouter();
  const { token, userGoal } = useContext(AuthContext);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [mode, setMode]         = useState("bodyweight");

  const goal = GOAL_META[userGoal] ?? GOAL_META.fit;

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
      if (!userGoal) setLoading(false);
      return;
    }
    fetchWorkouts();
  }, [fetchWorkouts, token, userGoal]);

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading workouts…</Text>
      </View>
    );
  }

  // ── No goal set ──
  if (!userGoal) {
    return (
      <View style={styles.center}>
        <Ionicons name="flag-outline" size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
        <Text style={styles.errorText}>No goal set. Please update your profile.</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          onPress={fetchWorkouts}
          style={styles.retryBtn}
          accessibilityRole="button"
          accessibilityLabel="Try loading workouts again"
        >
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  // ── Empty ──
  if (workouts.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="calendar-outline" size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
        <Text style={styles.errorText}>No workouts available.</Text>
      </View>
    );
  }

  const equipmentModeOn = mode !== "bodyweight";

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
                  <Ionicons name={goal.icon} size={14} color={goal.color} style={{ marginRight: 5 }} />
                  <Text style={[styles.goalChipText, { color: goal.color }]}>{goal.label}</Text>
                </View>
              </View>
            </FadeSlideIn>

            {/* Stats bar */}
            <FadeSlideIn delay={80}>
              <LinearGradient colors={["#170F36", "#29195A"]} style={[styles.statsBar, shadow(8)]}>
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
                  <Ionicons
                    name={equipmentModeOn ? "checkmark-circle" : "close-circle-outline"}
                    size={20}
                    color={equipmentModeOn ? "#22C55E" : "#B8AFD6"}
                  />
                  <Text style={styles.statLabel}>Equipment</Text>
                </View>
              </LinearGradient>
            </FadeSlideIn>

            {/* Toggle */}
            <FadeSlideIn delay={140}>
              <View style={styles.toggleWrap}>
                <View style={[styles.toggleRow, shadow(2)]}>
                  {[
                    { key: "bodyweight", label: "No Equipment", icon: "body-outline" },
                    { key: "equipment",  label: "With Equipment", icon: "barbell-outline" },
                  ].map((opt) => (
                    <Pressable
                      key={opt.key}
                      style={[styles.toggleBtn, mode === opt.key && styles.toggleActive]}
                      onPress={() => setMode(opt.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: mode === opt.key }}
                      accessibilityLabel={opt.label}
                    >
                      <Ionicons name={opt.icon} size={15} color={mode === opt.key ? "#fff" : COLORS.textMuted} style={{ marginRight: 6 }} />
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
            onPress={() =>
              router.push({
                pathname: "/(app)/workout-detail",
                params: { workout: JSON.stringify(item) },
              })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  listContent: { padding: 20, paddingTop: 10, paddingBottom: 40 },

  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14, fontWeight: "500" },
  errorText:   { fontSize: 15, color: COLORS.textLight, fontWeight: "600", marginBottom: 16, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 12, minHeight: 44, justifyContent: "center",
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Header
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 18,
  },
  screenTitle: { fontSize: 26, fontWeight: "900", color: COLORS.textDark, letterSpacing: -0.6 },
  screenSub:   { fontSize: 14, color: COLORS.textMuted, marginTop: 3, fontWeight: "500" },
  goalChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  goalChipText: { fontSize: 13, fontWeight: "800" },

  // Stats bar
  statsBar: {
    borderRadius: 20, padding: 18,
    flexDirection: "row", justifyContent: "space-around",
    alignItems: "center", marginBottom: 16,
  },
  statItem:   { alignItems: "center" },
  statNum:    { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  statLabel:  { fontSize: 11, color: "#B8AFD6", marginTop: 3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  statDivider:{ width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.08)" },

  // Toggle
  toggleWrap: { marginBottom: 20 },
  toggleRow: {
    flexDirection: "row", backgroundColor: COLORS.surface,
    borderRadius: 16, padding: 5,
  },
  toggleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11, borderRadius: 12,
  },
  toggleActive:     { backgroundColor: COLORS.primaryDark },
  toggleText:       { fontSize: 14, fontWeight: "700", color: COLORS.textMuted },
  toggleTextActive: { color: "#fff" },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textLight,
    letterSpacing: 1.2, marginBottom: 12, marginLeft: 4,
  },

  // Workout card
  card: {
    backgroundColor: COLORS.surface, borderRadius: 20,
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
  cardTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textDark, marginBottom: 8, letterSpacing: -0.2 },
  cardMeta:  { flexDirection: "row", flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceMuted, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  metaText: { fontSize: 11, color: COLORS.textLight, fontWeight: "600" },

  cardArrow: {
    width: 34, height: 34, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
});
