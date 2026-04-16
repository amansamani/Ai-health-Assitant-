import {
  View, Text, TextInput, Pressable, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, ScrollView, Dimensions,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

const GOALS = [
  { key: "bulk", label: "Bulk",  emoji: "💪", desc: "Build mass",     color: "#F59E0B" },
  { key: "lean", label: "Lean",  emoji: "🔥", desc: "Cut fat",        color: "#EF4444" },
  { key: "fit",  label: "Fit",   emoji: "⚡", desc: "Stay healthy",   color: "#22C55E" },
];

// ── Fade slide in ─────────────────────────────────────────────────────────────
function FadeSlideIn({ delay = 0, children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(22)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ── Animated Input ────────────────────────────────────────────────────────────
function AnimatedInput({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType, autoCapitalize }) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#E2E8F0", "#6366F1"],
  });
  const shadowOpacity = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.12],
  });

  return (
    <Animated.View style={[
      styles.inputWrap,
      { borderColor, shadowOpacity, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 0 }, shadowRadius: 8 },
    ]}>
      <Text style={[styles.inputIcon, focused && { opacity: 1 }]}>{icon}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#CBD5E1"
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "words"}
      />
    </Animated.View>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────
function GoalCard({ goal, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={{ flex: 1 }}>
      <Animated.View style={[
        styles.goalCard,
        selected && { borderColor: goal.color, borderWidth: 2, backgroundColor: goal.color + "10" },
        { transform: [{ scale }] },
      ]}>
        {selected && <View style={[styles.goalDot, { backgroundColor: goal.color }]} />}
        <Text style={styles.goalEmoji}>{goal.emoji}</Text>
        <Text style={[styles.goalLabel, selected && { color: goal.color }]}>{goal.label}</Text>
        <Text style={styles.goalDesc}>{goal.desc}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }) {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [goal, setGoal]         = useState("lean");
  const [error, setError]       = useState("");

  const btnScale = useRef(new Animated.Value(1)).current;
  const onBtnIn  = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const onBtnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  const handleRegister = () => {
    if (!name || !email || !password) {
      setError("Please fill in all fields");
      return;
    }
    setError("");
    const goalMap = { bulk: "gain", lean: "lose", fit: "maintain" };
    navigation.navigate("HealthProfile", { name, email, password, goal: goalMap[goal] });
  };

  const activeGoal = GOALS.find((g) => g.key === goal);

  return (
    <SafeAreaView style={styles.container}>
      {/* Decorative blobs */}
      <View style={styles.blobTopRight} />
      <View style={styles.blobBottomLeft} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── HEADER ── */}
          <FadeSlideIn delay={0}>
            <View style={styles.headerWrap}>
              <View style={styles.logoWrap}>
                <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={styles.logo}>
                  <Text style={styles.logoText}>💪</Text>
                </LinearGradient>
              </View>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Start your fitness journey today</Text>
            </View>
          </FadeSlideIn>

          {/* ── ERROR ── */}
          {error ? (
            <FadeSlideIn delay={0}>
              <View style={styles.errorWrap}>
                <Text style={styles.errorText}>⚠️  {error}</Text>
              </View>
            </FadeSlideIn>
          ) : null}

          {/* ── INPUTS ── */}
          <FadeSlideIn delay={100}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Personal Info</Text>
              <AnimatedInput
                icon="👤"
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
              <AnimatedInput
                icon="📧"
                placeholder="Email Address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <AnimatedInput
                icon="🔒"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>
          </FadeSlideIn>

          {/* ── GOAL SELECTOR ── */}
          <FadeSlideIn delay={200}>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Fitness Goal</Text>
              <Text style={styles.cardSub}>What are you training for?</Text>
              <View style={styles.goalRow}>
                {GOALS.map((g) => (
                  <GoalCard
                    key={g.key}
                    goal={g}
                    selected={goal === g.key}
                    onPress={() => setGoal(g.key)}
                  />
                ))}
              </View>
            </View>
          </FadeSlideIn>

          {/* ── CONTINUE BUTTON ── */}
          <FadeSlideIn delay={300}>
            <Pressable onPress={handleRegister} onPressIn={onBtnIn} onPressOut={onBtnOut}>
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <LinearGradient
                  colors={["#6366F1", "#8B5CF6", "#A855F7"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.continueBtn}
                >
                  <Text style={styles.continueBtnText}>Continue  →</Text>
                </LinearGradient>
              </Animated.View>
            </Pressable>
          </FadeSlideIn>

          {/* ── LOGIN LINK ── */}
          <FadeSlideIn delay={360}>
            <Pressable onPress={() => navigation.goBack()} style={styles.loginWrap}>
              <Text style={styles.loginText}>
                Already have an account?{" "}
                <Text style={styles.loginLink}>Sign In</Text>
              </Text>
            </Pressable>
          </FadeSlideIn>

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll:    { padding: 24, paddingTop: 16 },

  // Decorative blobs
  blobTopRight: {
    position: "absolute", top: -80, right: -80,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: "#6366F115",
  },
  blobBottomLeft: {
    position: "absolute", bottom: 40, left: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: "#A855F710",
  },

  // Header
  headerWrap: { alignItems: "center", marginBottom: 28, marginTop: 12 },
  logoWrap:   { marginBottom: 18 },
  logo: {
    width: 64, height: 64, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
    boxShadow: "0px 8px 20px rgba(99,102,241,0.35)",
  },
  logoText: { fontSize: 30 },
  title:    { fontSize: 28, fontWeight: "900", color: "#0F172A", letterSpacing: -0.7, marginBottom: 6 },
  subtitle: { fontSize: 15, color: "#94A3B8", fontWeight: "500" },

  // Error
  errorWrap: {
    backgroundColor: "#FEF2F2", borderRadius: 14,
    borderWidth: 1, borderColor: "#FECACA",
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },

  // Card
  card: {
    backgroundColor: "#fff", borderRadius: 22,
    padding: 20, marginBottom: 16,
    boxShadow: "0px 2px 12px rgba(15,23,42,0.07)",
  },
  cardLabel: { fontSize: 13, fontWeight: "800", color: "#0F172A", letterSpacing: 0.2, marginBottom: 14 },
  cardSub:   { fontSize: 12, color: "#94A3B8", marginTop: -10, marginBottom: 14, fontWeight: "500" },

  // Input
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8FAFC", borderRadius: 14,
    borderWidth: 1.5, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 2,
  },
  inputIcon: { fontSize: 16, marginRight: 10, opacity: 0.6 },
  input: {
    flex: 1, paddingVertical: 13,
    fontSize: 15, color: "#0F172A", fontWeight: "500",
  },

  // Goal cards
  goalRow: { flexDirection: "row", gap: 10 },
  goalCard: {
    flex: 1, backgroundColor: "#F8FAFC",
    borderRadius: 16, padding: 12,
    alignItems: "center", borderWidth: 2,
    borderColor: "#F1F5F9", position: "relative",
  },
  goalDot: {
    position: "absolute", top: 8, right: 8,
    width: 7, height: 7, borderRadius: 4,
  },
  goalEmoji: { fontSize: 22, marginBottom: 5 },
  goalLabel: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 3 },
  goalDesc:  { fontSize: 10, color: "#94A3B8", textAlign: "center", fontWeight: "500" },

  // Continue button
  continueBtn: {
    borderRadius: 18, paddingVertical: 17,
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
    boxShadow: "0px 6px 18px rgba(99,102,241,0.38)",
  },
  continueBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },

  // Login link
  loginWrap: { alignItems: "center" },
  loginText: { fontSize: 14, color: "#94A3B8", fontWeight: "500" },
  loginLink: { color: "#6366F1", fontWeight: "800" },
});