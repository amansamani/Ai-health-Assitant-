import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useEffect, useState, useContext } from "react";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProfileScreen() {
  const { logout, token } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

useEffect(() => {
  if (!token) return; // 🔥 WAIT FOR TOKEN
  fetchProfile();
}, [token]);




  const fetchProfile = async () => {
    try {
      const res = await API.get("/user/profile");

      if (res.data) {
        setProfile(res.data);
        setSelectedGoal(res.data.goal || "");
      }
    } catch (err) {
      console.log("Profile fetch error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateGoal = async () => {
    try {
      setSaving(true);
      await API.put("/user/goal", { goal: selectedGoal });
      alert("Goal updated successfully");
    } catch (err) {
      alert("Failed to update goal");
    } finally {
      setSaving(false);
    }
  };

  // 🔐 SAFETY GUARD (VERY IMPORTANT)
  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      <Text style={styles.label}>Name</Text>
      <Text style={styles.value}>{profile?.name || "—"}</Text>

      <Text style={styles.label}>Email</Text>
      <Text style={styles.value}>{profile?.email || "—"}</Text>

      <Text style={styles.label}>Fitness Goal</Text>

      <View style={styles.goalRow}>
        {["bulk", "lean", "fit"].map((goal) => (
          <Pressable
            key={goal}
            style={[
              styles.goalButton,
              selectedGoal === goal && styles.goalActive,
            ]}
            onPress={() => setSelectedGoal(goal)}
          >
            <Text
              style={[
                styles.goalText,
                selectedGoal === goal && styles.goalTextActive,
              ]}
            >
              {goal.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={styles.saveBtn}
        onPress={updateGoal}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? "Saving..." : "Update Goal"}
        </Text>
      </Pressable>

      <Pressable onPress={logout}>
        <Text style={styles.logout}>Logout</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
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
  label: {
    fontSize: 14,
    color: "#666",
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
  },
  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  goalButton: {
    borderWidth: 1,
    borderColor: "#2196F3",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  goalActive: {
    backgroundColor: "#2196F3",
  },
  goalText: {
    color: "#2196F3",
    fontWeight: "bold",
  },
  goalTextActive: {
    color: "#fff",
  },
  saveBtn: {
    backgroundColor: "#4CAF50",
    padding: 14,
    borderRadius: 6,
    marginTop: 25,
    alignItems: "center",
  },
  saveText: {
    color: "#fff",
    fontWeight: "bold",
  },
  logout: {
    textAlign: "center",
    color: "red",
    marginTop: 30,
  },
});
