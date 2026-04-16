import {
  View, Text, TextInput, Pressable,
  StyleSheet, Alert, ActivityIndicator
} from "react-native";
import { useState } from "react";
import API from "../services/api";

export default function ResetPassword({ navigation, route }) {
  const { email }                         = route.params;
  const [newPassword, setNewPassword]     = useState("");
  const [confirmPass, setConfirmPass]     = useState("");
  const [loading, setLoading]             = useState(false);

  const handleReset = async () => {
    if (!newPassword || !confirmPass) {
      Alert.alert("Error", "Please fill in both fields");
      return;
    }
    if (newPassword !== confirmPass) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      await API.post("/auth/reset-password", { email, newPassword });
      Alert.alert("Success", "Password reset successfully!");

      // Go back to Login
      navigation.navigate("Login");

    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>New Password 🔑</Text>
      <Text style={styles.subtitle}>Your new password must be at least 6 characters</Text>

      <TextInput
        placeholder="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        style={styles.input}
        secureTextEntry
      />

      <TextInput
        placeholder="Confirm New Password"
        value={confirmPass}
        onChangeText={setConfirmPass}
        style={styles.input}
        secureTextEntry
      />

      <Pressable style={styles.btn} onPress={handleReset} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Reset Password</Text>
        }
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title:      { fontSize: 26, fontWeight: "bold", color: "#1e1e2e", marginBottom: 8 },
  subtitle:   { fontSize: 14, color: "#888", marginBottom: 30 },
  input:      { borderWidth: 1, borderColor: "#ddd", padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 15 },
  btn:        { backgroundColor: "#6366F1", padding: 15, borderRadius: 12, alignItems: "center" },
  btnText:    { color: "#fff", fontWeight: "bold", fontSize: 16 },
});