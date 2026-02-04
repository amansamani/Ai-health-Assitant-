import { COLORS, SHADOW } from "../constants/theme";
import { View, Text, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import API from "../services/api";
import { Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";


export default function TrackDetailScreen({ route }) {
  const { token } = useContext(AuthContext); 
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const { type } = route.params; // steps | water | sleep
  const [logs, setLogs] = useState([]);

  const fetchToday = useCallback(async () => {
  try {
    const res = await API.get("/track/today");
    setToday(res.data);
  } catch (err) {
    setToday(null);
  } finally {
    setLoading(false);
  }
}, []);


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
  }, [route.params, token, fetchToday]) // 🔥 token dependency
);



  const fetchLogs = async () => {
  try {
    const res = await API.get("/track/recent/3");

    const todayStr = new Date().toISOString().slice(0, 10);

    const pastLogs = res.data.filter(
      log => log.date.slice(0, 10) !== todayStr
    );

    setLogs(pastLogs);
  } catch (err) {
    console.log("Failed to fetch logs");
  }
};


  return (
    <SafeAreaView style={styles.container}>

      <Text style={styles.title}>
        {type.toUpperCase()} – Last 3 Days
      </Text>

      {logs.map((log) => (
        <View key={log._id} style={styles.card}>
          <Text style={styles.date}>
            {new Date(log.date).toDateString()}
          </Text>

          <Text style={styles.value}>
            {log[type]}
            {type === "water" ? " L" : type === "sleep" ? " h" : ""}
          </Text>
        </View>
      ))}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },

  title: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.textDark,
    marginBottom: 20,
  },

  card: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    ...SHADOW,
  },

  date: {
    fontSize: 14,
    color: COLORS.textLight,
  },

  value: {
    fontSize: 26,
    fontWeight: "700",
    color: COLORS.textDark,
    marginTop: 6,
  },

});
