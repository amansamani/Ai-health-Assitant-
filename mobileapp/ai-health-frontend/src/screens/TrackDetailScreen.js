import { useState, useCallback, useRef, useContext, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Animated, Dimensions, ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { COLORS } from "../constants/theme";
import { useActiveCalorieGoal } from "../hooks/useActiveCalorieGoal";

const { width } = Dimensions.get("window");

// ── Config per type ───────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  steps: {
    label: "Steps", icon: "footsteps-outline", unit: "", goal: 10000,
    color: "#22C55E", gradient: ["#14532D", "#166534", "#15803D"],
    tip: "10,000 steps a day keeps the doctor away",
  },
  caloriesBurned: {
    label: "Active Burn", icon: "flame-outline", unit: "kcal", goal: 400, // fallback goal — overridden with the personalized value below
    color: "#F97316", gradient: ["#7C2D12", "#9A3412", "#EA580C"],
    tip: "Every active minute adds up — consistency beats intensity",
  },
  water: {
    label: "Water", icon: "water-outline", unit: "L", goal: 3,
    color: "#3B82F6", gradient: ["#1E3A5F", "#1E40AF", "#2563EB"],
    tip: "Stay hydrated — aim for 3 litres daily",
  },
  sleep: {
    label: "Sleep", icon: "moon-outline", unit: "h", goal: 8,
    color: COLORS.primary, gradient: ["#170F36", "#49225B", "#6E3482"],
    tip: "8 hours of sleep fuels peak performance",
  },
};

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

// ── Mini bar chart bar ────────────────────────────────────────────────────────
function BarItem({ log, type, config, index, maxVal }) {
  const scaleY = useRef(new Animated.Value(0)).current;
  const val    = log[type] ?? 0;
  const pct    = maxVal > 0 ? val / maxVal : 0;
  const goalPct = Math.min(val / config.goal, 1);

  useEffect(() => {
    Animated.timing(scaleY, {
      toValue: pct, duration: 600, delay: index * 120, useNativeDriver: false,
    }).start();
  }, [pct]);

  const barHeight = scaleY.interpolate({ inputRange: [0, 1], outputRange: [0, 100] });

  return (
    <View style={styles.barItem}>
      <Text style={[styles.barValue, { color: config.color }]}>
        {val}{config.unit ? ` ${config.unit}` : ""}
      </Text>
      <View style={styles.barTrack}>
        <Animated.View style={[
          styles.barFill,
          { height: barHeight, backgroundColor: config.color + (goalPct >= 1 ? "FF" : "99") },
        ]} />
      </View>
      <Text style={styles.barDate}>
        {new Date(log.date).toLocaleDateString("en", { weekday: "short" })}
      </Text>
      {goalPct >= 1 && <Ionicons name="checkmark-circle" size={13} color="#22C55E" style={{ marginTop: 2 }} />}
    </View>
  );
}

// ── Log Card ──────────────────────────────────────────────────────────────────
function LogCard({ log, type, config, index }) {
  const val     = log[type] ?? 0;
  const goalPct = Math.min(val / config.goal, 1);
  const pct     = Math.round(goalPct * 100);
  const dateStr = new Date(log.date).toLocaleDateString("en", {
    weekday: "long", month: "short", day: "numeric",
  });

  return (
    <FadeSlideIn delay={200 + index * 80}>
      <View style={styles.logCard}>
        <View style={[styles.logAccent, { backgroundColor: config.color }]} />
        <View style={styles.logCardInner}>
          <View style={styles.logTop}>
            <Text style={styles.logDate}>{dateStr}</Text>
            {pct >= 100 && (
              <View style={[styles.goalBadge, { backgroundColor: config.color + "20", borderColor: config.color + "40" }]}>
                <Ionicons name="checkmark-circle" size={12} color={config.color} />
                <Text style={[styles.goalBadgeText, { color: config.color }]}>Goal met</Text>
              </View>
            )}
          </View>
          <View style={styles.logBottom}>
            <Text style={[styles.logValue, { color: config.color }]}>
              {val.toLocaleString()}
              <Text style={styles.logUnit}>{config.unit ? ` ${config.unit}` : ""}</Text>
            </Text>
            <View style={styles.logProgress}>
              <View style={styles.logBarBg}>
                <View style={[styles.logBarFill, {
                  width: `${pct}%`, backgroundColor: config.color,
                }]} />
              </View>
              <Text style={[styles.logPct, { color: config.color }]}>{pct}%</Text>
            </View>
          </View>
        </View>
      </View>
    </FadeSlideIn>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TrackDetailScreen() {
  const router  = useRouter();
  const { token } = useContext(AuthContext);
  const { type: rawType } = useLocalSearchParams();
  const type    = Array.isArray(rawType) ? rawType[0] : rawType;
  const { activeCalorieGoal } = useActiveCalorieGoal();
  const baseConfig = TYPE_CONFIG[type] ?? TYPE_CONFIG.steps;
  // caloriesBurned's static goal above is just a fallback for the first
  // render — swap in the personalized one (from the user's own BMR/TDEE
  // numbers) once it's loaded.
  const config = type === "caloriesBurned" ? { ...baseConfig, goal: activeCalorieGoal } : baseConfig;

  const [today, setToday]     = useState(null);
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchToday = useCallback(async () => {
    try {
      const res = await API.get("/track/today");
      setToday(res.data);
    } catch { setToday(null); }
    finally  { setLoading(false); }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await API.get("/track/recent/3");
      // The backend already excludes today's local calendar day. Do not
      // compare UTC date strings here, which can be wrong around midnight
      // for non-UTC timezones.
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch { console.log("Failed to fetch logs"); }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      fetchToday();
      fetchLogs();
    }, [token, fetchToday, fetchLogs])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={config.color} />
        <Text style={styles.loadingText}>Loading data…</Text>
      </View>
    );
  }

  const todayVal = today?.[type] ?? 0;
  const todayPct = Math.round(Math.min(todayVal / config.goal, 1) * 100);
  const allVals  = [todayVal, ...logs.map((l) => l[type] ?? 0)];
  const maxVal   = Math.max(...allVals, 1);

  // Build chart data including today
  const chartLogs = [
    { _id: "today", date: new Date(), [type]: todayVal },
    ...logs,
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── HERO ── */}
        <FadeSlideIn delay={0}>
          <LinearGradient colors={config.gradient} style={styles.hero}>
            <View style={styles.heroDecor} />

            <View style={styles.heroTop}>
              <Pressable
                onPress={() => router.back()}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </Pressable>
              <View style={styles.typeBadge}>
                <Ionicons name={config.icon} size={13} color="#fff" />
                <Text style={styles.typeBadgeText}>{config.label}</Text>
              </View>
            </View>

            <Text style={styles.heroLabel}>TODAY</Text>
            <Text style={styles.heroValue}>
              {todayVal.toLocaleString()}
              <Text style={styles.heroUnit}>{config.unit ? ` ${config.unit}` : ""}</Text>
            </Text>
            <Text style={styles.heroGoal}>Goal: {config.goal.toLocaleString()}{config.unit ? ` ${config.unit}` : ""}</Text>

            <View style={styles.heroBarBg}>
              <View style={[styles.heroBarFill, { width: `${todayPct}%` }]} />
            </View>
            <View style={styles.heroBarLabelRow}>
              {todayPct >= 100 && <Ionicons name="sparkles" size={12} color="rgba(255,255,255,0.8)" style={{ marginRight: 4 }} />}
              <Text style={styles.heroBarLabel}>
                {todayPct >= 100 ? "Goal complete!" : `${todayPct}% of daily goal`}
              </Text>
            </View>

            <View style={styles.tipWrap}>
              <Ionicons name="bulb-outline" size={14} color="rgba(255,255,255,0.75)" style={{ marginRight: 8 }} />
              <Text style={styles.tipText}>{config.tip}</Text>
            </View>
          </LinearGradient>
        </FadeSlideIn>

        {/* ── BAR CHART ── */}
        {chartLogs.length > 0 && (
          <FadeSlideIn delay={120}>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Last {chartLogs.length} Days</Text>
              <View style={styles.chartRow}>
                {chartLogs.map((log, i) => (
                  <BarItem key={log._id} log={log} type={type}
                    config={config} index={i} maxVal={maxVal} />
                ))}
              </View>
            </View>
          </FadeSlideIn>
        )}

        {/* ── LOG CARDS ── */}
        {logs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>PAST DAYS</Text>
            {logs.map((log, i) => (
              <LogCard key={log._id} log={log} type={type} config={config} index={i} />
            ))}
          </>
        )}

        {logs.length === 0 && (
          <FadeSlideIn delay={200}>
            <View style={styles.emptyCard}>
              <Ionicons name={config.icon} size={36} color={config.color} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyText}>No past logs yet.</Text>
              <Text style={styles.emptySub}>Keep tracking — data will appear here!</Text>
            </View>
          </FadeSlideIn>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  scroll:      { paddingBottom: 40 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14, fontWeight: "500" },

  // Hero
  hero: {
    padding: 24, paddingTop: 16, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    marginBottom: 20, overflow: "hidden",
  },
  heroDecor: {
    position: "absolute", width: 240, height: 240, borderRadius: 120,
    borderWidth: 48, borderColor: "rgba(255,255,255,0.04)",
    right: -70, top: -70,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center",
  },
  typeBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
  },
  typeBadgeText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  heroLabel: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6 },
  heroValue: { fontSize: 52, fontWeight: "900", color: "#fff", letterSpacing: -1.5, lineHeight: 58 },
  heroUnit:  { fontSize: 20, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  heroGoal:  { fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4, marginBottom: 18 },

  heroBarBg: {
    height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    marginBottom: 8, overflow: "hidden",
  },
  heroBarFill:      { height: "100%", borderRadius: 3, backgroundColor: "#fff", maxWidth: "100%" },
  heroBarLabelRow:  { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  heroBarLabel:     { fontSize: 12, color: "rgba(255,255,255,0.55)" },

  tipWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12, padding: 12,
  },
  tipText: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "500", lineHeight: 18, flex: 1 },

  // Chart
  chartCard: {
    backgroundColor: COLORS.surface, borderRadius: 22,
    padding: 20, marginHorizontal: 20, marginBottom: 20,
    boxShadow: "0px 2px 12px rgba(23,15,54,0.07)",
  },
  chartTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark, marginBottom: 18, letterSpacing: -0.2 },
  chartRow:   { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", height: 140 },

  barItem:  { alignItems: "center", flex: 1, gap: 6 },
  barValue: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  barTrack: {
    width: 28, height: 100, backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8, justifyContent: "flex-end", overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: 8 },
  barDate: { fontSize: 10, color: COLORS.textMuted, fontWeight: "700" },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textLight,
    letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 20,
  },

  // Log card
  logCard: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    marginHorizontal: 20, marginBottom: 12,
    overflow: "hidden",
    boxShadow: "0px 2px 10px rgba(23,15,54,0.07)",
  },
  logAccent:     { height: 3 },
  logCardInner:  { padding: 16 },
  logTop:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  logDate:       { fontSize: 13, color: COLORS.textLight, fontWeight: "600" },
  goalBadge:     { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  goalBadgeText: { fontSize: 11, fontWeight: "700" },
  logBottom:     { gap: 10 },
  logValue:      { fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
  logUnit:       { fontSize: 14, fontWeight: "600" },
  logProgress:   { flexDirection: "row", alignItems: "center", gap: 10 },
  logBarBg:      { flex: 1, height: 5, backgroundColor: COLORS.surfaceMuted, borderRadius: 3, overflow: "hidden" },
  logBarFill:    { height: "100%", borderRadius: 3, maxWidth: "100%" },
  logPct:        { fontSize: 12, fontWeight: "800", width: 36, textAlign: "right" },

  // Empty
  emptyCard: {
    marginHorizontal: 20, backgroundColor: COLORS.surface,
    borderRadius: 22, padding: 32, alignItems: "center",
    boxShadow: "0px 2px 10px rgba(23,15,54,0.06)",
  },
  emptyText: { fontSize: 16, fontWeight: "800", color: COLORS.textDark, marginBottom: 6 },
  emptySub:  { fontSize: 13, color: COLORS.textMuted, textAlign: "center", fontWeight: "500" },
});
