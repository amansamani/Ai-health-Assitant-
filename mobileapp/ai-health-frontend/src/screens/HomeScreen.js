import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { useState, useCallback, useContext, useRef, useEffect, useMemo } from "react";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import API from "../services/api";
import { LinearGradient } from "expo-linear-gradient";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";
import CircularProgressRing from "../components/CircularProgressRing";
import WeeklyInsightCard from "../components/WeeklyInsightCard";
import { StepsIcon, SleepIcon, ManualLogIcon, MotivationSkyIllustration } from "../components/icons/MotionIcons";
import { useReplayOnFocus } from "../hooks/useReplayOnFocus";
import { useActiveCalorieGoal } from "../hooks/useActiveCalorieGoal";
import AiCoachFab from "../components/AiCoachFab";

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
function StatSquare({ icon, renderIcon, label, value, color, progress, onPress }) {
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
            renderIcon={renderIcon}
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

// ─── Motivation Card ────────────────────────────────────────────────────────
// A small rotating set of one-liners, deterministically picked by day-of-year
// so it changes daily without needing any backend call or extra state.
const MOTIVATION_QUOTES = [
  "Small steps every day add up to big change.",
  "Discipline is choosing what you want most over what you want now.",
  "Your only competition is who you were yesterday.",
  "Progress, not perfection.",
  "The body achieves what the mind believes.",
  "Consistency beats intensity.",
  "Every workout counts, even the short ones.",
  "Take care of your body — it's the only place you have to live.",
  "Energy and persistence conquer all things.",
  "You don't have to be extreme, just consistent.",
];

function getDailyQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000);
  return MOTIVATION_QUOTES[dayOfYear % MOTIVATION_QUOTES.length];
}

function MotivationCard({ iconTrigger }) {
  const quote = useMemo(getDailyQuote, []);
  return (
    <View style={styles.motivationCard}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <View style={styles.motivationIconWrap}>
          <Ionicons name="sparkles-outline" size={16} color={COLORS.primary} />
        </View>
        <Text style={styles.motivationLabel}>TODAY'S MOTIVATION</Text>
        <Text style={styles.motivationQuote}>{quote}</Text>
      </View>
      <MotivationSkyIllustration trigger={iconTrigger} />
    </View>
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
  const SLEEP_GOAL = 8;
  const { activeCalorieGoal } = useActiveCalorieGoal();

  const iconTrigger = useReplayOnFocus();

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

  const steps    = today?.steps ?? 0;
  const calories = today?.caloriesBurned ?? 0;
  const sleep    = today?.sleep ?? 0;
  const stepPct  = Math.round(Math.min(steps / STEP_GOAL, 1) * 100);

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

        {/* ── TODAY'S MOTIVATION ── */}
        <FadeSlideIn delay={60}>
          <MotivationCard iconTrigger={iconTrigger} />
        </FadeSlideIn>

        {/* ── HERO CARD ── */}
        <FadeSlideIn delay={110}>
          <LinearGradient
            colors={["#170F36", "#49225B", "#170F36"]}
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
              onPress={() => router.push("/(app)/(tabs)/tracking")}
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
              renderIcon={<StepsIcon trigger={iconTrigger} size={24} color="#22C55E" />}
              value={loading ? "—" : steps.toLocaleString()}
              color="#22C55E" progress={Math.min(steps / STEP_GOAL, 1)}
              onPress={() => router.push({ pathname: "/(app)/track-detail", params: { type: "steps" } })}
            />
            <StatSquare
              icon="flame-outline" label="Active Burn"
              value={loading ? "—" : `${calories} kcal`}
              color="#F97316" progress={Math.min(calories / activeCalorieGoal, 1)}
              onPress={() => router.push({ pathname: "/(app)/track-detail", params: { type: "caloriesBurned" } })}
            />
            <StatSquare
              icon="moon-outline" label="Sleep"
              renderIcon={<SleepIcon trigger={iconTrigger} size={24} color={COLORS.primary} />}
              value={loading ? "—" : `${sleep}h`}
              color={COLORS.primary} progress={Math.min(sleep / SLEEP_GOAL, 1)}
              onPress={() => router.push({ pathname: "/(app)/track-detail", params: { type: "sleep" } })}
            />
          </View>
        </FadeSlideIn>

        {/* ── COMPETE WITH FRIENDS ── */}
        <FadeSlideIn delay={160}>
          <Pressable
            onPress={() => router.push("/(app)/social")}
            style={({ pressed }) => [styles.competeCard, { opacity: pressed ? 0.93 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Compete with friends"
          >
            <View style={styles.competeAccent} />
            <View style={styles.competeIconWrap}>
              <Ionicons name="flash" size={20} color="#F97316" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.competeTitle}>Compete with Friends</Text>
              <Text style={styles.competeSub}>Duels, streak battles & achievements</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </Pressable>
        </FadeSlideIn>

        <WeeklyInsightCard />

        {/* ── LOG TODAY'S FOOD (manual entry) ── */}
        <FadeSlideIn delay={200}>
          <Pressable
            onPress={() => router.push("/(app)/nutrition/meal-logger")}
            style={({ pressed }) => [styles.logFoodCard, { opacity: pressed ? 0.93 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Log today's food manually"
          >
            <View style={styles.logFoodAccent} />
            <View style={styles.logFoodIconWrap}>
              <ManualLogIcon trigger={iconTrigger} size={22} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logFoodTitle}>Log Today's Food</Text>
              <Text style={styles.logFoodSub}>Search & add manually</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </Pressable>
        </FadeSlideIn>

        <View style={{ height: 32 }} />
      </ScrollView>
      <AiCoachFab />
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

  // ── Log Today's Food card ──────────────────────────────────────────────────
  logFoodCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 18,
    padding: 16, marginBottom: 14,
    overflow: "hidden",
    boxShadow: "0px 2px 10px rgba(23, 15, 54, 0.06)",
  },
  logFoodAccent: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
    backgroundColor: COLORS.accent,
  },
  logFoodIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: COLORS.accent + "18",
    justifyContent: "center", alignItems: "center",
  },
  logFoodTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark },
  logFoodSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: "500" },

  // ── Compete with Friends card ──────────────────────────────────────────────
  competeCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 18,
    padding: 16, marginBottom: 14,
    overflow: "hidden",
    boxShadow: "0px 2px 10px rgba(23, 15, 54, 0.06)",
  },
  competeAccent: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
    backgroundColor: "#F97316",
  },
  competeIconWrap: {
    width: 42, height: 42, borderRadius: 13,
    backgroundColor: "#F9731618",
    justifyContent: "center", alignItems: "center",
  },
  competeTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark },
  competeSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: "500" },

  // ── Motivation card ────────────────────────────────────────────────────────
  motivationCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 18,
    padding: 16, marginBottom: 22,
    boxShadow: "0px 2px 10px rgba(23, 15, 54, 0.06)",
  },
  motivationIconWrap: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: COLORS.surfaceMuted,
    justifyContent: "center", alignItems: "center",
    marginBottom: 10,
  },
  motivationLabel: {
    fontSize: 10, fontWeight: "800", color: COLORS.textMuted,
    letterSpacing: 0.8, marginBottom: 4,
  },
  motivationQuote: {
    fontSize: 14, fontWeight: "600", color: COLORS.textDark,
    lineHeight: 20,
  },
});
