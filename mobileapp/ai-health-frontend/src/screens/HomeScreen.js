import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import { useState, useCallback, useContext, useRef, useEffect } from "react";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import API from "../services/api";
import { LinearGradient } from "expo-linear-gradient";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";
import CircularProgressRing from "../components/CircularProgressRing";
import WeeklyInsightCard from "../components/WeeklyInsightCard";

const { width } = Dimensions.get("window");

// ─── Animated Card Wrapper ────────────────────────────────────────────────────
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

// ─── Stat Square ──────────────────────────────────────────────────────────────
function StatSquare({ icon, label, value, color, progress, onPress }) {
  const scale      = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      style={{ width: (width - 56) / 3 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. View details`}
    >
      <Animated.View style={[styles.statSquare, { transform: [{ scale }] }]}>
        <View style={styles.ringContainer}>
          <CircularProgressRing
            progress={Math.min(progress, 1)}
            icon={icon}
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
  const scale      = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      style={wide ? { width: "100%" } : { width: "48%" }}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${sub}`}
    >
      <Animated.View style={[styles.actionCard, wide && styles.actionCardWide, { transform: [{ scale }] }]}>
        <View style={[styles.actionAccentBar, { backgroundColor: accent }]} />
        <View style={[styles.actionIconWrap, { backgroundColor: accent + "18" }]}>
          <Ionicons name={icon} size={20} color={accent} />
        </View>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{sub}</Text>
        <View style={[styles.actionArrow, { backgroundColor: accent + "22" }]}>
          <Ionicons name="arrow-forward" size={14} color={accent} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ─── AI Chat Button ───────────────────────────────────────────────────────────
function AiChatButton({ onPress }) {
  const scale      = useRef(new Animated.Value(1)).current;
  const glowAnim   = useRef(new Animated.Value(0)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  // Pulse glow loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1800, useNativeDriver: false }),
      ])
    ).start();
  }, []);

  const borderColor = glowAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [`${COLORS.primary}4D`, `${COLORS.primary}E6`],
  });

  return (
    <Pressable
      onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel="Ask your AI nutrition coach"
    >
      {/* Outer: JS-driver glow border only */}
      <Animated.View style={[styles.aiCard, { borderColor }]}>
      {/* Inner: native-driver scale only */}
      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient
          colors={[COLORS.primaryDark, COLORS.primary, COLORS.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.aiGradient}
        >
          {/* Decorative blobs */}
          <View style={styles.aiBlob1} />
          <View style={styles.aiBlob2} />

          {/* Left content */}
          <View style={styles.aiLeft}>
            <View style={styles.aiBadgeWrap}>
              <Ionicons name="sparkles" size={11} color="#E0E7FF" />
              <Text style={styles.aiBadge}>AI POWERED</Text>
            </View>
            <Text style={styles.aiTitle}>Ask Your Nutrition Coach</Text>
            <Text style={styles.aiSub}>
              Get personalized advice based on{"\n"}your health profile & diet plan
            </Text>
          </View>

          {/* Right button */}
          <View style={styles.aiRight}>
            <View style={styles.aiIconCircle}>
              <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
            </View>
            <Text style={styles.aiCta}>Chat now</Text>
          </View>
        </LinearGradient>
      </Animated.View>{/* inner scale */}
      </Animated.View>{/* outer glow */}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { updatedToday: updatedTodayParam } = useLocalSearchParams();
  const { token, user } = useContext(AuthContext);
  const firstName = user?.firstName ?? user?.first_name ?? user?.name?.split(" ")[0] ?? null;
  const [today, setToday]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Good Morning");

  const STEP_GOAL  = 10000;
  const WATER_GOAL = 3;
  const SLEEP_GOAL = 8;

  useEffect(() => {
    const h = new Date().getHours();
    if      (h >= 5  && h < 12) setGreeting("Good Morning");
    else if (h >= 12 && h < 17) setGreeting("Good Afternoon");
    else if (h >= 17 && h < 21) setGreeting("Good Evening");
    else                        setGreeting("Good Night");
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
      if (updatedTodayParam) {
        try {
          setToday(JSON.parse(updatedTodayParam));
        } catch {
          // malformed param — fall through to a real refetch below
        }
        setLoading(false);
        // Native setParams (not the legacy-nav shim) so `undefined` actually
        // clears the key instead of being silently dropped from the call.
        router.setParams({ updatedToday: undefined });
      } else {
        setLoading(true);
        fetchToday();
      }
    }, [updatedTodayParam, token, fetchToday])
  );

  const steps   = today?.steps ?? 0;
  const water   = today?.water ?? 0;
  const sleep   = today?.sleep ?? 0;
  const stepPct = Math.round(Math.min(steps / STEP_GOAL, 1) * 100);

  const greetIcon =
    greeting === "Good Morning"   ? "partly-sunny-outline"
    : greeting === "Good Afternoon" ? "sunny-outline"
    : greeting === "Good Evening"   ? "cloudy-night-outline"
    : "moon-outline";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HEADER ── */}
        <FadeSlideIn delay={0}>
          <View style={styles.headerRow}>
            <View style={styles.greetingRow}>
              <Ionicons name={greetIcon} size={20} color={COLORS.primary} style={{ marginRight: 6 }} />
              <View>
                <Text style={styles.greeting}>
                  {greeting}{firstName ? `, ${firstName}` : ""}!
                </Text>
                <Text style={styles.subtitle}>Let's crush today's goals</Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push("/(app)/profile")}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.avatar}>
                <Text style={styles.avatarText}>{(firstName ?? "A")[0].toUpperCase()}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </FadeSlideIn>

        {/* ── HERO CARD ── */}
        <FadeSlideIn delay={80}>
          <LinearGradient
            colors={["#170F36", "#29195A", "#170F36"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroDecorRing} />
            <View style={styles.heroLeft}>
              <View style={styles.heroBadgeWrap}>
                <Ionicons name="flame" size={11} color="#FACC15" />
                <Text style={styles.heroBadge}>TODAY'S GOAL</Text>
              </View>
              <Text style={styles.heroTitle}>Step Count</Text>
              <Text style={styles.heroBig}>
                {loading ? "—" : steps.toLocaleString()}
              </Text>
              <Text style={styles.heroUnit}>of {STEP_GOAL.toLocaleString()} steps</Text>
              <View style={styles.heroBarBg}>
                <View style={[styles.heroBarFill, { width: `${stepPct}%` }]} />
              </View>
              <Text style={styles.heroBarLabel}>
                {steps >= STEP_GOAL ? "Goal completed!" : `${stepPct}% complete — keep going!`}
              </Text>
            </View>
            <View style={styles.heroRight}>
              <View style={styles.heroPctCircle}>
                <Text style={styles.heroPctNum}>{stepPct}%</Text>
                <Text style={styles.heroPctLabel}>Done</Text>
              </View>
            </View>
          </LinearGradient>
        </FadeSlideIn>

        {/* ── TODAY'S STATS ── */}
        <FadeSlideIn delay={160}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Stats</Text>
            <Pressable
              onPress={() => router.push("/(app)/tracking")}
              style={styles.editBtn}
              accessibilityRole="button"
              accessibilityLabel="Edit today's stats"
            >
              <Ionicons name="create-outline" size={13} color={COLORS.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.statRow}>
            <StatSquare
              icon="footsteps-outline" label="Steps"
              value={loading ? "—" : steps.toLocaleString()}
              color="#22C55E" progress={Math.min(steps / STEP_GOAL, 1)}
              onPress={() => router.push({ pathname: "/(app)/track-detail", params: { type: "steps" } })}
            />
            <StatSquare
              icon="water-outline" label="Water"
              value={loading ? "—" : `${water} L`}
              color="#3B82F6" progress={Math.min(water / WATER_GOAL, 1)}
              onPress={() => router.push({ pathname: "/(app)/track-detail", params: { type: "water" } })}
            />
            <StatSquare
              icon="moon-outline" label="Sleep"
              value={loading ? "—" : `${sleep}h`}
              color={COLORS.primary} progress={Math.min(sleep / SLEEP_GOAL, 1)}
              onPress={() => router.push({ pathname: "/(app)/track-detail", params: { type: "sleep" } })}
            />
          </View>
        </FadeSlideIn>

        <WeeklyInsightCard />

        {/* ── QUICK ACTIONS ── */}
        <FadeSlideIn delay={240}>
          <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>Quick Actions</Text>

          {/* Meal Tracker — featured */}
          <Pressable
            onPress={() => router.push("/(app)/nutrition/meal-logger")}
            style={({ pressed }) => [{ opacity: pressed ? 0.93 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Log today's meal"
          >
            <LinearGradient
              colors={["#EA580C", "#F97316", "#FB923C"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.featuredCard}
            >
              <View style={styles.featuredLeft}>
                <Text style={styles.featuredLabel}>MEAL TRACKER</Text>
                <Text style={styles.featuredTitle}>Log Today's Meal</Text>
                <Text style={styles.featuredSub}>Track calories & nutrition intake</Text>
              </View>
              <View style={styles.featuredBadge}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.featuredBadgeText}>Add</Text>
              </View>
            </LinearGradient>
          </Pressable>

          {/* ── AI CHAT BUTTON ── */}
          <AiChatButton onPress={() => router.push("/(app)/coach")} />

          {/* 2-col grid */}
          <View style={styles.actionGrid}>
            <ActionCard
              icon="water-outline"
              title="Water Intake"
              sub="Track daily hydration"
              accent="#3B82F6"
              onPress={() => router.push("/(app)/water-tracking")}
            />
            <ActionCard
              icon="barbell-outline" title="Workouts" sub="Training plan"
              accent={COLORS.warning} onPress={() => router.push("/(app)/workout")}
            />
            <ActionCard
              icon="stats-chart-outline" title="Summary" sub="7-day progress"
              accent={COLORS.primary} onPress={() => router.push("/(app)/weekly-summary")}
            />
            <ActionCard
              icon="trophy-outline" title="Challenges" sub="Stay consistent"
              accent="#EC4899" onPress={() => Alert.alert("Coming Soon", "Challenges feature is coming soon!")}
            />
          </View>
        </FadeSlideIn>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20, paddingTop: 8 },

  // Header
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 22,
  },
  greetingRow: { flexDirection: "row", alignItems: "center" },
  greeting:   { fontSize: 22, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.5 },
  subtitle:   { fontSize: 14, color: COLORS.textLight, marginTop: 3 },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },

  // Hero Card
  heroCard: {
    borderRadius: 24, padding: 24, marginBottom: 22,
    flexDirection: "row", alignItems: "center", overflow: "hidden",
    boxShadow: "0px 8px 20px rgba(23, 15, 54, 0.35)",
  },
  heroDecorRing: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    borderWidth: 40, borderColor: "rgba(255,255,255,0.03)",
    right: -60, top: -60,
  },
  heroLeft:       { flex: 1, paddingRight: 12 },
  heroRight:      { alignItems: "center" },
  heroPctCircle: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 4, borderColor: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.1)",
    justifyContent: "center", alignItems: "center",
  },
  heroPctNum:   { fontSize: 22, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  heroPctLabel: { fontSize: 11, color: "#22C55E", fontWeight: "700", marginTop: 2 },
  heroBadgeWrap: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(250,204,21,0.15)",
    borderWidth: 1, borderColor: "rgba(250,204,21,0.3)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: "flex-start", marginBottom: 10,
  },
  heroBadge:    { color: "#FACC15", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  heroTitle:    { fontSize: 14, color: "#B8AFD6", fontWeight: "600", marginBottom: 4 },
  heroBig:      { fontSize: 36, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  heroUnit:     { fontSize: 13, color: "#9186B0", marginTop: 2, marginBottom: 14 },
  heroBarBg:    { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 8, overflow: "hidden" },
  heroBarFill:  { height: "100%", borderRadius: 3, backgroundColor: "#22C55E", maxWidth: "100%" },
  heroBarLabel: { fontSize: 12, color: "#B8AFD6" },

  // Section
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.3 },
  editBtn:      {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceMuted, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, minHeight: 30,
  },
  editBtnText:  { fontSize: 13, fontWeight: "700", color: COLORS.primary },

  // Stat squares
  statRow:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  statSquare: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 8, alignItems: "center",
    boxShadow: "0px 2px 10px rgba(23, 15, 54, 0.08)",
  },
  ringContainer: { marginBottom: 10 },
  squareValue:   { fontSize: 14, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.3 },
  squareLabel:   { fontSize: 11, marginTop: 2, fontWeight: "700" },

  // Featured card
  featuredCard: {
    borderRadius: 20, padding: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
    boxShadow: "0px 6px 14px rgba(234, 88, 12, 0.35)",
  },
  featuredLeft:      { flex: 1 },
  featuredLabel:     { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.65)", letterSpacing: 1, marginBottom: 4 },
  featuredTitle:     { fontSize: 18, fontWeight: "800", color: "#fff" },
  featuredSub:       { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  featuredBadge:     {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  featuredBadgeText: { color: "#fff", fontWeight: "900", fontSize: 14 },

  // ── AI Chat Card ──────────────────────────────────────────────────────────
  aiCard: {
    borderRadius: 22, marginBottom: 14,
    borderWidth: 1.5,
    overflow: "hidden",
    boxShadow: "0px 8px 22px rgba(41, 25, 90, 0.35)",
  },
  aiGradient: {
    flexDirection: "row", alignItems: "center",
    padding: 20, overflow: "hidden",
  },
  aiBlob1: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.05)", top: -60, right: -40,
  },
  aiBlob2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.04)", bottom: -50, left: 20,
  },
  aiLeft:       { flex: 1, paddingRight: 12 },
  aiBadgeWrap: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: "flex-start", marginBottom: 10,
  },
  aiBadge:      { color: "#E0E7FF", fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  aiTitle:      { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 6 },
  aiSub:        { fontSize: 12, color: "rgba(255,255,255,0.72)", lineHeight: 18 },
  aiRight:      { alignItems: "center", gap: 8 },
  aiIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  aiCta:        { fontSize: 11, color: "#C7D2FE", fontWeight: "800", letterSpacing: 0.3 },

  // Action grid
  actionGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "space-between", gap: 12,
  },
  actionCard: {
    backgroundColor: COLORS.surface, borderRadius: 20, padding: 18,
    boxShadow: "0px 2px 10px rgba(23, 15, 54, 0.07)",
    overflow: "hidden", position: "relative", minHeight: 120,
  },
  actionCardWide:  { width: "100%" },
  actionAccentBar: {
    position: "absolute", top: 0, left: 0, right: 0, height: 3,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  actionIconWrap: {
    width: 38, height: 38, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
    marginBottom: 10, marginTop: 4,
  },
  actionTitle:     { fontSize: 16, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.2 },
  actionSub:       { fontSize: 12, color: COLORS.textMuted, marginTop: 3, fontWeight: "500" },
  actionArrow: {
    position: "absolute", bottom: 14, right: 14,
    width: 30, height: 30, borderRadius: 15,
    justifyContent: "center", alignItems: "center",
  },
});
