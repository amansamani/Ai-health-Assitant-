import {
  View, Text, StyleSheet, ActivityIndicator,
  ScrollView, Animated,
} from "react-native";
import { useEffect, useState, useRef, useCallback, useContext } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";
import { COLORS } from "../constants/theme";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useActiveCalorieGoal } from "../hooks/useActiveCalorieGoal";

// ── Safe number helper — handles undefined/null/NaN from API ─────────────────
const safeNum = (val, decimals = 0) => {
  const n = parseFloat(val);
  if (isNaN(n)) return 0;
  return decimals > 0 ? parseFloat(n.toFixed(decimals)) : Math.round(n);
};

// ── Animated stat bar ─────────────────────────────────────────────────────────
function StatBar({ value, max, color }) {
  const anim = useRef(new Animated.Value(0)).current;
  const pct  = max > 0 ? Math.min(value / max, 1) : 0;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct, duration: 900, delay: 300, useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={bar.track}>
      <Animated.View style={[bar.fill, {
        width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
        backgroundColor: color,
      }]} />
    </View>
  );
}

// ── Animated number counter ───────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = "" }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value, duration: 1000, delay: 400, useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={num.text}>{display}{suffix}</Text>;
}

// ── Days ring ─────────────────────────────────────────────────────────────────
function DaysRing({ days, total = 7 }) {
  const SIZE   = 100;
  const BORDER = 10;
  const pct    = total > 0 ? days / total : 0;
  const color  = pct >= 0.7 ? "#22C55E" : pct >= 0.4 ? "#F59E0B" : "#EF4444";

  return (
    <View style={{ width: SIZE, height: SIZE, justifyContent: "center", alignItems: "center" }}>
      <View style={{ position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: BORDER, borderColor: "rgba(255,255,255,0.15)" }} />
      {pct > 0 && (
        <View style={{
          position: "absolute", width: SIZE, height: SIZE,
          borderRadius: SIZE / 2, borderWidth: BORDER,
          borderColor: "transparent",
          borderTopColor: color,
          borderRightColor: pct >= 0.5 ? color : "transparent",
          borderBottomColor: pct >= 0.75 ? color : "transparent",
          borderLeftColor: pct >= 1 ? color : "transparent",
          transform: [{ rotate: "-90deg" }],
        }} />
      )}
      <Text style={{ fontSize: 22, fontWeight: "800", color }}>{days}</Text>
      <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "600" }}>/ 7 days</Text>
    </View>
  );
}

// ── Small icon + label pair (replaces old "emoji + string" scores) ───────────
function ScoreTag({ icon, color, text }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[s.statScore, { color }]}>{text}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WeeklySummaryScreen() {
  const { token }  = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const { activeCalorieGoal } = useActiveCalorieGoal();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const fetchSummary = useCallback(async () => {
    try {
      const res = await API.get("/track/weekly");
      setSummary(res.data);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    } catch (err) {
      console.log("Weekly summary error");
    } finally {
      setLoading(false);
    }
  }, [fadeAnim, slideAnim]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      fetchSummary();
    }, [token, fetchSummary])
  );

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={s.loadingText}>Loading your week...</Text>
      </View>
    );
  }

  if (!summary || summary.message) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Ionicons name="stats-chart-outline" size={48} color={COLORS.textMuted} />
          <Text style={s.emptyTitle}>No Data Yet</Text>
          <Text style={s.emptySub}>Start tracking your daily activity{"\n"}to see your weekly summary here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Safe values ──────────────────────────────────────────────────────────────
  const avgSteps = safeNum(summary.avgSteps);
  const avgWater = safeNum(summary.avgWater, 1);
  const avgSleep = safeNum(summary.avgSleep, 1);
  const avgCalories = safeNum(summary.avgCalories);
  const daysTracked = safeNum(summary.daysTracked);

  const bestDayStr = summary.bestDay
    ? new Date(summary.bestDay).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })
    : "—";

  const stepsScore = avgSteps >= 10000
    ? { icon: "trophy", color: "#22C55E", text: "Goal Met!" }
    : avgSteps >= 7000
    ? { icon: "trending-up", color: "#F59E0B", text: "Almost!" }
    : { icon: "trending-up-outline", color: COLORS.textMuted, text: "Keep Going" };

  const caloriesScore = avgCalories >= activeCalorieGoal
    ? { icon: "trophy", color: "#22C55E", text: "Goal Met!" }
    : avgCalories >= activeCalorieGoal * 0.6
    ? { icon: "flame", color: "#F97316", text: "Good!" }
    : { icon: "trending-up-outline", color: COLORS.textMuted, text: "Move More" };

  const sleepScore = avgSleep >= 8
    ? { icon: "trophy", color: "#22C55E", text: "Goal Met!" }
    : avgSleep >= 6
    ? { icon: "moon", color: COLORS.primary, text: "Decent" }
    : { icon: "trending-up-outline", color: COLORS.textMuted, text: "Sleep More" };

  // Overall score — steps, calories burned, sleep, and days-tracked
  // consistency. Water is tracked (shown below) but doesn't factor into
  // the score since it's manual-only for most people.
  const stepsP    = Math.min(avgSteps / 10000, 1);
  const caloriesP = Math.min(avgCalories / activeCalorieGoal, 1);
  const sleepP    = Math.min(avgSleep / 8, 1);
  const daysP     = daysTracked / 7;
  const score  = Math.round(((stepsP + caloriesP + sleepP + daysP) / 4) * 100);
  const grade  = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  const gradeColor = score >= 80 ? "#22C55E" : score >= 60 ? "#F59E0B" : score >= 40 ? "#F97316" : "#EF4444";
  const scoreMsg = score >= 80 ? "Outstanding week!" : score >= 60 ? "Solid effort!" : score >= 40 ? "Good start!" : "Let's pick it up!";
  const scoreIcon = score >= 80 ? "trophy" : score >= 60 ? "flame" : score >= 40 ? "trending-up-outline" : "flag-outline";

  const consistency = daysTracked >= 5
    ? { bg: "#dcfce7", color: "#15803d", icon: "flame", text: "Excellent week!" }
    : daysTracked >= 3
    ? { bg: "#fef9c3", color: "#a16207", icon: "thumbs-up-outline", text: "Good effort" }
    : { bg: "#fee2e2", color: "#dc2626", icon: "trending-up-outline", text: "Room to grow" };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={s.header}>
            <Text style={s.headerTitle}>Weekly Summary</Text>
            <Text style={s.headerSub}>Last 7 days overview</Text>
          </View>
        </Animated.View>

        {/* Hero card */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <LinearGradient colors={["#170F36", "#49225B"]} style={s.heroCard}>
            <View style={s.heroLeft}>
              <Text style={s.heroLabel}>CONSISTENCY</Text>
              <Text style={s.heroTitle}>Days Tracked</Text>
              <View style={s.heroBestRow}>
                <Ionicons name="medal-outline" size={12} color="#B8AFD6" />
                <Text style={s.heroBestDay}>Best: {bestDayStr}</Text>
              </View>
              <View style={[s.consistencyBadge, { backgroundColor: consistency.bg }]}>
                <Ionicons name={consistency.icon} size={12} color={consistency.color} />
                <Text style={[s.consistencyText, { color: consistency.color }]}>{consistency.text}</Text>
              </View>
            </View>
            <DaysRing days={daysTracked} />
          </LinearGradient>
        </Animated.View>

        <Text style={s.sectionTitle}>DAILY AVERAGES</Text>

        {/* Steps card */}
        <Animated.View style={[s.statCard, { opacity: fadeAnim }]}>
          <View style={s.statHeader}>
            <View style={[s.statIconBox, { backgroundColor: "#dcfce7" }]}>
              <Ionicons name="footsteps-outline" size={22} color="#22C55E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statLabel}>Average Steps</Text>
              <ScoreTag {...stepsScore} />
            </View>
            <View style={s.statNumBox}>
              <AnimatedNumber value={avgSteps} />
              <Text style={s.statUnit}>steps/day</Text>
            </View>
          </View>
          <StatBar value={avgSteps} max={10000} color="#22C55E" />
          <View style={s.statFooter}>
            <Text style={s.statGoalText}>Goal: 10,000 steps</Text>
            <Text style={[s.statPct, { color: "#22C55E" }]}>{Math.round((avgSteps / 10000) * 100)}%</Text>
          </View>
        </Animated.View>

        {/* Active Burn card */}
        <Animated.View style={[s.statCard, { opacity: fadeAnim }]}>
          <View style={s.statHeader}>
            <View style={[s.statIconBox, { backgroundColor: "#ffedd5" }]}>
              <Ionicons name="flame-outline" size={22} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statLabel}>Average Active Burn</Text>
              <ScoreTag {...caloriesScore} />
            </View>
            <View style={s.statNumBox}>
              <AnimatedNumber value={avgCalories} />
              <Text style={s.statUnit}>kcal/day</Text>
            </View>
          </View>
          <StatBar value={avgCalories} max={activeCalorieGoal} color="#F97316" />
          <View style={s.statFooter}>
            <Text style={s.statGoalText}>Goal: {activeCalorieGoal} kcal · personalized</Text>
            <Text style={[s.statPct, { color: "#F97316" }]}>{Math.round((avgCalories / activeCalorieGoal) * 100)}%</Text>
          </View>
        </Animated.View>

        {/* Sleep card */}
        <Animated.View style={[s.statCard, { opacity: fadeAnim }]}>
          <View style={s.statHeader}>
            <View style={[s.statIconBox, { backgroundColor: COLORS.surfaceMuted }]}>
              <Ionicons name="moon-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statLabel}>Average Sleep</Text>
              <ScoreTag {...sleepScore} />
            </View>
            <View style={s.statNumBox}>
              <AnimatedNumber value={avgSleep} suffix="h" />
              <Text style={s.statUnit}>per night</Text>
            </View>
          </View>
          <StatBar value={avgSleep} max={8} color={COLORS.primary} />
          <View style={s.statFooter}>
            <Text style={s.statGoalText}>Goal: 8 hrs</Text>
            <Text style={[s.statPct, { color: COLORS.primary }]}>{Math.round((avgSleep / 8) * 100)}%</Text>
          </View>
        </Animated.View>

        {/* Water — secondary, compact (manual-only, not part of the score) */}
        <Animated.View style={[s.waterStrip, { opacity: fadeAnim }]}>
          <Ionicons name="water-outline" size={16} color="#3B82F6" />
          <Text style={s.waterStripText}>
            Avg water logged: <Text style={s.waterStripValue}>{avgWater} L/day</Text>
          </Text>
        </Animated.View>

        {/* Overall score */}
        <View style={s.scoreCard}>
          <Text style={s.scoreLabel}>OVERALL WEEK SCORE</Text>
          <View style={s.scoreInner}>
            <View style={[s.gradeCircle, { borderColor: gradeColor }]}>
              <Text style={[s.gradeText, { color: gradeColor }]}>{grade}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[s.scoreNum, { color: gradeColor }]}>
                {score}<Text style={s.scoreOf}>/100</Text>
              </Text>
              <View style={s.scoreMsgRow}>
                <Ionicons name={scoreIcon} size={13} color={COLORS.textLight} />
                <Text style={s.scoreMsg}>{scoreMsg}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const bar = StyleSheet.create({
  track: { height: 8, backgroundColor: COLORS.surfaceMuted, borderRadius: 4, overflow: "hidden", marginTop: 12 },
  fill:  { height: "100%", borderRadius: 4 },
});

const num = StyleSheet.create({
  text: { fontSize: 22, fontWeight: "800", color: COLORS.textDark },
});

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  scroll:      { padding: 16 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 6 },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14 },
  emptyTitle:  { fontSize: 22, fontWeight: "800", color: COLORS.textDark, marginTop: 6 },
  emptySub:    { fontSize: 14, color: COLORS.textMuted, textAlign: "center", marginTop: 4, lineHeight: 22 },

  header:      { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: "800", color: COLORS.textDark },
  headerSub:   { fontSize: 13, color: COLORS.textMuted, marginTop: 3 },

  heroCard: {
    borderRadius: 20, padding: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 24,
    boxShadow: "0px 6px 20px rgba(23,15,54,0.3)",
  },
  heroLeft:          { flex: 1, marginRight: 16 },
  heroLabel:         { fontSize: 10, fontWeight: "700", color: "#B8AFD6", letterSpacing: 1.5, marginBottom: 4 },
  heroTitle:         { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4 },
  heroBestRow:       { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 12 },
  heroBestDay:       { fontSize: 12, color: "#B8AFD6" },
  consistencyBadge:  { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  consistencyText:   { fontSize: 12, fontWeight: "700" },

  sectionTitle: { fontSize: 11, fontWeight: "700", color: COLORS.textLight, letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" },

  statCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 12,
    boxShadow: "0px 2px 8px rgba(23,15,54,0.06)",
  },
  statHeader:  { flexDirection: "row", alignItems: "center", gap: 12 },
  statIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  statLabel:   { fontSize: 14, fontWeight: "700", color: COLORS.textDark },
  statScore:   { fontSize: 12, marginTop: 2, fontWeight: "600" },
  statNumBox:  { alignItems: "flex-end" },
  statUnit:    { fontSize: 10, color: COLORS.textMuted, fontWeight: "500" },
  statFooter:  { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  statGoalText:{ fontSize: 11, color: COLORS.textMuted },
  statPct:     { fontSize: 12, fontWeight: "700" },

  waterStrip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#3B82F60F", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  waterStripText:  { fontSize: 12.5, color: COLORS.textMuted, fontWeight: "500" },
  waterStripValue: { color: "#3B82F6", fontWeight: "800" },

  scoreCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginTop: 4,
    boxShadow: "0px 2px 8px rgba(23,15,54,0.06)",
  },
  scoreLabel:   { fontSize: 11, fontWeight: "700", color: COLORS.textLight, letterSpacing: 1.5, marginBottom: 16, textTransform: "uppercase" },
  scoreInner:   { flexDirection: "row", alignItems: "center" },
  gradeCircle:  { width: 70, height: 70, borderRadius: 35, borderWidth: 3, justifyContent: "center", alignItems: "center" },
  gradeText:    { fontSize: 28, fontWeight: "900" },
  scoreNum:     { fontSize: 28, fontWeight: "800" },
  scoreOf:      { fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
  scoreMsgRow:  { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  scoreMsg:     { fontSize: 14, color: COLORS.textLight, fontWeight: "500" },
});
