import {
  View, Text, TextInput, Pressable,
  StyleSheet, Alert, ActivityIndicator
} from "react-native";
import { useState } from "react";
import API from "../services/api";

export default function ForgotPassword({ navigation }) {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    try {
      setLoading(true);
      await API.post("/auth/forgot-password", { email });
      Alert.alert("Success", "OTP sent to your email!");

      // Pass email to next screen
      navigation.navigate("VerifyOtp", { email });

    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Forgot Password 🔐</Text>
      <Text style={styles.subtitle}>
        Enter your email and we'll send you a 6-digit OTP
      </Text>

      <TextInput
        placeholder="Enter your email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Pressable style={styles.btn} onPress={handleSendOtp} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Send OTP</Text>
        }
      </Pressable>

      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Back to Login</Text>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title:      { fontSize: 26, fontWeight: "bold", color: "#1e1e2e", marginBottom: 8 },
  subtitle:   { fontSize: 14, color: "#888", marginBottom: 30 },
  input:      { borderWidth: 1, borderColor: "#ddd", padding: 14, borderRadius: 12, marginBottom: 16, fontSize: 15 },
  btn:        { backgroundColor: "#6366F1", padding: 15, borderRadius: 12, alignItems: "center", marginBottom: 16 },
  btnText:    { color: "#fff", fontWeight: "bold", fontSize: 16 },
  backText:   { color: "#6366F1", textAlign: "center", marginTop: 8, fontWeight: "600" },
});