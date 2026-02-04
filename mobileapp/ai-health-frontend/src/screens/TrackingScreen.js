import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, SHADOW } from "../constants/theme";
import API from "../services/api";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";


export default function TrackingScreen({navigation, route}) {
  const { token } = useContext(AuthContext);
  const [steps, setSteps] = useState("");
  const [water, setWater] = useState("");
  const [sleep, setSleep] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayLog, setTodayLog] = useState(null);

  useFocusEffect(
  useCallback(() => {
    if (!token) return; // 🔥 WAIT FOR TOKEN

    if (route.params?.updatedToday) {
      setToday(route.params.updatedToday);
      setLoading(false);

      navigation.setParams({ updatedToday: undefined });
    } else {
      setLoading(true);
      fetchToday();
    }
  }, [route.params, token]) // 🔥 token dependency
);


  // 🔹 GET /api/track/today
  const fetchToday = async () => {
  try {
    const res = await API.get("/track/today");

    if (res.data) {
      setTodayLog(res.data);

      setSteps(res.data.steps?.toString() || "");
      setWater(res.data.water?.toString() || "");
      setSleep(res.data.sleep?.toString() || "");
    }
  } catch (err) {
    console.log("No tracking data for today");
  } finally {
    setLoading(false);
  }
};


  // 🔹 POST /api/track/today
  const saveToday = async () => {
  try {
    setSaving(true);

    await API.post("/track/today", {
      steps: Number(steps),
      water: Number(water),
      sleep: Number(sleep),
    });

   navigation.navigate("Home", {
  updatedToday: {
    steps: Number(steps),
    water: Number(water),
    sleep: Number(sleep),
  },
});


  } catch (err) {
    console.log(err.response?.data || err.message);
    alert("Failed to save data");
  } finally {
    setSaving(false);
  }
};



  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Daily Tracking</Text>

      <View style={styles.card}>
  <TextInput
    placeholder="Steps (e.g. 8000)"
    keyboardType="numeric"
    value={steps}
    onChangeText={setSteps}
    style={styles.input}
  />

  <TextInput
    placeholder="Water (liters, e.g. 2.5)"
    keyboardType="numeric"
    value={water}
    onChangeText={setWater}
    style={styles.input}
  />

  <TextInput
    placeholder="Sleep (hours, e.g. 7)"
    keyboardType="numeric"
    value={sleep}
    onChangeText={setSleep}
    style={styles.input}
  />

  <Pressable style={styles.button} onPress={saveToday}>
    <Text style={styles.buttonText}>
      {saving ? "Saving..." : "Save Today"}
    </Text>
  </Pressable>
</View>

    {todayLog && (
      <View style={styles.logCard}>
        <Text style={styles.logTitle}>Today’s Log</Text>

        <Text style={styles.logItem}>
          🚶 Steps: <Text style={styles.bold}>{todayLog.steps}</Text>
        </Text>

        <Text style={styles.logItem}>
          💧 Water: <Text style={styles.bold}>{todayLog.water} L</Text>
        </Text>

        <Text style={styles.logItem}>
          😴 Sleep: <Text style={styles.bold}>{todayLog.sleep} hrs</Text>
        </Text>
      </View>
  )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
  flex: 1,
  padding: 20,
  backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  input: {
  backgroundColor: "#F9FAFB",
  padding: 14,
  borderRadius: 10,
  marginBottom: 12,
  fontSize: 16,
},

 button: {
  backgroundColor: COLORS.accent,
  padding: 14,
  borderRadius: 12,
  alignItems: "center",
  marginTop: 10,
},

  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  logCard: {
  marginTop: 20,
  padding: 18,
  borderRadius: 16,
  backgroundColor: COLORS.card,
  ...SHADOW,
},
logTitle: {
  fontSize: 18,
  fontWeight: "700",
  color: COLORS.textDark,
  marginBottom: 12,
},
logItem: {
  fontSize: 16,
  color: COLORS.textLight,
  marginBottom: 6,
},

bold: {
  fontWeight: "bold",
},
card: {
  backgroundColor: COLORS.card,
  borderRadius: 16,
  padding: 18,
  marginBottom: 20,
  ...SHADOW,
},

});
