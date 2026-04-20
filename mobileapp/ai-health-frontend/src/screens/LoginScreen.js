import {
  View, Text, TextInput, Pressable, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Dimensions,
} from "react-native";
import { useState, useRef, useEffect, useContext } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";

const { width } = Dimensions.get("window");

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
function AnimatedInput({ icon, placeholder, value, onChangeText, secureTextEntry, keyboardType }) {
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

  return (
    <Animated.View style={[styles.inputWrap, { borderColor }]}>
      <Text style={[styles.inputIcon, { opacity: focused ? 1 : 0.5 }]}>{icon}</Text>
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
        autoCapitalize="none"
      />
    </Animated.View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }) {
  const { login }                   = useContext(AuthContext);
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  const btnScale = useRef(new Animated.Value(1)).current;
  const onBtnIn  = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const onBtnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await API.post("/auth/login", { email, password });
      login(res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Decorative blobs */}
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── HERO ── */}
          <FadeSlideIn delay={0}>
            <View style={styles.heroWrap}>
              <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={styles.logo}>
                <Text style={styles.logoEmoji}>🏃</Text>
              </LinearGradient>
              <Text style={styles.appName}>FitLip</Text>
              <Text style={styles.tagline}>Your personal fitness companion</Text>
            </View>
          </FadeSlideIn>

          {/* ── CARD ── */}
          <FadeSlideIn delay={120}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Welcome back 👋</Text>
              <Text style={styles.cardSub}>Sign in to continue your journey</Text>

              {/* Error */}
              {error ? (
                <View style={styles.errorWrap}>
                  <Text style={styles.errorText}>⚠️  {error}</Text>
                </View>
              ) : null}

              <AnimatedInput
                icon="📧"
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
              />
              <AnimatedInput
                icon="🔒"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              {/* Forgot Password */}
<Pressable
  onPress={() => navigation.navigate("ForgotPassword")}
  style={{ alignSelf: "flex-end", marginBottom: 10 }}
>
  <Text style={{ color: "#6366F1", fontWeight: "600", fontSize: 13 }}>
    Forgot Password?
  </Text>
</Pressable>

              {/* Login button */}
              <Pressable
                onPress={handleLogin}
                onPressIn={onBtnIn}
                onPressOut={onBtnOut}
                disabled={loading}
              >
                <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                  <LinearGradient
                    colors={loading ? ["#94A3B8", "#94A3B8"] : ["#6366F1", "#8B5CF6", "#A855F7"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.loginBtn}
                  >
                    {loading
                      ? <ActivityIndicator color="#fff" size="small" />
                      : <Text style={styles.loginBtnText}>Sign In  →</Text>
                    }
                  </LinearGradient>
                </Animated.View>
              </Pressable>
            </View>
          </FadeSlideIn>

          {/* ── DIVIDER ── */}
          <FadeSlideIn delay={220}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
          </FadeSlideIn>

          {/* ── REGISTER CARD ── */}
          <FadeSlideIn delay={300}>
            <Pressable
              onPress={() => navigation.navigate("Register")}
              style={({ pressed }) => [styles.registerCard, { opacity: pressed ? 0.9 : 1 }]}
            >
              <Text style={styles.registerText}>
                New here?{"  "}
                <Text style={styles.registerLink}>Create an account →</Text>
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
  scroll:    { padding: 24, paddingTop: 20, justifyContent: "center", flexGrow: 1 },

  // Blobs
  blobTop: {
    position: "absolute", top: -100, right: -80,
    width: 240, height: 240, borderRadius: 120,
    backgroundColor: "#6366F112",
  },
  blobBottom: {
    position: "absolute", bottom: -60, left: -70,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: "#A855F70D",
  },

  // Hero
  heroWrap: { alignItems: "center", marginBottom: 36 },
  logo: {
    width: 72, height: 72, borderRadius: 22,
    justifyContent: "center", alignItems: "center",
    marginBottom: 16,
    boxShadow: "0px 8px 24px rgba(99,102,241,0.38)",
  },
  logoEmoji: { fontSize: 34 },
  appName:   { fontSize: 30, fontWeight: "900", color: "#0F172A", letterSpacing: -0.8, marginBottom: 6 },
  tagline:   { fontSize: 15, color: "#94A3B8", fontWeight: "500" },

  // Card
  card: {
    backgroundColor: "#fff", borderRadius: 24,
    padding: 24, marginBottom: 16,
    boxShadow: "0px 4px 20px rgba(15,23,42,0.08)",
  },
  cardTitle: { fontSize: 22, fontWeight: "900", color: "#0F172A", letterSpacing: -0.5, marginBottom: 4 },
  cardSub:   { fontSize: 14, color: "#94A3B8", marginBottom: 20, fontWeight: "500" },

  // Error
  errorWrap: {
    backgroundColor: "#FEF2F2", borderRadius: 12,
    borderWidth: 1, borderColor: "#FECACA",
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: { color: "#EF4444", fontSize: 13, fontWeight: "600" },

  // Input
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8FAFC", borderRadius: 14,
    borderWidth: 1.5, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 2,
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: {
    flex: 1, paddingVertical: 13,
    fontSize: 15, color: "#0F172A", fontWeight: "500",
  },

  // Login button
  loginBtn: {
    borderRadius: 16, paddingVertical: 16,
    alignItems: "center", justifyContent: "center",
    marginTop: 6,
    boxShadow: "0px 6px 18px rgba(99,102,241,0.35)",
  },
  loginBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },

  // Divider
  dividerRow: {
    flexDirection: "row", alignItems: "center",
    marginBottom: 16, gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  dividerText: { fontSize: 13, color: "#CBD5E1", fontWeight: "600" },

  // Register card
  registerCard: {
    backgroundColor: "#fff", borderRadius: 18,
    paddingVertical: 16, alignItems: "center",
    boxShadow: "0px 2px 10px rgba(15,23,42,0.06)",
  },
  registerText: { fontSize: 14, color: "#94A3B8", fontWeight: "500" },
  registerLink: { color: "#6366F1", fontWeight: "800" },
});