import { COLORS, SHADOW } from "../constants/theme";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import API from "../services/api";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";



export default function WorkoutScreen() {
  const navigation = useNavigation();
  const { token, userGoal } = useContext(AuthContext); // 👈 get goal from context
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("bodyweight");

useEffect(() => {
    if (!token || !userGoal) return;
    fetchWorkouts();
  }, [mode, userGoal, token]);

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/workouts?goal=${userGoal}&mode=${mode}`);
      setWorkouts(res.data);
    } catch (err) {
      setError("Failed to load workouts");
    } finally {
      setLoading(false);
    }
  }; [userGoal, mode]

  if (loading || !userGoal) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red" }}>{error}</Text>
      </View>
    );
  }

  if (workouts.length === 0) {
    return (
      <View style={styles.center}>
        <Text>No workouts available.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      {/* 🔥 TOGGLE */}
      <View style={styles.toggleRow}>
        <Pressable
          style={[
            styles.toggleBtn,
            mode === "bodyweight" && styles.activeToggle,
          ]}
          onPress={() => setMode("bodyweight")}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "bodyweight" && styles.activeText,
            ]}
          >
            No Equipment
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.toggleBtn,
            mode === "equipment" && styles.activeToggle,
          ]}
          onPress={() => setMode("equipment")}
        >
          <Text
            style={[
              styles.toggleText,
              mode === "equipment" && styles.activeText,
            ]}
          >
            With Equipment
          </Text>
        </Pressable>
      </View>

      {/* 🏋️ WORKOUT LIST */}
      <FlatList
        data={workouts}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
      <Pressable
        onPress={() =>
          navigation.navigate("WorkoutDetail", { workout: item })
        }
      >
        <View style={styles.card}>
          <Text style={styles.title}>
            Day {item.day} – {item.title}
          </Text>

          <Text style={styles.subText}>
            {item.exercises.length} exercises
          </Text>
        </View>
      </Pressable>
    )}
  />
  </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  /* 🔘 Toggle */
  toggleRow: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 6,
    marginBottom: 16,
    ...SHADOW,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  activeToggle: {
    backgroundColor: COLORS.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  activeText: {
    color: "#fff",
  },

  /* 🏋️ Cards */
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...SHADOW,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 10,
  },
  exerciseRow: {
    marginTop: 6,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textDark,
  },
  exerciseMeta: {
    fontSize: 13,
    color: COLORS.textLight,
    marginLeft: 10,
  },
});
