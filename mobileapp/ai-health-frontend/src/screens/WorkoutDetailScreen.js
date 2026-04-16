import React, { useEffect, useState, useCallback, memo, useRef } from "react";
import {
  Animated, View, Text, StyleSheet, FlatList,
  Pressable, InteractionManager, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { EXERCISE_SVGS } from "../constants/exerciseSvgs";
import SkeletonCard from "../components/SkeletonCard";

const { width } = Dimensions.get("window");

// ── Exercise Card ─────────────────────────────────────────────────────────────
const ExerciseCard = memo(function ExerciseCard({ item, isCompleted, onToggle, delay = 0 }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, [delay]);

  const onIn  = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  const SvgIcon = EXERCISE_SVGS[item.imageKey] || EXERCISE_SVGS.default;

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
    }}>
      <Pressable onPress={() => onToggle(item.name)} onPressIn={onIn} onPressOut={onOut}>
        <View style={[styles.card, isCompleted && styles.cardCompleted]}>
          {/* Completion overlay tint */}
          {isCompleted && <View style={styles.cardDoneTint} />}

          {/* Left: SVG icon */}
          <View style={[styles.iconWrap, isCompleted && styles.iconWrapDone]}>
            {SvgIcon
              ? <SvgIcon width={52} height={52} />
              : <Text style={styles.iconFallback}>💪</Text>
            }
          </View>

          {/* Middle: name + meta */}
          <View style={styles.cardMid}>
            <Text style={[styles.exerciseName, isCompleted && styles.exerciseNameDone]}
              numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaText}>🔁 {item.sets ?? "—"} sets</Text>
              </View>
              <View style={styles.metaPill}>
                <Text style={styles.metaText}>✕ {item.reps ?? "—"} reps</Text>
              </View>
              {item.rest && (
                <View style={styles.metaPill}>
                  <Text style={styles.metaText}>⏱ {item.rest}s</Text>
                </View>
              )}
            </View>
          </View>

          {/* Right: checkbox */}
          <Pressable onPress={() => onToggle(item.name)} style={styles.checkWrap}>
            {isCompleted
              ? (
                <LinearGradient colors={["#22C55E", "#16A34A"]} style={styles.checkDone}>
                  <Text style={styles.checkDoneText}>✓</Text>
                </LinearGradient>
              )
              : <View style={styles.checkEmpty} />
            }
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WorkoutDetailScreen({ route, navigation }) {
  const workout = route?.params?.workout;
  const [completed, setCompleted] = useState({});
  const [ready, setReady]         = useState(false);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide   = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      setReady(true);
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headerSlide,   { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  if (!workout || !Array.isArray(workout.exercises)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading workout…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const toggleExercise = useCallback((name) => {
    setCompleted((prev) => ({ ...prev, [name]: !prev?.[name] }));
  }, []);

  const completedCount = Object.values(completed).filter(Boolean).length;
  const total          = workout.exercises.length;
  const pct            = total > 0 ? completedCount / total : 0;
  const allDone        = completedCount === total && total > 0;

  const renderItem = useCallback(({ item, index }) => (
    <ExerciseCard
      item={item}
      isCompleted={!!completed[item.name]}
      onToggle={toggleExercise}
      delay={index * 70}
    />
  ), [completed, toggleExercise]);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={ready ? workout.exercises : []}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}

        ListHeaderComponent={() => (
          <Animated.View style={{ opacity: headerOpacity, transform: [{ translateY: headerSlide }] }}>
            {/* ── HERO ── */}
            <LinearGradient colors={["#0F172A", "#1E293B"]} style={styles.hero}>
              {/* Decorative circle */}
              <View style={styles.heroDecor} />

              <Pressable onPress={() => navigation?.goBack()} style={styles.backBtn}>
                <Text style={styles.backIcon}>←</Text>
              </Pressable>

              <View style={styles.heroBadgeWrap}>
                <Text style={styles.heroBadge}>🗓  DAY {workout.day}</Text>
              </View>
              <Text style={styles.heroTitle}>{workout.title}</Text>
              <Text style={styles.heroSub}>{total} exercises · Build strength & endurance</Text>

              {/* Progress bar */}
              <View style={styles.progressWrap}>
                <View style={styles.progressBar}>
                  <Animated.View style={[styles.progressFill, { width: `${Math.round(pct * 100)}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                  {allDone ? "🎉 Workout complete!" : `${completedCount} / ${total} done`}
                </Text>
              </View>
            </LinearGradient>

            {/* ── STAT PILLS ── */}
            <View style={styles.statRow}>
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

            <Text style={styles.sectionLabel}>EXERCISES</Text>

            {/* Skeleton while loading */}
            {!ready && (
              <>
                <SkeletonCard /><SkeletonCard />
                <SkeletonCard /><SkeletonCard />
              </>
            )}
          </Animated.View>
        )}

        ListFooterComponent={() =>
          ready && allDone ? (
            <View style={styles.doneCard}>
              <Text style={styles.doneEmoji}>🎉</Text>
              <Text style={styles.doneTitle}>Workout Complete!</Text>
              <Text style={styles.doneSub}>Great job — you crushed it today.</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F8FAFC" },
  listContent: { paddingBottom: 40 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { color: "#94A3B8", fontSize: 15, fontWeight: "600" },

  // Hero
  hero: {
    padding: 24, paddingTop: 16, paddingBottom: 28,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    marginBottom: 0, overflow: "hidden",
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

  progressWrap: { gap: 8 },
  progressBar: {
    height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%", borderRadius: 3,
    backgroundColor: "#22C55E",
  },
  progressLabel: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },

  // Stat row
  statRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    boxShadow: "0px 2px 10px rgba(15,23,42,0.07)",
    marginBottom: 20,
  },
  statPill:  { flex: 1, alignItems: "center" },
  statNum:   { fontSize: 22, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: "#94A3B8", marginTop: 3, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: "#CBD5E1",
    letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 20,
  },

  // Exercise card
  card: {
    backgroundColor: "#fff", borderRadius: 20,
    marginHorizontal: 20, marginBottom: 12,
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 12, overflow: "hidden",
    boxShadow: "0px 2px 10px rgba(15,23,42,0.07)",
  },
  cardCompleted: { opacity: 0.75 },
  cardDoneTint: {
    position: "absolute", inset: 0,
    backgroundColor: "rgba(34,197,94,0.04)",
    borderWidth: 1.5, borderColor: "#22C55E40",
    borderRadius: 20,
  },

  iconWrap: {
    width: 68, height: 68, borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center", alignItems: "center",
  },
  iconWrapDone: { backgroundColor: "#DCFCE7" },
  iconFallback: { fontSize: 28 },

  cardMid: { flex: 1 },
  exerciseName: {
    fontSize: 15, fontWeight: "800",
    color: "#0F172A", marginBottom: 8, letterSpacing: -0.2,
  },
  exerciseNameDone: { color: "#94A3B8", textDecorationLine: "line-through" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaPill: {
    backgroundColor: "#F1F5F9", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  metaText: { fontSize: 11, color: "#64748B", fontWeight: "600" },

  // Checkbox
  checkWrap: { paddingLeft: 4 },
  checkDone: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
  },
  checkDoneText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  checkEmpty: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: "#E2E8F0",
  },

  // Done card
  doneCard: {
    margin: 20, backgroundColor: "#fff",
    borderRadius: 22, padding: 28,
    alignItems: "center",
    boxShadow: "0px 4px 16px rgba(34,197,94,0.15)",
    borderWidth: 1.5, borderColor: "#22C55E30",
  },
  doneEmoji: { fontSize: 44, marginBottom: 12 },
  doneTitle: { fontSize: 20, fontWeight: "900", color: "#0F172A", marginBottom: 6 },
  doneSub:   { fontSize: 14, color: "#94A3B8", fontWeight: "500" },
});