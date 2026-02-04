import React, { useEffect, useState, useCallback, memo, useRef } from "react";
import { Animated } from "react-native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  InteractionManager,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, SHADOW } from "../constants/theme";
import { EXERCISE_SVGS } from "../constants/exerciseSvgs";
import SkeletonCard from "../components/SkeletonCard";


/* =======================
   MEMOIZED EXERCISE CARD
   ======================= */
const ExerciseCard = memo(function ExerciseCard({
  item,
  isCompleted,
  onToggle,
  delay = 0, 
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      delay: delay,
      useNativeDriver: true,
    }).start();
  }, [delay]);

  const SvgIcon =
    EXERCISE_SVGS[item.imageKey] || EXERCISE_SVGS.default;
  const [showSvgs, setShowSvgs] = useState(false);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
    <Pressable
      style={[
        styles.exerciseCard,
        isCompleted && styles.completedCard,
      ]}
      onPress={() => onToggle(item.name)}
    >
      <View style={styles.row}>
        {SvgIcon && <SvgIcon width={96} height={96} />}

        <View style={styles.textWrap}>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <Text style={styles.exerciseMeta}>
            {item.sets ?? "-"} sets × {item.reps ?? "-"}
          </Text>
        </View>

        <View style={styles.checkbox}>
          <Text style={styles.checkText}>
            {isCompleted ? "✔" : "○"}
          </Text>
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
});

/* =======================
   MAIN SCREEN
   ======================= */
export default function WorkoutDetailScreen({ route }) {
  const workout = route?.params?.workout;

  const [completed, setCompleted] = useState({});
  const [ready, setReady] = useState(false);

  // ⏳ Let navigation animation finish first
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      setReady(true);
    });
  }, []);

  

  // 🛑 Guard
  if (!workout || !Array.isArray(workout.exercises)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text>Loading workout...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const toggleExercise = useCallback((name) => {
    setCompleted((prev) => ({
      ...prev,
      [name]: !prev?.[name],
    }));
  }, []);

  const completedCount = Object.values(completed).filter(Boolean).length;
  const total = workout.exercises.length;

  const renderItem = useCallback(
  ({ item, index }) => (
    <ExerciseCard
      item={item}
      isCompleted={!!completed[item.name]}
      onToggle={toggleExercise}
      delay={index * 80}

    />
  ),
  [completed, toggleExercise]
);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>
          Day {workout.day} – {workout.title}
        </Text>

        <Text style={styles.progress}>
          {completedCount} / {total} exercises completed
        </Text>

        {!ready ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
    ) : (
      <FlatList
        data={workout.exercises}
        keyExtractor={(item) => item.name}
        renderItem={renderItem}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    )}

      </View>
    </SafeAreaView>
  );
}

/* =======================
   STYLES
   ======================= */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textDark,
    marginBottom: 6,
  },
  progress: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 14,
  },
  exerciseCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    ...SHADOW,
  },
  completedCard: {
    opacity: 0.6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  textWrap: {
    flex: 1,
    marginLeft: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  exerciseMeta: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 2,
  },
  checkbox: {
    width: 30,
    alignItems: "center",
  },
  checkText: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primary,
  },
});
