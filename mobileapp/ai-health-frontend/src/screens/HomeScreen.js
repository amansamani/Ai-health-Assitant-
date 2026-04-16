import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { COLORS, SHADOW } from "../constants/theme";
import { useState, useCallback, useContext, useRef, useEffect } from "react";
import API from "../services/api";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import CircularProgressRing from "../components/CircularProgressRing";

const { width } = Dimensions.get("window");

// ─── Animated Card Wrapper ────────────────────────────────────────────────────
function FadeSlideIn({ delay = 0, children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 480,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 480,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Stat Square (ring inside square card) ───────────────────────────────────
function StatSquare({ icon, label, value, color, progress, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  const SIZE   = 72;
  const STROKE = 6;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRC   = 2 * Math.PI * RADIUS;
  const dash   = Math.min(progress, 1) * CIRC;

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      style={{ width: (width - 56) / 3 }}>
      <Animated.View style={[styles.statSquare, { transform: [{ scale }] }]}>
        {/* Circular ring using SVG-like View trick */}
        <View style={styles.ringContainer}>
          <CircularProgressRing
            progress={Math.min(progress, 1)}
            valueText={icon}
            label=""
            color={color}
            size={72}
            strokeWidth={6}
          />
        </View>
        <Text style={styles.squareValue}>{value}</Text>
        <Text style={[styles.squareLabel, { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Action Card ──────────────────────────────────────────────────────────────
function ActionCard({ icon, title, sub, accent, onPress, wide }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      style={wide ? { width: "100%" } : { width: "48%" }}>
      <Animated.View style={[styles.actionCard, wide && styles.actionCardWide, { transform: [{ scale }] }]}>
        <View style={[styles.actionAccentBar, { backgroundColor: accent }]} />
        <Text style={styles.actionIcon}>{icon}</Text>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{sub}</Text>
        <View style={[styles.actionArrow, { backgroundColor: accent + "22" }]}>
          <Text style={[styles.actionArrowText, { color: accent }]}>→</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation, route }) {
  const { token, user } = useContext(AuthContext);
  const firstName = user?.firstName ?? user?.first_name ?? user?.name?.split(" ")[0] ?? null;
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Good Morning");

  const STEP_GOAL  = 10000;
  const WATER_GOAL = 3;
  const SLEEP_GOAL = 8;

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) setGreeting("Good Morning");
    else if (h >= 12 && h < 17) setGreeting("Good Afternoon");
    else if (h >= 17 && h < 21) setGreeting("Good Evening");
    else setGreeting("Good Night");
  }, []);

  const fetchToday = useCallback(async () => {
    try {
      const res = await API.get("/track/today");
      setToday(res.data);
    } catch {
      setToday(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      if (route.params?.updatedToday) {
        setToday(route.params.updatedToday);
        setLoading(false);
        navigation.setParams({ updatedToday: undefined });
      } else {
        setLoading(true);
        fetchToday();
      }
    }, [route.params, token, fetchToday])
  );

  const steps = today?.steps ?? 0;
  const water = today?.water ?? 0;
  const sleep = today?.sleep ?? 0;

  const stepPct = Math.round(Math.min(steps / STEP_GOAL, 1) * 100);

  // Dynamic greeting emoji
  const greetEmoji =
    greeting === "Good Morning" ? "🌤️"
    : greeting === "Good Afternoon" ? "☀️"
    : greeting === "Good Evening" ? "🌇"
    : "🌙";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HEADER ── */}
        <FadeSlideIn delay={0}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>{greetEmoji} {greeting}{firstName ? `, ${firstName}` : ""}!</Text>
              <Text style={styles.subtitle}>Let's crush today's goals</Text>
            </View>
            <Pressable onPress={() => navigation.navigate("Profile")}>
              <LinearGradient
                colors={["#6366F1", "#8B5CF6"]}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>A</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </FadeSlideIn>

        {/* ── HERO CARD ── */}
        <FadeSlideIn delay={80}>
          <LinearGradient
            colors={["#0F172A", "#1E293B", "#0F172A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Decorative ring behind progress */}
            <View style={styles.heroDecorRing} />

            <View style={styles.heroLeft}>
              <View style={styles.heroBadgeWrap}>
                <Text style={styles.heroBadge}>🔥  TODAY'S GOAL</Text>
              </View>
              <Text style={styles.heroTitle}>Step Count</Text>
              <Text style={styles.heroBig}>
                {loading ? "—" : steps.toLocaleString()}
              </Text>
              <Text style={styles.heroUnit}>of {STEP_GOAL.toLocaleString()} steps</Text>

              {/* Mini progress bar */}
              <View style={styles.heroBarBg}>
                <View style={[styles.heroBarFill, { width: `${stepPct}%` }]} />
              </View>
              <Text style={styles.heroBarLabel}>
                {steps >= STEP_GOAL
                  ? "🎉 Goal completed!"
                  : `${stepPct}% complete — keep going!`}
              </Text>
            </View>

            {/* Right side percentage badge */}
            <View style={styles.heroRight}>
              <View style={styles.heroPctCircle}>
                <Text style={styles.heroPctNum}>{stepPct}%</Text>
                <Text style={styles.heroPctLabel}>Done</Text>
              </View>
            </View>
          </LinearGradient>
        </FadeSlideIn>

        {/* ── TODAY'S STATS — squares with rings ── */}
        <FadeSlideIn delay={160}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Stats</Text>
            <Pressable onPress={() => navigation.navigate("Tracking")} style={styles.editBtn}>
              <Text style={styles.editBtnText}>✏️  Edit</Text>
            </Pressable>
          </View>

          <View style={styles.statRow}>
            <StatSquare
              icon="👟"
              label="Steps"
              value={loading ? "—" : steps.toLocaleString()}
              color="#22C55E"
              progress={Math.min(steps / STEP_GOAL, 1)}
              onPress={() => navigation.navigate("TrackDetail", { type: "steps" })}
            />
            <StatSquare
              icon="💧"
              label="Water"
              value={loading ? "—" : `${water} L`}
              color="#3B82F6"
              progress={Math.min(water / WATER_GOAL, 1)}
              onPress={() => navigation.navigate("TrackDetail", { type: "water" })}
            />
            <StatSquare
              icon="🌙"
              label="Sleep"
              value={loading ? "—" : `${sleep}h`}
              color="#A855F7"
              progress={Math.min(sleep / SLEEP_GOAL, 1)}
              onPress={() => navigation.navigate("TrackDetail", { type: "sleep" })}
            />
          </View>
        </FadeSlideIn>

        {/* ── QUICK ACTIONS ── */}
        <FadeSlideIn delay={240}>
          <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>Quick Actions</Text>

          {/* Log Meal — full-width featured */}
          <Pressable
            onPress={() => navigation.navigate("MealLogger")}
            style={({ pressed }) => [{ opacity: pressed ? 0.93 : 1 }]}
          >
            <LinearGradient
              colors={["#EA580C", "#F97316", "#FB923C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.featuredCard}
            >
              <View style={styles.featuredLeft}>
                <Text style={styles.featuredLabel}>MEAL TRACKER</Text>
                <Text style={styles.featuredTitle}>🍛  Log Today's Meal</Text>
                <Text style={styles.featuredSub}>Track calories & nutrition intake</Text>
              </View>
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>+ Add</Text>
              </View>
            </LinearGradient>
          </Pressable>

          {/* 2-column grid */}
          <View style={styles.actionGrid}>
            <ActionCard
              icon="🏋️"
              title="Workouts"
              sub="Training plan"
              accent="#F59E0B"
              onPress={() => navigation.navigate("Workout")}
            />
            <ActionCard
              icon="📊"
              title="Summary"
              sub="7-day progress"
              accent="#6366F1"
              onPress={() => navigation.navigate("WeeklySummary")}
            />
            <ActionCard
              icon="🥗"
              title="Diet Plan"
              sub="Today's meals"
              accent="#10B981"
              onPress={() => navigation.navigate("NutritionDashboard")}
            />
            <ActionCard
              icon="💪"
              title="Challenges"
              sub="Stay consistent"
              accent="#EC4899"
              onPress={() => navigation.navigate("Challenges")}
            />
          </View>
        </FadeSlideIn>

        {/* bottom padding */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 20, paddingTop: 8 },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },
  greeting: { fontSize: 24, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5 },
  subtitle:  { fontSize: 14, color: "#64748B", marginTop: 3 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },

  // Hero Card
  heroCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 22,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    boxShadow: "0px 8px 20px rgba(15, 23, 42, 0.3)",
  },
  heroDecorRing: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 40,
    borderColor: "rgba(255,255,255,0.03)",
    right: -60,
    top: -60,
  },
  heroLeft: { flex: 1, paddingRight: 12 },
  heroRight: { alignItems: "center" },
  heroPctCircle: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 4, borderColor: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.1)",
    justifyContent: "center", alignItems: "center",
  },
  heroPctNum:   { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  heroPctLabel: { fontSize: 11, color: "#22C55E", fontWeight: "700", marginTop: 2 },
  heroBadgeWrap: {
    backgroundColor: "rgba(250,204,21,0.15)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.3)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  heroBadge: { color: "#FACC15", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  heroTitle: { fontSize: 14, color: "#94A3B8", fontWeight: "600", marginBottom: 4 },
  heroBig:   { fontSize: 36, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  heroUnit:  { fontSize: 13, color: "#64748B", marginTop: 2, marginBottom: 14 },

  heroBarBg: {
    height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 8,
    overflow: "hidden",
  },
  heroBarFill: {
    height: "100%", borderRadius: 3,
    backgroundColor: "#22C55E",
    maxWidth: "100%",
  },
  heroBarLabel: { fontSize: 12, color: "#94A3B8" },

  // Section header
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  editBtn: {
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editBtnText: { fontSize: 13, fontWeight: "700", color: "#6366F1" },

  // Stat Squares
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  statSquare: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    boxShadow: "0px 2px 10px rgba(15, 23, 42, 0.08)",
  },
  ringContainer: {
    marginBottom: 10,
  },
  squareValue: { fontSize: 14, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  squareLabel: { fontSize: 11, marginTop: 2, fontWeight: "700" },

  // Featured card
  featuredCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    boxShadow: "0px 6px 14px rgba(234, 88, 12, 0.35)",
  },
  featuredLeft:  { flex: 1 },
  featuredLabel: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.65)", letterSpacing: 1, marginBottom: 4 },
  featuredTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  featuredSub:   { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  featuredBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
  },
  featuredBadgeText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  // Action grid
  actionGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", gap: 12,
  },
  actionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    boxShadow: "0px 2px 10px rgba(15, 23, 42, 0.07)",
    overflow: "hidden",
    position: "relative",
    minHeight: 120,
  },
  actionCardWide: { width: "100%" },
  actionAccentBar: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  actionIcon:  { fontSize: 26, marginBottom: 8, marginTop: 4 },
  actionTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A", letterSpacing: -0.2 },
  actionSub:   { fontSize: 12, color: "#94A3B8", marginTop: 3, fontWeight: "500" },
  actionArrow: {
    position: "absolute", bottom: 14, right: 14,
    width: 30, height: 30, borderRadius: 15,
    justifyContent: "center", alignItems: "center",
  },
  actionArrowText: { fontSize: 16, fontWeight: "800" },
});