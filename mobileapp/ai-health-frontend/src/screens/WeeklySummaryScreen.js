import {
  View, Text, StyleSheet, ActivityIndicator,
  ScrollView, Animated,
} from "react-native";
import { useEffect, useState, useRef } from "react";
import API from "../services/api";
import { COLORS, SHADOW } from "../constants/theme";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";

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
      <View style={{ position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: BORDER, borderColor: "#ffffff30" }} />
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
      <Text style={{ fontSize: 10, color: "#aaa", fontWeight: "600" }}>/ 7 days</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WeeklySummaryScreen() {
  const { token }  = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (!token) return;
    fetchSummary();
  }, [token]);

  const fetchSummary = async () => {
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
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={s.loadingText}>Loading your week...</Text>
      </View>
    );
  }

  if (!summary || summary.message) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={{ fontSize: 52 }}>📊</Text>
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
  const daysTracked = safeNum(summary.daysTracked);

  const bestDayStr = summary.bestDay
    ? new Date(summary.bestDay).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })
    : "—";

  const stepsScore = avgSteps >= 10000 ? "🏆 Goal Met!" : avgSteps >= 7000 ? "💪 Almost!" : "📈 Keep Going";
  const waterScore = avgWater >= 3 ? "🏆 Goal Met!" : avgWater >= 2 ? "💧 Good!" : "📈 Drink More";
  const sleepScore = avgSleep >= 8 ? "🏆 Goal Met!" : avgSleep >= 6 ? "😴 Decent" : "📈 Sleep More";

  // Overall score
  const stepsP = Math.min(avgSteps / 10000, 1);
  const waterP = Math.min(avgWater / 3, 1);
  const sleepP = Math.min(avgSleep / 8, 1);
  const daysP  = daysTracked / 7;
  const score  = Math.round(((stepsP + waterP + sleepP + daysP) / 4) * 100);
  const grade  = score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D";
  const gradeColor = score >= 80 ? "#22C55E" : score >= 60 ? "#F59E0B" : score >= 40 ? "#F97316" : "#EF4444";
  const scoreMsg = score >= 80 ? "Outstanding week! 🏆" : score >= 60 ? "Solid effort! 💪" : score >= 40 ? "Good start! 📈" : "Let's pick it up! 🔥";

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
        <Animated.View style={[s.heroCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={s.heroLeft}>
            <Text style={s.heroLabel}>CONSISTENCY</Text>
            <Text style={s.heroTitle}>Days Tracked</Text>
            <Text style={s.heroBestDay}>🏅 Best: {bestDayStr}</Text>
            <View style={[s.consistencyBadge, {
              backgroundColor: daysTracked >= 5 ? "#dcfce7" : daysTracked >= 3 ? "#fef9c3" : "#fee2e2"
            }]}>
              <Text style={[s.consistencyText, {
                color: daysTracked >= 5 ? "#15803d" : daysTracked >= 3 ? "#a16207" : "#dc2626"
              }]}>
                {daysTracked >= 5 ? "🔥 Excellent week!" : daysTracked >= 3 ? "👍 Good effort" : "💪 Room to grow"}
              </Text>
            </View>
          </View>
          <DaysRing days={daysTracked} />
        </Animated.View>

        <Text style={s.sectionTitle}>DAILY AVERAGES</Text>

        {/* Steps card */}
        <Animated.View style={[s.statCard, { opacity: fadeAnim }]}>
          <View style={s.statHeader}>
            <View style={[s.statIconBox, { backgroundColor: "#dcfce7" }]}>
              <Text style={s.statIcon}>🚶</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statLabel}>Average Steps</Text>
              <Text style={s.statScore}>{stepsScore}</Text>
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

        {/* Water card */}
        <Animated.View style={[s.statCard, { opacity: fadeAnim }]}>
          <View style={s.statHeader}>
            <View style={[s.statIconBox, { backgroundColor: "#dbeafe" }]}>
              <Text style={s.statIcon}>💧</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statLabel}>Average Water</Text>
              <Text style={s.statScore}>{waterScore}</Text>
            </View>
            <View style={s.statNumBox}>
              <AnimatedNumber value={avgWater} suffix="L" />
              <Text style={s.statUnit}>per day</Text>
            </View>
          </View>
          <StatBar value={avgWater} max={3} color="#3B82F6" />
          <View style={s.statFooter}>
            <Text style={s.statGoalText}>Goal: 3 L</Text>
            <Text style={[s.statPct, { color: "#3B82F6" }]}>{Math.round((avgWater / 3) * 100)}%</Text>
          </View>
        </Animated.View>

        {/* Sleep card */}
        <Animated.View style={[s.statCard, { opacity: fadeAnim }]}>
          <View style={s.statHeader}>
            <View style={[s.statIconBox, { backgroundColor: "#f3e8ff" }]}>
              <Text style={s.statIcon}>😴</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statLabel}>Average Sleep</Text>
              <Text style={s.statScore}>{sleepScore}</Text>
            </View>
            <View style={s.statNumBox}>
              <AnimatedNumber value={avgSleep} suffix="h" />
              <Text style={s.statUnit}>per night</Text>
            </View>
          </View>
          <StatBar value={avgSleep} max={8} color="#A855F7" />
          <View style={s.statFooter}>
            <Text style={s.statGoalText}>Goal: 8 hrs</Text>
            <Text style={[s.statPct, { color: "#A855F7" }]}>{Math.round((avgSleep / 8) * 100)}%</Text>
          </View>
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
              <Text style={s.scoreMsg}>{scoreMsg}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const bar = StyleSheet.create({
  track: { height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, overflow: "hidden", marginTop: 12 },
  fill:  { height: "100%", borderRadius: 4 },
});

const num = StyleSheet.create({
  text: { fontSize: 22, fontWeight: "800", color: "#1a1a1a" },
});

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f9fafb" },
  scroll:      { padding: 16 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingText: { marginTop: 12, color: "#888", fontSize: 14 },
  emptyTitle:  { fontSize: 22, fontWeight: "800", color: "#1a1a1a", marginTop: 12 },
  emptySub:    { fontSize: 14, color: "#aaa", textAlign: "center", marginTop: 8, lineHeight: 22 },

  header:      { marginBottom: 20 },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#1a1a1a" },
  headerSub:   { fontSize: 13, color: "#888", marginTop: 3 },

  heroCard: {
    backgroundColor: "#1a1a2e", borderRadius: 20, padding: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 24, elevation: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12,
  },
  heroLeft:          { flex: 1, marginRight: 16 },
  heroLabel:         { fontSize: 10, fontWeight: "700", color: "#888", letterSpacing: 1.5, marginBottom: 4 },
  heroTitle:         { fontSize: 22, fontWeight: "800", color: "#fff", marginBottom: 4 },
  heroBestDay:       { fontSize: 12, color: "#aaa", marginBottom: 12 },
  consistencyBadge:  { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  consistencyText:   { fontSize: 12, fontWeight: "700" },

  sectionTitle: { fontSize: 11, fontWeight: "700", color: "#aaa", letterSpacing: 1.5, marginBottom: 12, textTransform: "uppercase" },

  statCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  statHeader:  { flexDirection: "row", alignItems: "center", gap: 12 },
  statIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  statIcon:    { fontSize: 22 },
  statLabel:   { fontSize: 14, fontWeight: "700", color: "#1a1a1a" },
  statScore:   { fontSize: 12, color: "#888", marginTop: 2 },
  statNumBox:  { alignItems: "flex-end" },
  statUnit:    { fontSize: 10, color: "#aaa", fontWeight: "500" },
  statFooter:  { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  statGoalText:{ fontSize: 11, color: "#aaa" },
  statPct:     { fontSize: 12, fontWeight: "700" },

  scoreCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 20, marginTop: 4,
    elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8,
  },
  scoreLabel:  { fontSize: 11, fontWeight: "700", color: "#aaa", letterSpacing: 1.5, marginBottom: 16, textTransform: "uppercase" },
  scoreInner:  { flexDirection: "row", alignItems: "center" },
  gradeCircle: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, justifyContent: "center", alignItems: "center" },
  gradeText:   { fontSize: 28, fontWeight: "900" },
  scoreNum:    { fontSize: 28, fontWeight: "800" },
  scoreOf:     { fontSize: 14, color: "#aaa", fontWeight: "500" },
  scoreMsg:    { fontSize: 14, color: "#555", marginTop: 4, fontWeight: "500" },
});