import {
  useEffect, useState, useCallback, memo, useRef, useMemo,
} from "react";
import {
  Animated, View, Text, StyleSheet, FlatList,
  Pressable, Dimensions, Platform, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { EXERCISE_IMAGES } from "../constants/exerciseImages";
import { COLORS } from "../constants/theme";
import API from "../services/api";
const { width } = Dimensions.get("window");

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

// ── Exercise Card ─────────────────────────────────────────────────────────────
const ExerciseCard = memo(function ExerciseCard({ item, isCompleted, onToggle, delay = 0 }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);

  const onIn  = useCallback(() =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start(), [scaleAnim]);
  const onOut = useCallback(() =>
    Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start(), [scaleAnim]);

  const handleToggle = useCallback(() => onToggle(item.name), [item.name, onToggle]);

  const imageSource = EXERCISE_IMAGES[item.imageKey] ?? EXERCISE_IMAGES.default;

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
    }}>
      <Pressable
        onPress={handleToggle} onPressIn={onIn} onPressOut={onOut}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isCompleted }}
        accessibilityLabel={`${item.name}, ${item.sets ?? "—"} sets of ${item.reps ?? "—"} reps`}
      >
        <View style={[styles.card, shadow(3), isCompleted && styles.cardCompleted]}>
          {isCompleted && <View style={styles.cardDoneTint} />}

          <View style={[styles.iconWrap, isCompleted && styles.iconWrapDone]}>
            <Image
              source={imageSource}
              style={styles.cardIcon}
              resizeMode="contain"
            />
          </View>

          <View style={styles.cardMid}>
            <Text style={[styles.exerciseName, isCompleted && styles.exerciseNameDone]}
              numberOfLines={1}>
              {item.name}
            </Text>
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
          </View>

          <Pressable onPress={handleToggle} hitSlop={8} style={styles.checkWrap}>
            {isCompleted ? (
              <LinearGradient colors={["#22C55E", "#16A34A"]} style={styles.checkDone}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </LinearGradient>
            ) : (
              <View style={styles.checkEmpty} />
            )}
          </Pressable>
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
  }, [pct]);

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
const StatsRow = memo(function StatsRow({ total, completedCount }) {
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
        <Text style={styles.statNum}>{total - completedCount}</Text>
        <Text style={styles.statLabel}>Remaining</Text>
      </View>
    </View>
  );
});

const keyExtractor = (item) => item.name;

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { workout: workoutParam } = useLocalSearchParams();

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

  const [completed, setCompleted] = useState({});

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide   = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(headerSlide,   { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);

  const toggleExercise = useCallback((name) => {
    setCompleted((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const completedCount = useMemo(
    () => Object.values(completed).filter(Boolean).length,
    [completed],
  );
  const total   = exercises.length;
  const pct     = total > 0 ? completedCount / total : 0;
  const allDone = completedCount === total && total > 0;

  const hasLoggedCompletion = useRef(false);

  useEffect(() => {
    if (allDone && !hasLoggedCompletion.current && workout?._id) {
      hasLoggedCompletion.current = true;
      API.post("/workouts/complete", { workoutPlanId: workout._id }).catch((err) => {
        console.warn("Failed to sync workout completion:", err?.message);
        hasLoggedCompletion.current = false;
      });
    }
  }, [allDone, workout]);

  const renderItem = useCallback(({ item, index }) => (
    <ExerciseCard
      item={item}
      isCompleted={!!completed[item.name]}
      onToggle={toggleExercise}
      delay={index * 40}
    />
  ), [completed, toggleExercise]);

  const ListHeader = useMemo(() => (
    <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerSlide }] }}>
      <LinearGradient colors={["#170F36", "#49225B"]} style={styles.hero}>
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
          <Text style={styles.heroBadge}>DAY {workout?.day}</Text>
        </View>
        <Text style={styles.heroTitle}>{workout?.title}</Text>
        <Text style={styles.heroSub}>{total} exercises · Build strength & endurance</Text>
        <ProgressBar pct={pct} completedCount={completedCount} total={total} allDone={allDone} />
      </LinearGradient>
      <StatsRow total={total} completedCount={completedCount} />
      <Text style={styles.sectionLabel}>EXERCISES</Text>
    </Animated.View>
  ), [pct, completedCount, total, allDone, workout]);

  const ListFooter = useMemo(() => allDone ? (
    <View style={[styles.doneCard, shadow(6, "#22C55E")]}>
      <Ionicons name="trophy" size={40} color="#22C55E" style={{ marginBottom: 12 }} />
      <Text style={styles.doneTitle}>Workout Complete!</Text>
      <Text style={styles.doneSub}>Great job — you crushed it today.</Text>
    </View>
  ) : null, [allDone]);

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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  listContent: { paddingBottom: 40 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: COLORS.textMuted, fontSize: 15, fontWeight: "600" },

  hero: {
    padding: 24, paddingTop: 16, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    overflow: "hidden",
  },
  heroDecor: {
    position: "absolute", width: 260, height: 260,
    borderRadius: 130, borderWidth: 50,
    borderColor: "rgba(255,255,255,0.03)",
    right: -80, top: -80,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center",
    marginBottom: 20,
  },
  heroBadgeWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(250,204,21,0.15)",
    borderWidth: 1, borderColor: "rgba(250,204,21,0.3)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: "flex-start", marginBottom: 12,
  },
  heroBadge:  { color: "#FACC15", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  heroTitle:  { fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -0.6, marginBottom: 6 },
  heroSub:    { fontSize: 14, color: "#B8AFD6", marginBottom: 20 },

  progressWrap:     { marginTop: 0 },
  progressBar:      { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden", marginBottom: 8 },
  progressFill:     { height: "100%", borderRadius: 3, backgroundColor: "#22C55E" },
  progressLabelRow: { flexDirection: "row", alignItems: "center" },
  progressLabel:    { fontSize: 12, color: "#B8AFD6", fontWeight: "600" },

  statRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: COLORS.surface, marginBottom: 20,
  },
  statPill:  { flex: 1, alignItems: "center" },
  statNum:   { fontSize: 22, fontWeight: "900", color: COLORS.textDark, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: COLORS.textMuted, marginTop: 3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },

  sectionLabel: { fontSize: 11, fontWeight: "800", color: COLORS.textLight, letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 20 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    marginHorizontal: 20, marginBottom: 12,
    flexDirection: "row", alignItems: "center",
    padding: 14, overflow: "hidden",
  },
  cardCompleted: { opacity: 0.75 },
  cardDoneTint: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(34,197,94,0.04)",
    borderWidth: 1.5, borderColor: "#22C55E40", borderRadius: 20,
  },
  iconWrap: {
    width: 68, height: 68, borderRadius: 18,
    backgroundColor: COLORS.surfaceMuted,
    justifyContent: "center", alignItems: "center",
    marginRight: 12,
  },
  iconWrapDone: { backgroundColor: "#DCFCE7" },
  cardIcon:     { width: 52, height: 52 },

  cardMid:          { flex: 1, marginRight: 12 },
  exerciseName:     { fontSize: 15, fontWeight: "800", color: COLORS.textDark, marginBottom: 8, letterSpacing: -0.2 },
  exerciseNameDone: { color: COLORS.textMuted, textDecorationLine: "line-through" },
  metaRow:          { flexDirection: "row", flexWrap: "wrap" },
  metaPill:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.surfaceMuted, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  metaPillGap:      { marginLeft: 6 },
  metaText:         { fontSize: 11, color: COLORS.textLight, fontWeight: "600" },

  checkWrap:     { paddingLeft: 4 },
  checkDone:     { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  checkEmpty:    { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: COLORS.border },

  doneCard: {
    margin: 20, backgroundColor: COLORS.surface, borderRadius: 22, padding: 28,
    alignItems: "center", borderWidth: 1.5, borderColor: "#22C55E30",
  },
  doneTitle: { fontSize: 20, fontWeight: "900", color: COLORS.textDark, marginBottom: 6 },
  doneSub:   { fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
});
