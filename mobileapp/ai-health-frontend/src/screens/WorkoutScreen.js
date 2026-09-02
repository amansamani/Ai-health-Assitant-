import { showToast } from "../services/uiFeedback";
import {
  View, Text, FlatList, StyleSheet, Alert,
  ActivityIndicator, Pressable, Animated, Dimensions, Platform,
} from "react-native";
import { useEffect, useState, useCallback, useRef, useContext } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import LucideIcon from "../components/ui/LucideIcon";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";
import ChoiceModal from "../components/ui/ChoiceModal";

const { width } = Dimensions.get("window");
const PLAN_PREF_KEY = "@fitlip_workout_plan_mode";

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
      shadowOpacity: 0.045,
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
  const isRestDay = Boolean(item.isRestDay);

  return (
    <FadeSlideIn delay={index * 60}>
      <Pressable
        onPress={isRestDay ? undefined : onPress}
        onPressIn={isRestDay ? undefined : onIn}
        onPressOut={isRestDay ? undefined : onOut}
        disabled={isRestDay}
        accessibilityRole="button"
        accessibilityLabel={isRestDay ? `Day ${item.day}: ${item.title}, rest day` : `Day ${item.day}: ${item.title}, ${item.exercises.length} exercises`}
      >
        <Animated.View style={[styles.card, shadow(4), isRestDay && styles.cardRest, { transform: [{ scale }] }]}>
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
                  <LucideIcon name={isRestDay ? "bed-outline" : "barbell-outline"} size={11} color={COLORS.textLight} />
                  <Text style={styles.metaText}>{isRestDay ? "Rest day" : `${item.exercises.length} exercises`}</Text>
                </View>
                {item.duration ? (
                  <View style={[styles.metaPill, { marginLeft: 8 }]}>
                    <LucideIcon name="time-outline" size={11} color={COLORS.textLight} />
                    <Text style={styles.metaText}>{item.duration} min</Text>
                  </View>
                ) : null}
              </View>
              {item.todayCompleted ? (
                <View style={styles.todayDoneRow}>
                  <LucideIcon name="checkmark-circle" size={12} color="#16A34A" />
                  <Text style={styles.todayDoneText}>
                    Completed today · {Math.round(item.todayCaloriesBurned || 0)} kcal
                  </Text>
                </View>
              ) : item.todayCompletedCount > 0 ? (
                <View style={styles.todayDoneRow}>
                  <LucideIcon name="ellipse" size={8} color="#F97316" />
                  <Text style={[styles.todayDoneText, { color: "#C2410C" }]}>
                    {item.todayCompletedCount}/{item.exercises.length} done today
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.cardArrow, { backgroundColor: accentColor + "15" }]}>
              <LucideIcon name={isRestDay ? "bed-outline" : "arrow-forward"} size={16} color={accentColor} />
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
  const [planMode, setPlanMode] = useState(null);
  const [planChoiceVisible, setPlanChoiceVisible] = useState(false);
  const [planPreferenceLoading, setPlanPreferenceLoading] = useState(true);
  const [customPlans, setCustomPlans] = useState([]);
  const [customLoading, setCustomLoading] = useState(false);

  const goal = GOAL_META[userGoal] ?? GOAL_META.fit;

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PLAN_PREF_KEY)
      .then((value) => {
        if (!mounted) return;
        setPlanMode(value === "custom" || value === "standard" ? value : null);
      })
      .catch(() => {
        if (mounted) setPlanMode(null);
      })
      .finally(() => {
        if (mounted) setPlanPreferenceLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const choosePlanMode = useCallback(async (nextMode) => {
    await AsyncStorage.setItem(PLAN_PREF_KEY, nextMode);
    setPlanMode(nextMode);
  }, []);

  const openPlanSwitcher = useCallback(() => setPlanChoiceVisible(true), []);

  const choosePlanFromModal = useCallback(async (nextMode) => {
    setPlanChoiceVisible(false);
    if (nextMode === "custom" && customPlans.length === 0) {
      showToast("Create a custom plan from Profile first.", { title: "No custom plan yet", type: "info" });
      return;
    }
    await choosePlanMode(nextMode);
  }, [choosePlanMode, customPlans.length]);

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

  const fetchCustomPlans = useCallback(async () => {
    try {
      setCustomLoading(true);
      const res = await API.get("/custom-workouts/plans");
      setCustomPlans(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.warn("Failed to load custom workout plans:", error?.message);
      setCustomPlans([]);
    } finally {
      setCustomLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchCustomPlans();
  }, [token, fetchCustomPlans]);

  if (planMode === "custom") {
    const activePlan = customPlans.find((item) => item.isActive) || customPlans[0];

    if (!activePlan) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={[styles.center, { paddingHorizontal: 24 }]}>
            <View style={styles.choiceIcon}><LucideIcon name="construct-outline" size={28} color={COLORS.primary} /></View>
            <Text style={styles.choiceTitle}>Create your custom workout</Text>
            <Text style={styles.choiceText}>Set it up from your Profile. Once saved, it will automatically appear here with the same workout experience.</Text>
            <Pressable onPress={() => router.push("/(app)/profile")} style={styles.primarySmallButton}>
              <Text style={styles.primarySmallText}>Go to Profile</Text>
            </Pressable>
            <Pressable onPress={() => choosePlanMode("standard")} style={styles.secondaryChoiceButton}>
              <Text style={styles.secondaryChoiceText}>Use Recommended Plan</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <FlatList
          data={activePlan.days || []}
          keyExtractor={(item) => String(item.dayOfWeek)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={() => (
            <>
              <View style={styles.headerRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.screenTitle}>{activePlan.name || "My Workout"}</Text>
                  <Text style={styles.screenSub}>Your custom training plan</Text>
                </View>
                <Pressable onPress={openPlanSwitcher} style={styles.changePlanBtn} accessibilityRole="button" accessibilityLabel="Change workout plan">
                  <LucideIcon name="swap-horizontal" size={14} color="#fff" />
                  <Text style={styles.changePlanBtnText}>Change</Text>
                </Pressable>
              </View>

              <View style={[styles.statsBar, shadow(2)]}>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{activePlan.days?.filter((d) => !d.isRestDay).length || 0}</Text>
                  <Text style={styles.statLabel}>Training Days</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{activePlan.days?.reduce((sum, d) => sum + (d.exercises?.length || 0), 0) || 0}</Text>
                  <Text style={styles.statLabel}>Exercises</Text>
                </View>
                <View style={styles.statDivider} />
                <Pressable onPress={() => router.push("/(app)/profile")} style={styles.statItem}>
                  <LucideIcon name="settings-outline" size={20} color="#B8AFD6" />
                  <Text style={styles.statLabel}>Manage</Text>
                </Pressable>
              </View>

              <Text style={styles.sectionLabel}>THIS WEEK'S PLAN</Text>
            </>
          )}
          renderItem={({ item, index }) => (
            <WorkoutCard
              item={{
                day: item.dayOfWeek,
                title: item.title,
                exercises: item.exercises || [],
                isRestDay: item.isRestDay,
              }}
              index={index}
              onPress={async () => {
                try {
                  const res = await API.get(`/custom-workouts/plans/${activePlan._id}/days/${item.dayOfWeek}`);
                  router.push({ pathname: "/(app)/workout-detail", params: { workout: JSON.stringify({ _id: activePlan._id, planType: "custom", dayOfWeek: item.dayOfWeek, day: item.dayOfWeek, title: res.data.title, goal: activePlan.goal, mode: activePlan.mode, exercises: res.data.exercises }) } });
                } catch {
                  showToast("Please try again.", { title: "Couldn't open workout", type: "error" });
                }
              }}
            />
          )}
          ListFooterComponent={() => (
            <Pressable onPress={() => router.push({ pathname: "/(app)/custom-workout", params: { planId: activePlan._id } })} style={styles.manageLink}>
              <Text style={styles.manageLinkText}>Manage custom plan in Profile</Text>
              <LucideIcon name="chevron-forward" size={14} color={COLORS.primary} />
            </Pressable>
          )}
        />
      </SafeAreaView>
    );
  }

  if (planPreferenceLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (planMode === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.choiceScreen}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.screenTitle}>Choose your workout</Text>
              <Text style={styles.screenSub}>Pick one plan style. You can change it later from Profile.</Text>
            </View>
            <View style={[styles.goalChip, { backgroundColor: goal.bg, borderColor: goal.color + "40" }]}>
              <LucideIcon name={goal.icon} size={14} color={goal.color} style={{ marginRight: 5 }} />
              <Text style={[styles.goalChipText, { color: goal.color }]}>{goal.label}</Text>
            </View>
          </View>

          <Pressable onPress={() => choosePlanMode("standard")} style={[styles.planChoiceCard, shadow(5)]}>
            <View style={[styles.choiceIcon, { backgroundColor: "#EDE9FE" }]}>
              <LucideIcon name="sparkles" size={24} color="#6339B8" />
            </View>
            <View style={styles.choiceCopy}>
              <Text style={styles.choiceCardTitle}>Recommended Plan</Text>
              <Text style={styles.choiceCardText}>Use FitLip's ready-made weekly plan based on your goal and equipment.</Text>
            </View>
            <LucideIcon name="chevron-forward" size={22} color="#6339B8" />
          </Pressable>

          <Pressable onPress={() => choosePlanMode("custom")} style={[styles.planChoiceCard, shadow(5)]}>
            <View style={[styles.choiceIcon, { backgroundColor: "#F3F4F6" }]}>
              <LucideIcon name="construct-outline" size={24} color={COLORS.textDark} />
            </View>
            <View style={styles.choiceCopy}>
              <Text style={styles.choiceCardTitle}>Custom Plan</Text>
              <Text style={styles.choiceCardText}>Use the plan you created from Profile and keep the same exercise flow.</Text>
            </View>
            <LucideIcon name="chevron-forward" size={22} color={COLORS.textMuted} />
          </Pressable>

          {!customPlans.length && (
            <View style={styles.choiceHint}>
              <LucideIcon name="information-circle-outline" size={16} color={COLORS.textMuted} />
              <Text style={styles.choiceHintText}>No custom plan exists yet. Create one from Profile first.</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

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
        <LucideIcon name="flag-outline" size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
        <Text style={styles.errorText}>No goal set. Please update your profile.</Text>
      </View>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <View style={styles.center}>
        <LucideIcon name="cloud-offline-outline" size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
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
        <LucideIcon name="calendar-outline" size={40} color={COLORS.textMuted} style={{ marginBottom: 12 }} />
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
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.screenTitle}>Workouts</Text>
                  <Text style={styles.screenSub}>Recommended weekly training plan</Text>
                </View>
                <Pressable onPress={openPlanSwitcher} style={styles.changePlanBtn} accessibilityRole="button" accessibilityLabel="Change workout plan">
                  <LucideIcon name="swap-horizontal" size={14} color="#fff" />
                  <Text style={styles.changePlanBtnText}>Change</Text>
                </Pressable>
              </View>
            </FadeSlideIn>

            {/* Stats bar */}
            <FadeSlideIn delay={80}>
              <View style={[styles.statsBar, shadow(2)]}>
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
                  <LucideIcon
                    name={equipmentModeOn ? "checkmark-circle" : "close-circle-outline"}
                    size={20}
                    color={equipmentModeOn ? "#22C55E" : "#B8AFD6"}
                  />
                  <Text style={styles.statLabel}>Equipment</Text>
                </View>
              </View>
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
                      <LucideIcon name={opt.icon} size={15} color={mode === opt.key ? "#fff" : COLORS.textMuted} style={{ marginRight: 6 }} />
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
    <ChoiceModal visible={planChoiceVisible} title="Change workout plan" message="Choose which weekly plan you want to use. Your other plan stays saved." onCancel={() => setPlanChoiceVisible(false)} options={[{ label: "Recommended Plan", subtitle: "FitLip’s standard weekly plan", icon: "sparkles-outline", onPress: () => choosePlanFromModal("standard") }, { label: "Custom Plan", subtitle: customPlans.length ? "Use your saved custom routine" : "Create one from Profile first", icon: "construct-outline", onPress: () => choosePlanFromModal("custom"), danger: false }]} />
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
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12, minHeight: 44, justifyContent: "center",
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Header
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 18,
  },
  screenTitle: { fontSize: 26, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.6 },
  screenSub:   { fontSize: 14, color: COLORS.textMuted, marginTop: 3, fontWeight: "500" },
  goalChip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1,
  },
  goalChipText: { fontSize: 13, fontWeight: "800" },

  // Stats bar
  statsBar: {
    borderRadius: 16, padding: 18,
    flexDirection: "row", justifyContent: "space-around",
    alignItems: "center", marginBottom: 16,
    backgroundColor: COLORS.primaryDark,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  statItem:   { alignItems: "center" },
  statNum:    { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  statLabel:  { fontSize: 11, color: "#D9D2E7", marginTop: 3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  statDivider:{ width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.12)" },

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
    backgroundColor: COLORS.surface, borderRadius: 16,
    marginBottom: 12, overflow: "hidden",
  },
  cardRest: { opacity: 0.68 },
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
  dayNum:  { fontSize: 20, fontWeight: "800", lineHeight: 22 },
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
  todayDoneRow: { flexDirection: "row", alignItems: "center", marginTop: 7, gap: 5 },
  todayDoneText: { fontSize: 10, color: "#166534", fontWeight: "800" },

  choiceScreen: { flex: 1, padding: 20, paddingTop: 18 },
  planChoiceCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 18, marginBottom: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  choiceIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#F1EAFE", alignItems: "center", justifyContent: "center" },
  choiceCopy: { flex: 1, marginHorizontal: 14 },
  choiceCardTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textDark },
  choiceCardText: { marginTop: 5, fontSize: 12, lineHeight: 17, color: COLORS.textMuted, fontWeight: "600" },
  choiceTitle: { marginTop: 12, fontSize: 20, fontWeight: "800", color: COLORS.textDark, textAlign: "center" },
  choiceText: { marginTop: 7, fontSize: 13, lineHeight: 19, color: COLORS.textMuted, textAlign: "center", fontWeight: "600" },
  choiceHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4, paddingHorizontal: 10 },
  choiceHintText: { flex: 1, fontSize: 11, lineHeight: 16, color: COLORS.textMuted, fontWeight: "600" },
  secondaryChoiceButton: { marginTop: 10, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryChoiceText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  customHeaderBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primaryDark, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12 },
  changePlanBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: COLORS.primaryDark, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  changePlanBtnText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  customHeaderBtnText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  customEmptyCard: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 18, borderWidth: 1, borderColor: "#E8DFFF" },
  customEmptyTitle: { marginTop: 10, fontSize: 18, fontWeight: "800", color: COLORS.textDark },
  customEmptyText: { marginTop: 6, fontSize: 12, lineHeight: 18, color: COLORS.textMuted, textAlign: "center", fontWeight: "600" },
  primarySmallButton: { marginTop: 16, backgroundColor: COLORS.primaryDark, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 11 },
  primarySmallText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  customDayCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 16, padding: 14, marginBottom: 10, gap: 12 },
  customDayRest: { opacity: 0.65 },
  customDayNum: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  customDayWord: { fontSize: 8, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.8 },
  customDayMeta: { marginTop: 5, fontSize: 11, color: COLORS.textMuted, fontWeight: "700" },
  manageLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, padding: 16 },
  manageLinkText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },

  cardArrow: {
    width: 34, height: 34, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
});
