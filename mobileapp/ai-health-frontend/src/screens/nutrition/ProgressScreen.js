import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  RefreshControl,
} from "react-native";
import { useState, useCallback, useRef, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { getWeeklyInsight } from "../../services/nutritionService";

// ─── Fade/slide wrapper (matches HomeScreen's entrance animation) ─────────────
function FadeSlideIn({ delay = 0, children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 480, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 480, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Status meta (color + label) per insight state ────────────────────────────
function getStatusMeta(insight) {
  if (!insight) {
    return { label: "NO DATA YET", color: "#94A3B8", bg: "#F1F5F9" };
  }
  if (!insight.adjusted) {
    if (insight.reason?.toLowerCase().includes("low adherence")) {
      return { label: "NEEDS CONSISTENCY", color: "#FF8F00", bg: "#FFF3E0" };
    }
    if (insight.adherence !== undefined) {
      return { label: "ON TRACK", color: "#4CAF50", bg: "#E8F5E9" };
    }
    return { label: "NOT ENOUGH DATA", color: "#94A3B8", bg: "#F1F5F9" };
  }
  return insight.delta > 0
    ? { label: "CALORIES INCREASED", color: "#1E88E5", bg: "#E3F2FD" }
    : { label: "CALORIES REDUCED", color: "#6366F1", bg: "#EEF2FF" };
}

// ─── Weekly Insight Card ───────────────────────────────────────────────────────
function WeeklyInsightCard({ insight }) {
  const meta = getStatusMeta(insight);
  const deltaText =
    !insight || !insight.adjusted
      ? null
      : insight.delta > 0 ? `+${insight.delta} kcal` : `${insight.delta} kcal`;

  return (
    <View style={wi.card}>
      <LinearGradient
        colors={["#F0F4FF", "#FAFBFF"]}
        style={wi.headerStrip}
      >
        <View>
          <Text style={wi.headerTitle}>This Week's Adjustment</Text>
          <Text style={wi.headerSub}>
            {insight?.weekEnding
              ? new Date(insight.weekEnding).toLocaleDateString(undefined, {
                  month: "short", day: "numeric",
                })
              : "Awaiting first weekly review"}
          </Text>
        </View>
        <View style={[wi.badge, { backgroundColor: meta.bg }]}>
          <Text style={[wi.badgeTxt, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </LinearGradient>

      {!insight ? (
        <View style={wi.emptyBody}>
          <Text style={wi.emptyTxt}>
            Log meals + weight for a few days and your first weekly review
            will show up here — including why your calorie target changed.
          </Text>
        </View>
      ) : (
        <View style={wi.body}>
          {deltaText && (
            <Text style={[wi.deltaText, { color: meta.color }]}>{deltaText}</Text>
          )}
          <Text style={wi.reasonText}>{insight.reason}</Text>

          {insight.adherence !== undefined && (
            <View style={wi.statsRow}>
              <Stat label="Adherence"    value={`${insight.adherence}%`} />
              <Stat label="Avg Calories" value={insight.avgCalories ?? "—"} />
              <Stat
                label="Weight Δ"
                value={
                  insight.weightChange === undefined
                    ? "—"
                    : `${insight.weightChange > 0 ? "+" : ""}${insight.weightChange} kg`
                }
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={wi.statBox}>
      <Text style={wi.statValue}>{value}</Text>
      <Text style={wi.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────
export default function ProgressScreen() {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getWeeklyInsight();
      setInsight(data);
      setError(null);
    } catch (err) {
      setError("Couldn't load your weekly insight. Pull to retry.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.screenTitle}>Progress</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#6366F1"]} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 40 }} />
        ) : error ? (
          <Text style={styles.errorTxt}>{error}</Text>
        ) : (
          <FadeSlideIn>
            <WeeklyInsightCard insight={insight} />
          </FadeSlideIn>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#fff" },
  screenTitle:   { fontSize: 22, fontWeight: "800", color: "#1a1a1a", paddingHorizontal: 20, paddingTop: 12 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  errorTxt:      { fontSize: 14, color: "#e53935", textAlign: "center", marginTop: 40 },
});

const wi = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E7FF",
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E7FF",
  },
  headerTitle: { fontSize: 15, fontWeight: "800", color: "#3730A3" },
  headerSub:   { fontSize: 12, color: "#6366F1", fontWeight: "500", marginTop: 2 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },

  body:      { padding: 16 },
  deltaText: { fontSize: 28, fontWeight: "900", marginBottom: 4 },
  reasonText:{ fontSize: 14, color: "#1E1B4B", fontWeight: "600", lineHeight: 20 },

  statsRow: { flexDirection: "row", marginTop: 16, gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  statValue: { fontSize: 14, fontWeight: "800", color: "#1a1a1a" },
  statLabel: { fontSize: 10, color: "#64748B", fontWeight: "700", marginTop: 2 },

  emptyBody: { padding: 16 },
  emptyTxt:  { fontSize: 13, color: "#64748B", lineHeight: 19 },
});
