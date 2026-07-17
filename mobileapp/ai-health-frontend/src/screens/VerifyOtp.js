import { Text, Pressable, TextInput, StyleSheet } from "react-native";
import { useState } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import API from "../services/api";
import { COLORS } from "../constants/theme";
import AuthShell from "../components/auth/AuthShell";
import AuthHero from "../components/auth/AuthHero";
import PrimaryButton from "../components/auth/PrimaryButton";
import { Banner, BackLink } from "../components/auth/AuthBits";

export default function VerifyOtp() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const [otp, setOtp] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await API.post("/auth/verify-otp", { email, otp });
      router.push({ pathname: "/(auth)/reset-password", params: { email } });
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    setInfo("");
    try {
      await API.post("/auth/forgot-password", { email });
      setInfo("New code sent to your email");
    } catch {
      setError("Could not resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <BackLink onPress={() => router.back()} />
      <AuthHero
        icon="mail-open-outline"
        title="Enter code"
        subtitle={`We sent a 6-digit code to ${email ?? "your email"}`}
        size="compact"
      />

      <Banner text={error} />
      <Banner text={info} tone="success" />

      <TextInput
        style={[styles.otpInput, focused && styles.otpInputFocused]}
        placeholder="------"
        placeholderTextColor={COLORS.textMuted}
        value={otp}
        onChangeText={(v) => setOtp(v.replace(/[^0-9]/g, ""))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={6}
        textAlign="center"
        accessibilityLabel="6-digit verification code"
      />

      <PrimaryButton title="Verify code" onPress={handleVerify} loading={loading} icon="checkmark" />

      <Pressable onPress={handleResend} disabled={resending} style={styles.resendWrap} hitSlop={10} accessibilityRole="button">
        <Text style={styles.resendText}>
          Didn't get it? <Text style={styles.resendLink}>{resending ? "Resending…" : "Resend code"}</Text>
        </Text>
      </Pressable>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  otpInput: {
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surfaceMuted,
    borderRadius: 16, paddingVertical: 16, marginBottom: 20,
    fontSize: 26, fontWeight: "800", color: COLORS.textDark, letterSpacing: 10,
  },
  otpInputFocused: { borderColor: COLORS.primary },
  resendWrap: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  resendText: { fontSize: 14, color: COLORS.textMuted, fontWeight: "500" },
  resendLink: { color: COLORS.primary, fontWeight: "800" },
});
