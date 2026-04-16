import {
  View, Text, TextInput, Pressable,
  StyleSheet, Alert, ActivityIndicator
} from "react-native";
import { useState } from "react";
import API from "../services/api";

export default function VerifyOtp({ navigation, route }) {
  const { email }               = route.params; // received from previous screen
  const [otp, setOtp]           = useState("");
  const [loading, setLoading]   = useState(false);

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      await API.post("/auth/verify-otp", { email, otp });
      Alert.alert("Success", "OTP Verified!");

      // Pass email to reset screen
      navigation.navigate("ResetPassword", { email });

    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await API.post("/auth/forgot-password", { email });
      Alert.alert("Success", "New OTP sent to your email!");
    } catch (err) {
      Alert.alert("Error", "Could not resend OTP");
    }
  };

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Enter OTP 📩</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to{"\n"}
        <Text style={styles.email}>{email}</Text>
      </Text>

      <TextInput
        placeholder="_ _ _ _ _ _"
        value={otp}
        onChangeText={setOtp}
        style={styles.otpInput}
        keyboardType="number-pad"
        maxLength={6}
      />

      <Pressable style={styles.btn} onPress={handleVerify} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Verify OTP</Text>
        }
      </Pressable>

      <Pressable onPress={handleResend}>
        <Text style={styles.resendText}>Didn't get the code? <Text style={styles.resendLink}>Resend</Text></Text>
      </Pressable>

    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  title:      { fontSize: 26, fontWeight: "bold", color: "#1e1e2e", marginBottom: 8 },
  subtitle:   { fontSize: 14, color: "#888", marginBottom: 30, lineHeight: 22 },
  email:      { color: "#6366F1", fontWeight: "600" },
  otpInput:   { borderWidth: 1, borderColor: "#ddd", padding: 16, borderRadius: 12, marginBottom: 20, fontSize: 28, textAlign: "center", letterSpacing: 12 },
  btn:        { backgroundColor: "#6366F1", padding: 15, borderRadius: 12, alignItems: "center", marginBottom: 20 },
  btnText:    { color: "#fff", fontWeight: "bold", fontSize: 16 },
  resendText: { textAlign: "center", color: "#888", fontSize: 13 },
  resendLink: { color: "#6366F1", fontWeight: "600" },
});