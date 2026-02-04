import { View, Text, StyleSheet, Pressable } from "react-native";
import { COLORS, SHADOW } from "../constants/theme";
import { useEffect, useState, useCallback, useContext } from "react";
import API from "../services/api";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import CircularProgressRing from "../components/CircularProgressRing";

export default function HomeScreen({ navigation, route }) {
  const { token } = useContext(AuthContext);
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);

  const STEP_GOAL = 10000;
  const WATER_GOAL = 3; // liters
  const SLEEP_GOAL = 8; // hours

  const fetchToday = useCallback(async () => {
  try {
    const res = await API.get("/track/today");
    setToday(res.data);
  } catch (err) {
    console.log("No tracking data for today");
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
    }, [route.params, token , fetchToday])
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.greeting}>Good Morning 👋</Text>
          <Text style={styles.subtitle}>Your health dashboard</Text>
        </View>

        <Pressable onPress={() => navigation.navigate("Profile")}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
        </Pressable>
      </View>

      {/* HERO CARD */}
      <LinearGradient
        colors={["#1F2937", "#111827"]}
        style={styles.heroCard}
      >
        <Text style={styles.heroBadge}>🔥 TODAY</Text>
        <Text style={styles.heroTitleDark}>Today’s Challenge</Text>

        <Text style={styles.heroBig}>
          {loading ? "—" : today?.steps ?? 0}
          <Text style={styles.heroUnit}> / 10000 steps</Text>
        </Text>

        <Text style={styles.heroSubDark}>
          {today?.steps >= STEP_GOAL
            ? "Goal completed 🎉"
            : "Almost there — keep moving"}
        </Text>
      </LinearGradient>

      {/* TRACK HEADER */}
      <View style={styles.trackHeader}>
        <Text style={styles.sectionTitle}>Track</Text>
        <Pressable onPress={() => navigation.navigate("Tracking")}>
          <Text style={styles.editText}>✏️ Edit Today</Text>
        </Pressable>
      </View>

      {/* 🔥 RING STATS ROW */}
      <View style={styles.ringRow}>
        <Pressable onPress={() => navigation.navigate("TrackDetail", { type: "steps" })}>
          <CircularProgressRing
            progress={Math.min((today?.steps ?? 0) / STEP_GOAL, 1)}
            valueText={loading ? "—" : `${today?.steps ?? 0}`}
            label="Steps"
            color="#22C55E"
          />
        </Pressable>

        <Pressable onPress={() => navigation.navigate("TrackDetail", { type: "water" })}>
          <CircularProgressRing
            progress={Math.min((today?.water ?? 0) / WATER_GOAL, 1)}
            valueText={loading ? "—" : `${today?.water ?? 0} L`}
            label="Water"
            color="#3B82F6"
          />
        </Pressable>

        <Pressable onPress={() => navigation.navigate("TrackDetail", { type: "sleep" })}>
          <CircularProgressRing
            progress={Math.min((today?.sleep ?? 0) / SLEEP_GOAL, 1)}
            valueText={loading ? "—" : `${today?.sleep ?? 0} h`}
            label="Sleep"
            color="#A855F7"
          />
        </Pressable>
      </View>

      {/* ACTIONS */}
      <View style={styles.actions}>
        <Pressable
          style={styles.actionCard}
          onPress={() => navigation.navigate("Workout")}
        >
          <Text style={styles.actionTitle}>🏋️ Workouts</Text>
          <Text style={styles.actionSub}>Today’s training plan</Text>
        </Pressable>

        <Pressable
          style={styles.actionCard}
          onPress={() => navigation.navigate("WeeklySummary")}
        >
          <Text style={styles.actionTitle}>📊 Weekly Summary</Text>
          <Text style={styles.actionSub}>Last 7 days progress</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  greeting: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 4,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
  },

  heroCard: {
    borderRadius: 22,
    padding: 24,
    marginBottom: 24,
    ...SHADOW,
  },
  heroBadge: {
    color: "#FACC15",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  heroTitleDark: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  heroBig: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginTop: 12,
  },
  heroUnit: {
    fontSize: 14,
    color: "#D1D5DB",
  },
  heroSubDark: {
    fontSize: 14,
    color: "#D1D5DB",
    marginTop: 10,
  },

  trackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  editText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },

  ringRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  actions: {
    marginTop: 10,
  },
  actionCard: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    ...SHADOW,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textDark,
  },
  actionSub: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 6,
  },
});
