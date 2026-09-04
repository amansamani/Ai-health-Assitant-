import { View, Text, Pressable, StyleSheet } from "react-native";
import { useState, useContext } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { COLORS } from "../constants/theme";
import AuthShell from "../components/auth/AuthShell";
import AuthHero from "../components/auth/AuthHero";
import FormField from "../components/auth/FormField";
import PrimaryButton from "../components/auth/PrimaryButton";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { Divider, Banner, FooterLink } from "../components/auth/AuthBits";

export default function LoginScreen() {
  const router = useRouter();
  const { justReset } = useLocalSearchParams();
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState(justReset ? "Password reset! Sign in with your new password." : "");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await API.post("/auth/login", { email, password });
      if (res.data.hasHealthProfile === false) {
        // Account exists but never finished health-profile setup
        // (e.g. they closed the app mid-onboarding). Send them there
        // instead of straight to home.
        router.push({
          pathname: "/(auth)/health-profile",
          params: {
            name: res.data.user?.name ?? "",
            email: res.data.user?.email ?? "",
            token: res.data.token,
          },
        });
        return;
      }
      await login(res.data.token);
      // AuthContext flips userToken -> the (auth) layout guard redirects to /(app)/home.
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthHero title="FitLip" subtitle="Your personal fitness companion" />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome back</Text>
        <Text style={styles.cardSub}>Sign in to continue your journey</Text>

        <Banner text={info} tone="success" />
        <Banner text={error} />

        <FormField
          label="Email address"
          icon="mail-outline"
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <FormField
          label="Password"
          icon="lock-closed-outline"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotWrap} hitSlop={8}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>

        <PrimaryButton title="Sign In" onPress={handleLogin} loading={loading} />
      </View>

      <Divider />

      <GoogleSignInButton
        onSuccess={(data) => {
          if (data.hasHealthProfile) {
            login(data.token);
          } else {
            router.push({
              pathname: "/(auth)/health-profile",
              params: {
                name: data.user?.name ?? "",
                email: data.user?.email ?? "",
                token: data.token,
              },
            });
          }
        }}
      />

      <View style={{ height: 16 }} />

      <Pressable
        onPress={() => router.push("/(auth)/register")}
        style={({ pressed }) => [styles.registerCard, { opacity: pressed ? 0.9 : 1 }]}
      >
        <FooterLink prompt="New here?" label="Create an account" onPress={() => router.push("/(auth)/register")} />
      </Pressable>

      <View style={{ height: 24 }} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 20,
    padding: 20, marginBottom: 4,
    boxShadow: "0px 4px 20px rgba(23,15,54,0.08)",
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.5, marginBottom: 4 },
  cardSub: { fontSize: 14, color: COLORS.textMuted, marginBottom: 20, fontWeight: "500" },
  forgotWrap: { alignSelf: "flex-end", marginBottom: 16, minHeight: 30, justifyContent: "center" },
  forgotText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  registerCard: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    boxShadow: "0px 2px 10px rgba(23,15,54,0.06)",
  },
});
