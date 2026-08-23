import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { useState, useRef, useContext } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../context/AuthContext";
import API from "../services/api";
import { COLORS } from "../constants/theme";
import AuthShell from "../components/auth/AuthShell";
import AuthHero from "../components/auth/AuthHero";
import FormField from "../components/auth/FormField";
import PrimaryButton from "../components/auth/PrimaryButton";
import { Divider, Banner, FooterLink } from "../components/auth/AuthBits";
import GoogleSignInButton from "../components/GoogleSignInButton";

const GOALS = [
  { key: "bulk", label: "Bulk", icon: "barbell-outline", desc: "Build mass", color: COLORS.warning },
  { key: "lean", label: "Lean", icon: "flame-outline", desc: "Cut fat", color: COLORS.error },
  { key: "fit", label: "Fit", icon: "flash-outline", desc: "Stay healthy", color: COLORS.success },
];

function GoalCard({ goal, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 40 }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      style={{ flex: 1 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${goal.label}: ${goal.desc}`}
    >
      <Animated.View
        style={[
          styles.goalCard,
          selected && { borderColor: goal.color, backgroundColor: goal.color + "12" },
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons name={goal.icon} size={22} color={selected ? goal.color : COLORS.textMuted} />
        <Text style={[styles.goalLabel, selected && { color: goal.color }]}>{goal.label}</Text>
        <Text style={styles.goalDesc}>{goal.desc}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [goal, setGoal] = useState("lean");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email");
      return;
    }
    setError("");
    setLoading(true);
    try {
      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      const { data } = await API.post("/auth/register", { name, email, password, goal });
      router.push({
        pathname: "/(auth)/health-profile",
        params: { name, email, password, token: data.token, workoutGoal: goal },
      });
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthHero icon="person-add-outline" title="Create account" subtitle="Start your fitness journey today" size="compact" />

      <Banner text={error} />

      <View style={styles.card}>
        <FormField
          label="Full name"
          icon="person-outline"
          placeholder="Jane Doe"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
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
          placeholder="At least 6 characters"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Fitness goal</Text>
        <View style={styles.goalRow}>
          {GOALS.map((g) => (
            <GoalCard key={g.key} goal={g} selected={goal === g.key} onPress={() => setGoal(g.key)} />
          ))}
        </View>
      </View>

      <PrimaryButton title="Continue" onPress={handleRegister} loading={loading} />

      <Divider />

      <GoogleSignInButton
        onSuccess={(data) => {
          if (data.hasHealthProfile) {
            // Returning Google user who already set up their profile.
            login(data.token);
          } else {
            // First Google sign-in (or an account that never finished
            // setup) — send them through the same health-profile step
            // manual registration uses, instead of straight to home.
            router.push({
              pathname: "/(auth)/health-profile",
              params: {
                name: data.user?.name ?? "",
                email: data.user?.email ?? "",
                token: data.token,
                workoutGoal: goal,
              },
            });
          }
        }}
      />

      <View style={{ height: 16 }} />

      <FooterLink prompt="Already have an account?" label="Sign in" onPress={() => router.back()} />

      <View style={{ height: 24 }} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface, borderRadius: 24,
    padding: 20, marginBottom: 16,
    boxShadow: "0px 4px 20px rgba(23,15,54,0.08)",
  },
  cardLabel: { fontSize: 13, fontWeight: "800", color: COLORS.textDark, letterSpacing: 0.2, marginBottom: 14 },
  goalRow: { flexDirection: "row", gap: 10 },
  goalCard: {
    flex: 1, backgroundColor: COLORS.surfaceMuted,
    borderRadius: 16, paddingVertical: 14, gap: 5,
    alignItems: "center", borderWidth: 1.5, borderColor: COLORS.border,
  },
  goalLabel: { fontSize: 13, fontWeight: "800", color: COLORS.textDark },
  goalDesc: { fontSize: 10, color: COLORS.textMuted, textAlign: "center", fontWeight: "500" },
});
