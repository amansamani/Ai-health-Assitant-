import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import API from "../services/api";
import { COLORS, SHADOW } from "../constants/theme";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";


export default function WeeklySummaryScreen() {
  const { token } = useContext(AuthContext);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  if (!token) return; // 🔥 WAIT FOR TOKEN
  fetchSummary();
}, [token]);


  const fetchSummary = async () => {
    try {
      const res = await API.get("/track/weekly");
      setSummary(res.data);
    } catch (err) {
      console.log("Weekly summary error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!summary || summary.message) {
    return (
      <View style={styles.center}>
        <Text>No weekly data yet</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Weekly Summary</Text>

      <View style={styles.card}>
        <Text>🚶 Avg Steps: {summary.avgSteps}</Text>
        <Text>💧 Avg Water: {summary.avgWater} L</Text>
        <Text>😴 Avg Sleep: {summary.avgSleep} hrs</Text>
      </View>

      <View style={styles.card}>
        <Text>🏆 Best Day: {new Date(summary.bestDay).toDateString()}</Text>
        <Text>📅 Days Tracked: {summary.daysTracked}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    ...SHADOW,
  },
});
