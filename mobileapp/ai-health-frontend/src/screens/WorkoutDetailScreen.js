import { useEffect, useState, useCallback, memo, useRef, useMemo } from "react";
import { showToast } from "../services/uiFeedback";
import {
  Animated, View, Text, StyleSheet, FlatList,
  Pressable, Platform, Image, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { EXERCISE_IMAGES } from "../constants/exerciseImages";
import { COLORS } from "../constants/theme";
import API from "../services/api";

const shadow = (elevation = 4, color = COLORS.textDark) =>
  Platform.select({
    ios: {
      shadowColor: color,
      shadowOffset: { width: 0, height: elevation / 2 },
      shadowOpacity: 0.1,
      shadowRadius: elevation,
    },
    android: { elevation },
    default: {},
  });

function todayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

// ── Exercise Card ─────────────────────────────────────────────────────────────
const ExerciseCard = memo(function ExerciseCard({
  item,
  isCompleted,
  isSyncing,
  onToggleSelect,
  isSelected,
  delay = 0,
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [delay, fadeAnim, slideAnim]);

  const onIn = useCallback(() =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start(), [scaleAnim]);
  const onOut = useCallback(() =>
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start(), [scaleAnim]);

  const handlePress = useCallback(() => {
    if (!isCompleted && !isSyncing) onToggleSelect(item);
  }, [isCompleted, isSyncing, item, onToggleSelect]);

  const imageSource = EXERCISE_IMAGES[item.imageKey] ?? EXERCISE_IMAGES.default;
  const kcal = Number(item.caloriesPerExercise || 0);

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
    }}>
      <Pressable
        onPress={handlePress}
        onPressIn={onIn}
        onPressOut={onOut}
        disabled={isSyncing}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted || isSelected, disabled: isSyncing }}
        accessibilityLabel={`${item.name}, ${item.sets ?? "—"} sets of ${item.reps ?? "—"} reps, approximately ${kcal} calories`}
      >
        <View style={[styles.card, shadow(3), !isSelected && !isCompleted && styles.cardIdle, isSelected && styles.cardSelected, isCompleted && styles.cardCompleted]}>
          {isCompleted && <View style={styles.cardDoneTint} />}

          <View style={[styles.iconWrap, isCompleted && styles.iconWrapDone]}>
            <Image source={imageSource} style={styles.cardIcon} resizeMode="contain" />
          </View>

          <View style={styles.cardMid}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.exerciseName, isCompleted && styles.exerciseNameDone]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {isCompleted && (
                <View style={styles.doneBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                  <Text style={styles.doneBadgeText}>Done</Text>
                </View>
              )}
              {!isCompleted && isSelected && (
                <View style={styles.selectedBadge}>
                  <Ionicons name="checkmark-circle" size={12} color="#6339B8" />
                  <Text style={styles.selectedBadgeText}>Selected</Text>
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Ionicons name="repeat-outline" size={11} color={COLORS.textLight} />
                <Text style={styles.metaText}>{item.sets ?? "—"} sets</Text>
              </View>
              <View style={[styles.metaPill, styles.metaPillGap]}>
                <Ionicons name="barbell-outline" size={11} color={COLORS.textLight} />
                <Text style={styles.metaText}>{item.reps ?? "—"} reps</Text>
              </View>
              {item.rest ? (
                <View style={[styles.metaPill, styles.metaPillGap]}>
                  <Ionicons name="time-outline" size={11} color={COLORS.textLight} />
                  <Text style={styles.metaText}>{item.rest}s</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.calorieRow}>
              <Ionicons name="flame-outline" size={13} color="#F97316" />
              <Text style={styles.calorieText}>≈ {kcal} kcal</Text>
              {isSyncing && <Text style={styles.syncText}>Saving…</Text>}
            </View>
          </View>

          <View style={styles.checkWrap}>
            {isCompleted ? (
              <LinearGradient colors={["#22C55E", "#16A34A"]} style={styles.checkDone}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </LinearGradient>
            ) : isSelected ? (
              <View style={styles.checkSelected}>
                <Ionicons name="checkmark" size={18} color="#6339B8" />
              </View>
            ) : (
              <View style={styles.checkEmpty} />
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

// ── Progress bar ──────────────────────────────────────────────────────────────
const ProgressBar = memo(function ProgressBar({ pct, completedCount, total, allDone }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct, duration: 300, useNativeDriver: false }).start();
  }, [pct, widthAnim]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 1], outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressBar}>
        <Animated.View style={[styles.progressFill, { width: animatedWidth }]} />
      </View>
      <View style={styles.progressLabelRow}>
        {allDone && <Ionicons name="sparkles" size={13} color="#22C55E" style={{ marginRight: 5 }} />}
        <Text style={styles.progressLabel}>
          {allDone ? "Workout complete!" : `${completedCount} / ${total} done`}
        </Text>
      </View>
    </View>
  );
});

// ── Stats row ─────────────────────────────────────────────────────────────────
const StatsRow = memo(function StatsRow({ total, completedCount, workoutCalories }) {
  return (
    <View style={[styles.statRow, shadow(3)]}>
      <View style={styles.statPill}>
        <Text style={styles.statNum}>{total}</Text>
        <Text style={styles.statLabel}>Exercises</Text>
      </View>
      <View style={styles.statPill}>
        <Text style={styles.statNum}>{completedCount}</Text>
        <Text style={styles.statLabel}>Completed</Text>
      </View>
      <View style={styles.statPill}>
        <Text style={styles.statNum}>{Math.round(workoutCalories)}</Text>
        <Text style={styles.statLabel}>Kcal Burned</Text>
      </View>
    </View>
  );
});

const keyExtractor = (item, index) => `${item.exerciseId || item.name}-${index}`;

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WorkoutDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { workout: workoutParam } = params;

  const workout = useMemo(() => {
    const raw = Array.isArray(workoutParam) ? workoutParam[0] : workoutParam;
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [workoutParam]);

  const exercises = useMemo(() => workout?.exercises ?? [], [workout]);
  const planType = workout?.planType || "standard";
  const dayOfWeek = Number(workout?.dayOfWeek || workout?.day || 1);

  const [completed, setCompleted] = useState({});
  const [selected, setSelected] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [workoutCalories, setWorkoutCalories] = useState(0);
  const [attemptNumber, setAttemptNumber] = useState(1);
  const [completedToday, setCompletedToday] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [calorieToast, setCalorieToast] = useState(null);
  const [statusToast, setStatusToast] = useState(null);
  const calorieToastAnim = useRef(new Animated.Value(0)).current;
  const statusToastAnim = useRef(new Animated.Value(0)).current;

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [headerOpacity, headerSlide]);

  const exerciseKey = useCallback((item) => item?.exerciseId ? `id:${item.exerciseId}` : `name:${item?.name}`, []);

  const buildCompletedMap = useCallback((progress) => {
    const completedIds = new Set((progress?.completedExerciseIds || []).map((id) => String(id)));
    const completedNames = new Set((progress?.completedExerciseNames || []).map((name) => String(name)));
    const nextCompleted = {};

    // Build state from the actual exercises shown on screen.
    // Do not create both an ID key and a name key for the same exercise,
    // otherwise one completed exercise can be counted twice (e.g. 8/6).
    exercises.forEach((item) => {
      const key = exerciseKey(item);
      const byId = Boolean(item?.exerciseId) && completedIds.has(String(item.exerciseId));
      const byName = !item?.exerciseId && completedNames.has(String(item.name));
      if (byId || byName) nextCompleted[key] = true;
    });

    return nextCompleted;
  }, [exercises, exerciseKey]);

  const loadProgress = useCallback(async () => {
    if (!workout?._id) return;

    try {
      setLoadingProgress(true);
      const res = await API.get(`/workouts/progress?workoutPlanId=${workout._id}&planType=${planType}&dayOfWeek=${dayOfWeek}`);
      const progress = res.data || {};
      setCompleted(buildCompletedMap(progress));
      setSelected({});
      setWorkoutCalories(Number(progress.workoutCalories || 0));
      setAttemptNumber(Number(progress.attemptNumber || 1));
      setCompletedToday(Boolean(progress.completedToday));
    } catch (err) {
      console.warn("Failed to load workout progress:", err?.message);
    } finally {
      setLoadingProgress(false);
    }
  }, [workout?._id, planType, dayOfWeek, buildCompletedMap]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const showCalorieToast = useCallback((amount) => {
    setCalorieToast(amount);
    Animated.sequence([
      Animated.spring(calorieToastAnim, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.delay(2600),
      Animated.timing(calorieToastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setCalorieToast(null));
  }, [calorieToastAnim]);

  const showStatusToast = useCallback((message) => {
    setStatusToast(message);
    Animated.sequence([
      Animated.spring(statusToastAnim, { toValue: 1, useNativeDriver: true, friction: 7 }),
      Animated.delay(2200),
      Animated.timing(statusToastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setStatusToast(null));
  }, [statusToastAnim]);

  const toggleExerciseSelection = useCallback((item) => {
    const key = exerciseKey(item);
    if (completed[key] || syncing) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }, [completed, syncing, exerciseKey]);

  const confirmSelectedExercises = useCallback(async () => {
    const selectedExercises = exercises.filter((item) => {
      const key = exerciseKey(item);
      return selected[key] && !completed[key];
    });
    if (!workout?._id || selectedExercises.length === 0 || syncing) return;

    setSyncing(true);
    try {
      const res = await API.post("/workouts/exercises-confirm", {
        workoutPlanId: workout._id,
        planType,
        dayOfWeek,
        exerciseIds: selectedExercises.filter((item) => item.exerciseId).map((item) => String(item.exerciseId)),
        exerciseNames: selectedExercises.filter((item) => !item.exerciseId).map((item) => item.name),
      });

      const progress = res.data?.progress || {};
      setCompleted(buildCompletedMap(progress));
      setSelected({});
      setWorkoutCalories(Number(progress.workoutCalories || 0));
      setCompletedToday(Boolean(progress.completedToday));
      setAttemptNumber(Number(progress.attemptNumber || 1));

      const added = Number(res.data?.caloriesAdded || 0);
      if (added > 0) showCalorieToast(added);
    } catch (err) {
      showToast("Your selected exercises were not recorded. Please try again.", { title: "Couldn't record exercises", type: "error" });
      console.warn("Failed to confirm exercises:", err?.message);
    } finally {
      setSyncing(false);
    }
  }, [completed, selected, syncing, showCalorieToast, workout?._id, planType, dayOfWeek, exercises, exerciseKey, buildCompletedMap]);

  const retryWorkout = useCallback(() => {
    Alert.alert(
      "Retry today's workout?",
      "Your previous attempt stays recorded. A fresh attempt will start with all exercises unselected, and calories will be counted again only when you actually complete them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Retry",
          style: "default",
          onPress: async () => {
            try {
              const res = await API.post("/workouts/retry", { workoutPlanId: workout._id, planType, dayOfWeek });
              const progress = res.data?.progress || {};
              setCompleted({});
              setSelected({});
              setSyncing(false);
              setWorkoutCalories(Number(progress.workoutCalories || 0));
              setAttemptNumber(Number(progress.attemptNumber || 1));
              setCompletedToday(Boolean(progress.completedToday));
              showStatusToast(`Retry attempt ${progress.attemptNumber || 1} started`);
            } catch (err) {
              showToast("Please try again.", { title: "Couldn't start retry", type: "error" });
              console.warn("Failed to start workout retry:", err?.message);
            }
          },
        },
      ],
    );
  }, [showStatusToast, workout?._id, planType, dayOfWeek]);

  const completedCount = useMemo(
    () => Object.values(completed).filter(Boolean).length,
    [completed],
  );
  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected],
  );
  const selectedCalories = useMemo(() => {
    return exercises.reduce((sum, item) => {
      const key = exerciseKey(item);
      if (!selected[key] || completed[key]) return sum;
      return sum + Number(item.caloriesPerExercise || workout?.caloriesPerExercise || 0);
    }, 0);
  }, [exercises, selected, completed]);
  const total = exercises.length;
  const pct = total > 0 ? completedCount / total : 0;
  const allDone = completedCount === total && total > 0;
  const currentDateLabel = useMemo(() => todayLabel(), []);

  const renderItem = useCallback(({ item, index }) => (
    <ExerciseCard
      item={item}
      isCompleted={!!completed[exerciseKey(item)]}
      isSelected={!!selected[exerciseKey(item)]}
      isSyncing={syncing}
      onToggleSelect={toggleExerciseSelection}
      delay={index * 40}
    />
  ), [completed, selected, syncing, toggleExerciseSelection]);

  const ListHeader = useMemo(() => (
    <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerSlide }] }}>
      <LinearGradient colors={[COLORS.primaryDark, COLORS[700]]} style={styles.hero}>
        <View style={styles.heroDecor} />
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </Pressable>
        <View style={styles.heroBadgeWrap}>
          <Ionicons name="calendar-outline" size={11} color="#FACC15" style={{ marginRight: 5 }} />
          <Text style={styles.heroBadge}>TODAY • {currentDateLabel.toUpperCase()}</Text>
        </View>
        <Text style={styles.heroTitle}>{workout?.title}</Text>
        <Text style={styles.heroSub}>
          Day {workout?.day} · Attempt {attemptNumber} · {total} exercises
        </Text>
        <ProgressBar pct={pct} completedCount={completedCount} total={total} allDone={allDone} />
      </LinearGradient>
      <StatsRow total={total} completedCount={completedCount} workoutCalories={workoutCalories} />
      {completedToday && !allDone && (
        <View style={styles.historyBanner}>
          <Ionicons name="checkmark-circle" size={17} color="#16A34A" />
          <Text style={styles.historyBannerText}>
            You already completed a full attempt today. This is retry attempt {attemptNumber}.
          </Text>
        </View>
      )}
      <Text style={styles.sectionLabel}>EXERCISES</Text>
    </Animated.View>
  ), [headerOpacity, headerSlide, router, currentDateLabel, workout, attemptNumber, total, pct, completedCount, allDone, workoutCalories, completedToday]);

  const ListFooter = useMemo(() => (
    <View>
      {selectedCount > 0 && !allDone && (
        <View style={styles.confirmSection}>
          <View style={styles.confirmSummary}>
            <View>
              <Text style={styles.confirmTitle}>{selectedCount} exercise{selectedCount === 1 ? "" : "s"} selected</Text>
              <Text style={styles.confirmSub}>Confirm only after you finish these exercises</Text>
            </View>
            <Text style={styles.confirmKcal}>+{Math.round(selectedCalories)} kcal</Text>
          </View>
          <Pressable
            onPress={confirmSelectedExercises}
            disabled={syncing}
            style={({ pressed }) => [styles.confirmBtn, pressed && styles.confirmBtnPressed, syncing && styles.confirmBtnDisabled]}
          >
            <LinearGradient colors={[COLORS.primary, COLORS.primaryDark]} style={styles.confirmBtnGradient}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.confirmBtnText}>{syncing ? "Recording…" : "Done — Record Exercises"}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
      {allDone && (
    <View style={[styles.doneCard, shadow(6, "#22C55E")]}>
      <Ionicons name="trophy" size={40} color="#22C55E" style={{ marginBottom: 12 }} />
      <Text style={styles.doneTitle}>Workout Complete!</Text>
      <Text style={styles.doneSub}>
        {completedCount}/{total} exercises · {Math.round(workoutCalories)} kcal burned
      </Text>
      <Text style={styles.doneDate}>Recorded for {currentDateLabel}</Text>
      <Pressable onPress={retryWorkout} style={styles.retryWorkoutBtn}>
        <Ionicons name="refresh" size={16} color="#fff" />
        <Text style={styles.retryWorkoutText}>Retry Workout</Text>
      </Pressable>
    </View>
      )}
    </View>
  ), [allDone, selectedCount, selectedCalories, syncing, confirmSelectedExercises, completedCount, total, workoutCalories, currentDateLabel, retryWorkout]);

  if (!workout || !Array.isArray(workout.exercises)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>No workout data found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={exercises}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={8}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        refreshing={loadingProgress}
        onRefresh={loadProgress}
      />

      {calorieToast != null && (
        <Animated.View
          style={[
            styles.calorieToast,
            {
              opacity: calorieToastAnim,
              transform: [{
                translateY: calorieToastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
              }],
            },
          ]}
        >
          <View style={styles.calorieToastIconWrap}>
            <Ionicons name="flame" size={16} color="#F97316" />
          </View>
          <Text style={styles.calorieToastText}>
            +{calorieToast} kcal added to today's Active Burn
          </Text>
        </Animated.View>
      )}

      {statusToast != null && (
        <Animated.View
          style={[
            styles.statusToast,
            {
              opacity: statusToastAnim,
              transform: [{
                translateY: statusToastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
              }],
            },
          ]}
        >
          <Ionicons name="refresh-circle" size={18} color="#6339B8" />
          <Text style={styles.statusToastText}>{statusToast}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: COLORS.textMuted, fontSize: 15, fontWeight: "600" },

  calorieToast: {
    position: "absolute", left: 20, right: 20, bottom: 24,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: "#F9731630", ...shadow(10),
  },
  calorieToastIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#F973161A", alignItems: "center", justifyContent: "center",
  },
  calorieToastText: { flex: 1, fontSize: 13, fontWeight: "700", color: COLORS.textDark },

  statusToast: {
    position: "absolute", left: 20, right: 20, bottom: 24,
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: "#6339B830", ...shadow(10),
  },
  statusToastText: { flex: 1, fontSize: 13, fontWeight: "700", color: COLORS.textDark },

  hero: {
    padding: 24, paddingTop: 16, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  heroDecor: {
    position: "absolute", width: 260, height: 260,
    borderRadius: 130, borderWidth: 50,
    borderColor: "rgba(255,255,255,0.03)", right: -80, top: -80,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center", marginBottom: 20,
  },
  heroBadgeWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.15)",
    borderWidth: 1, borderColor: "rgba(250,204,21,0.3)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: "flex-start", marginBottom: 12,
  },
  heroBadge: { color: "#FACC15", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.6, marginBottom: 6 },
  heroSub: { fontSize: 14, color: "#B8AFD6", marginBottom: 20 },

  progressWrap: { marginTop: 0 },
  progressBar: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 8 },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: "#22C55E" },
  progressLabelRow: { flexDirection: "row", alignItems: "center" },
  progressLabel: { fontSize: 12, color: "#B8AFD6", fontWeight: "600" },

  statRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 16,
    backgroundColor: COLORS.surface, marginBottom: 10,
  },
  statPill: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 21, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },

  historyBanner: {
    marginHorizontal: 20, marginBottom: 16, paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 12, backgroundColor: "#ECFDF5", flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: "#22C55E30",
  },
  historyBannerText: { flex: 1, fontSize: 12, lineHeight: 17, color: "#166534", fontWeight: "700" },

  sectionLabel: { fontSize: 11, fontWeight: "800", color: COLORS.textLight, letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 20 },

  card: {
    backgroundColor: COLORS.surfaceMuted, borderRadius: 20,
    marginHorizontal: 20, marginBottom: 12,
    flexDirection: "row", alignItems: "center",
    padding: 14, overflow: "hidden",
  },
  cardIdle: { backgroundColor: COLORS.surfaceMuted, borderColor: COLORS.border, borderWidth: 1 },
  cardCompleted: { opacity: 0.58, backgroundColor: COLORS.surface },
  cardDoneTint: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(34,197,94,0.04)", borderWidth: 1.5,
    borderColor: "#22C55E40", borderRadius: 20,
  },
  iconWrap: {
    width: 68, height: 68, borderRadius: 16,
    backgroundColor: COLORS.surfaceMuted,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  iconWrapDone: { backgroundColor: "#DCFCE7" },
  cardIcon: { width: 52, height: 52 },

  cardMid: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  exerciseName: { flexShrink: 1, fontSize: 15, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.2 },
  exerciseNameDone: { color: COLORS.textMuted, textDecorationLine: "line-through" },
  doneBadge: {
    flexDirection: "row", alignItems: "center", marginLeft: 7,
    backgroundColor: "#DCFCE7", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3,
  },
  doneBadgeText: { marginLeft: 3, color: "#16A34A", fontSize: 9, fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceMuted, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  metaPillGap: { marginLeft: 6 },
  metaText: { fontSize: 11, color: COLORS.textLight, fontWeight: "600" },
  calorieRow: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  calorieText: { marginLeft: 4, fontSize: 11, color: "#EA580C", fontWeight: "800" },
  syncText: { marginLeft: 7, fontSize: 10, color: COLORS.textMuted, fontWeight: "700" },

  checkWrap: { paddingLeft: 4 },
  checkDone: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  checkEmpty: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: COLORS.border },

  doneCard: {
    margin: 20, backgroundColor: COLORS.surface, borderRadius: 20, padding: 28,
    alignItems: "center", borderWidth: 1.5, borderColor: "#22C55E30",
  },
  doneTitle: { fontSize: 20, fontWeight: "800", color: COLORS.textDark, marginBottom: 6 },
  doneSub: { fontSize: 14, color: COLORS.textMuted, fontWeight: "600", textAlign: "center" },
  doneDate: { fontSize: 12, color: COLORS.textLight, marginTop: 5, fontWeight: "600" },
  retryWorkoutBtn: {
    marginTop: 16, flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: COLORS.primaryDark, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12,
  },
  cardSelected: { borderWidth: 1.5, borderColor: "#8B5CF6", backgroundColor: "#F7F2FF" },
  selectedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, marginLeft: 6,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: "#F1EAFE",
  },
  selectedBadgeText: { fontSize: 10, fontWeight: "800", color: "#6339B8" },
  checkSelected: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: "#8B5CF6",
    backgroundColor: "#F1EAFE", alignItems: "center", justifyContent: "center",
  },
  confirmSection: { marginHorizontal: 20, marginTop: 18, marginBottom: 8 },
  confirmSummary: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 10, paddingHorizontal: 4,
  },
  confirmTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark },
  confirmSub: { marginTop: 3, fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
  confirmKcal: { fontSize: 16, fontWeight: "800", color: "#F97316" },
  confirmBtn: { borderRadius: 16, overflow: "hidden", ...shadow(5) },
  confirmBtnPressed: { transform: [{ scale: 0.98 }] },
  confirmBtnDisabled: { opacity: 0.65 },
  confirmBtnGradient: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  confirmBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  retryWorkoutText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
