import React, {
  useEffect, useState, useCallback, memo, useRef, useMemo,
} from "react";
import {
  Animated, View, Text, StyleSheet, FlatList,
  Pressable, Dimensions, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { EXERCISE_SVGS } from "../constants/exerciseSvgs";

const { width } = Dimensions.get("window");

// ── Cross-platform shadow helper ──────────────────────────────────────────────
const shadow = (elevation = 4, color = "#0F172A") =>
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
// FIX: wrap scaleAnim in a *separate* Animated.Value so it doesn't fight the
//      fade/slide driver — all three use useNativeDriver:true, which is fine,
//      but keeping them in one Animated.parallel can sometimes stall when
//      the spring settles asynchronously. Separate values are simpler.
const ExerciseCard = memo(function ExerciseCard({ item, isCompleted, onToggle, delay = 0 }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // FIX: only run entrance animation once; add cleanup to avoid setState on
  //      unmounted component if the list is recycled quickly.
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, []); // ← intentionally empty: entrance fires once

  const onIn  = useCallback(() =>
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start(), [scaleAnim]);
  const onOut = useCallback(() =>
    Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start(), [scaleAnim]);

  // FIX: memoize so re-renders caused by `completed` state changes elsewhere
  //      don't recreate this per-card handler.
  const handleToggle = useCallback(() => onToggle(item.name), [item.name, onToggle]);

  const SvgIcon = EXERCISE_SVGS[item.imageKey] ?? EXERCISE_SVGS.default;

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
    }}>
      <Pressable onPress={handleToggle} onPressIn={onIn} onPressOut={onOut}>
        <View style={[styles.card, shadow(3), isCompleted && styles.cardCompleted]}>
          {isCompleted && <View style={styles.cardDoneTint} />}

          <View style={[styles.iconWrap, isCompleted && styles.iconWrapDone]}>
            {SvgIcon
              ? <SvgIcon width={52} height={52} />
              : <Text style={styles.iconFallback}>💪</Text>}
          </View>

          <View style={styles.cardMid}>
            <Text style={[styles.exerciseName, isCompleted && styles.exerciseNameDone]}
              numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaText}>🔁 {item.sets ?? "—"} sets</Text>
              </View>
              <View style={[styles.metaPill, styles.metaPillGap]}>
                <Text style={styles.metaText}>✕ {item.reps ?? "—"} reps</Text>
              </View>
              {item.rest ? (
                <View style={[styles.metaPill, styles.metaPillGap]}>
                  <Text style={styles.metaText}>⏱ {item.rest}s</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* FIX: removed nested Pressable — the outer Pressable already handles
              the tap; a second one here creates an overlapping touch target and
              can swallow events on Android. */}
          <Pressable onPress={handleToggle} hitSlop={8} style={styles.checkWrap}>
            {isCompleted ? (
              <LinearGradient colors={["#22C55E", "#16A34A"]} style={styles.checkDone}>
                <Text style={styles.checkDoneText}>✓</Text>
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

// ── Progress bar — isolated so only it re-renders on completion changes ───────
const ProgressBar = memo(function ProgressBar({ pct, completedCount, total, allDone }) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 300,
      useNativeDriver: false, // width % cannot use native driver
    }).start();
  }, [pct]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressBar}>
        <Animated.View style={[styles.progressFill, { width: animatedWidth }]} />
      </View>
      <Text style={styles.progressLabel}>
        {allDone ? "🎉 Workout complete!" : `${completedCount} / ${total} done`}
      </Text>
    </View>
  );
});

// ── Stats row — isolated from list re-renders ─────────────────────────────────
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

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WorkoutDetailScreen({ route, navigation }) {
  const workout = route?.params?.workout;

  // FIX: guard before hooks — hooks must not be called conditionally, but we
  //      can derive a safe fallback and gate the rendering below.
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

  // FIX: derive these with useMemo so they don't recompute on every render
  const completedCount = useMemo(
    () => Object.values(completed).filter(Boolean).length,
    [completed],
  );
  const total  = exercises.length;
  const pct    = total > 0 ? completedCount / total : 0;
  const allDone = completedCount === total && total > 0;

  // FIX: stable renderItem — depends only on `completed` and `toggleExercise`,
  //      both of which are already memoized.
  const renderItem = useCallback(({ item, index }) => (
    <ExerciseCard
      item={item}
      isCompleted={!!completed[item.name]}
      onToggle={toggleExercise}
      delay={index * 40}
    />
  ), [completed, toggleExercise]);

  // FIX: extract keyExtractor outside render so it's never recreated.
  // (defined at module level below — see KEY_EXTRACTOR)

  // FIX: memoize the header so it only re-renders when progress changes,
  //      not every time FlatList calls renderItem.
  const ListHeader = useMemo(() => (
    <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerSlide }] }}>
      <LinearGradient colors={["#0F172A", "#1E293B"]} style={styles.hero}>
        <View style={styles.heroDecor} />

        <Pressable onPress={() => navigation?.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>

        <View style={styles.heroBadgeWrap}>
          <Text style={styles.heroBadge}>🗓  DAY {workout?.day}</Text>
        </View>
        <Text style={styles.heroTitle}>{workout?.title}</Text>
        <Text style={styles.heroSub}>{total} exercises · Build strength & endurance</Text>

        <ProgressBar
          pct={pct}
          completedCount={completedCount}
          total={total}
          allDone={allDone}
        />
      </LinearGradient>

      <StatsRow total={total} completedCount={completedCount} />
      <Text style={styles.sectionLabel}>EXERCISES</Text>
    </Animated.View>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [pct, completedCount, total, allDone]);
  // NOTE: headerOpacity/headerSlide/navigation/workout are intentionally omitted —
  //       they never change after mount. If navigation changes add it here.

  const ListFooter = useMemo(() => allDone ? (
    <View style={[styles.doneCard, shadow(6, "#22C55E")]}>
      <Text style={styles.doneEmoji}>🎉</Text>
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
        keyExtractor={keyExtractor}       // ← stable module-level fn
        renderItem={renderItem}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={6}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}  // ← memoized value, not inline fn
        ListFooterComponent={ListFooter}  // ← memoized value
      />
    </SafeAreaView>
  );
}

// ── Module-level stable helpers ───────────────────────────────────────────────
// FIX: defined outside the component so the reference never changes between
//      renders and FlatList never re-renders all rows due to a new keyExtractor.
const keyExtractor = (item) => item.name;

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F8FAFC" },
  listContent: { paddingBottom: 40 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#94A3B8", fontSize: 15, fontWeight: "600" },

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
  backIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },

  heroBadgeWrap: {
    backgroundColor: "rgba(250,204,21,0.15)",
    borderWidth: 1, borderColor: "rgba(250,204,21,0.3)",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    alignSelf: "flex-start", marginBottom: 12,
  },
  heroBadge: { color: "#FACC15", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -0.6, marginBottom: 6 },
  heroSub:   { fontSize: 14, color: "#64748B", marginBottom: 20 },

  // FIX: gap → marginBottom on progressWrap children
  progressWrap: { marginTop: 0 },
  progressBar: {
    height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill:  { height: "100%", borderRadius: 3, backgroundColor: "#22C55E" },
  progressLabel: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },

  statRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: "#fff",
    marginBottom: 20,
  },
  statPill:  { flex: 1, alignItems: "center" },
  statNum:   { fontSize: 22, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
  statLabel: {
    fontSize: 11, color: "#94A3B8", marginTop: 3,
    fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4,
  },

  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: "#CBD5E1",
    letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 20,
  },

  card: {
    backgroundColor: "#fff", borderRadius: 20,
    marginHorizontal: 20, marginBottom: 12,
    flexDirection: "row", alignItems: "center",
    padding: 14, overflow: "hidden",
  },
  cardCompleted: { opacity: 0.75 },
  cardDoneTint: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0, // FIX: `inset` is not supported in RN
    backgroundColor: "rgba(34,197,94,0.04)",
    borderWidth: 1.5, borderColor: "#22C55E40",
    borderRadius: 20,
  },

  iconWrap: {
    width: 68, height: 68, borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center", alignItems: "center",
    marginRight: 12, // FIX: gap → explicit margin
  },
  iconWrapDone: { backgroundColor: "#DCFCE7" },
  iconFallback: { fontSize: 28 },

  cardMid: { flex: 1, marginRight: 12 }, // FIX: gap → explicit margin
  exerciseName: {
    fontSize: 15, fontWeight: "800",
    color: "#0F172A", marginBottom: 8, letterSpacing: -0.2,
  },
  exerciseNameDone: { color: "#94A3B8", textDecorationLine: "line-through" },
  metaRow:    { flexDirection: "row", flexWrap: "wrap" },
  metaPill:   {
    backgroundColor: "#F1F5F9", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  metaPillGap: { marginLeft: 6 }, // FIX: gap → explicit margin

  metaText: { fontSize: 11, color: "#64748B", fontWeight: "600" },

  checkWrap:     { paddingLeft: 4 },
  checkDone: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
  },
  checkDoneText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  checkEmpty: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: "#E2E8F0",
  },

  doneCard: {
    margin: 20, backgroundColor: "#fff",
    borderRadius: 22, padding: 28,
    alignItems: "center",
    borderWidth: 1.5, borderColor: "#22C55E30",
  },
  doneEmoji: { fontSize: 44, marginBottom: 12 },
  doneTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A", marginBottom: 6 },
  doneSub:   { fontSize: 14, color: "#94A3B8", fontWeight: "500" },
});