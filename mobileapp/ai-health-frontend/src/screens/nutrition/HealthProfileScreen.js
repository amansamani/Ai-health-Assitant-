import React, { useState, useRef, useEffect, useContext } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  Pressable, ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView, Platform,
} from "react-native";
import { AuthContext } from "../../context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";
import API from "../../services/api";
import { WORKOUT_TO_DIET_GOAL } from "../../constants/goalMap";

const { width } = Dimensions.get("window");

const parseList = (str) =>
  str.split(",").map(s => s.trim()).filter(Boolean);

// ── Fade slide in ─────────────────────────────────────────────────────────────
function FadeSlideIn({ delay = 0, children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 480, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 480, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ── Animated Input ────────────────────────────────────────────────────────────
function AnimatedInput({ icon, placeholder, value, onChangeText, keyboardType }) {
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
  const borderColor = borderAnim.interpolate({ inputRange: [0, 1], outputRange: ["#E4E0F0", "#4C2E96"] });
  return (
    <Animated.View style={[styles.inputWrap, { borderColor }]}>
      <Text style={[styles.inputIcon, { opacity: focused ? 1 : 0.45 }]}>{icon}</Text>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#E4E0F0"
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
      />
    </Animated.View>
  );
}

// ── Option Chip ───────────────────────────────────────────────────────────────
function OptionChip({ label, emoji, selected, color = "#4C2E96", onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      hitSlop={4}
    >
      <Animated.View style={[
        styles.chip,
        selected && { backgroundColor: color + "18", borderColor: color, borderWidth: 2 },
        { transform: [{ scale }] },
      ]}>
        {emoji ? <Text style={styles.chipEmoji}>{emoji}</Text> : null}
        <Text style={[styles.chipText, selected && { color, fontWeight: "800" }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ title, icon, children }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Text style={styles.sectionIcon}>{icon}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
const GENDER_OPTIONS = [
  { key: "male",   label: "Male",   emoji: "👨" },
  { key: "female", label: "Female", emoji: "👩" },
];

const ACTIVITY_OPTIONS = [
  { key: "sedentary", label: "Sedentary", emoji: "🛋️",  color: "#9A94AE", desc: "Little movement" },
  { key: "moderate",  label: "Moderate",  emoji: "🚶",  color: "#F59E0B", desc: "Light exercise"  },
  { key: "active",    label: "Active",    emoji: "🏃",  color: "#22C55E", desc: "Regular training" },
];

const GOAL_OPTIONS = [
  { key: "lose",     label: "Lose",     emoji: "🔥", color: "#EF4444", desc: "Cut fat"      },
  { key: "maintain", label: "Maintain", emoji: "⚖️", color: "#4C2E96", desc: "Stay healthy" },
  { key: "gain",     label: "Gain",     emoji: "💪", color: "#F59E0B", desc: "Build mass"   },
];

const DIET_OPTIONS = [
  { key: "veg",     label: "Veg",     emoji: "🥦" },
  { key: "non-veg", label: "Non-Veg", emoji: "🍗" },
  { key: "vegan",   label: "Vegan",   emoji: "🌱" },
];

export default function HealthProfileScreen({ navigation, route }) {
  const { login } = useContext(AuthContext);
  const { name, email, password, token, workoutGoal} = route.params ?? {};

  useEffect(() => {
    if (!name || !email || !password) {
      alert("Registration data missing");
      navigation.goBack();
    }
  }, []);

  const [form, setForm] = useState({
    age: "", gender: "male", height: "", weight: "",
    activityLevel: "moderate", goal: "lose", dietType: "non-veg",
    goal: WORKOUT_TO_DIET_GOAL[workoutGoal] ?? "lose",
    diseases: "", allergies: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const btnScale = useRef(new Animated.Value(1)).current;
  const onBtnIn  = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const onBtnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submitProfile = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };

      await API.post("/health", {
        age:           Number(form.age),
        height:        Number(form.height),
        weight:        Number(form.weight),
        gender:        form.gender,
        activityLevel: form.activityLevel,
        goal:          form.goal,
        dietType:      form.dietType,
        diseases:      parseList(form.diseases),
        allergies:     parseList(form.allergies),
      }, authHeader);

      await API.post("/nutrition/generate", {}, authHeader);

      await login(token);
    } catch (err) {
      console.log("❌ ERROR:", err.response?.data || err.message);
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#F5F3FF" }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Decorative blobs */}
        <View style={styles.blobTop} />
        <View style={styles.blobBottom} />

        {/* ── HEADER ── */}
        <FadeSlideIn delay={0}>
          <View style={styles.headerWrap}>
            <View style={styles.stepRow}>
              <View style={styles.stepDone}><Text style={styles.stepDoneText}>✓</Text></View>
              <View style={styles.stepLine} />
              <LinearGradient colors={["#4C2E96", "#6339B8"]} style={styles.stepActive}>
                <Text style={styles.stepActiveText}>2</Text>
              </LinearGradient>
            </View>
            <Text style={styles.stepLabel}>Step 2 of 2</Text>
            <Text style={styles.title}>Your Body Profile</Text>
            <Text style={styles.subtitle}>Personalise your fitness & diet plan</Text>
          </View>
        </FadeSlideIn>

        {/* ── BODY METRICS ── */}
        <FadeSlideIn delay={100}>
          <SectionCard title="Body Metrics" icon="📏">
            <View style={styles.metricsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Age</Text>
                <AnimatedInput icon="🎂" placeholder="Years" value={form.age}
                  onChangeText={(v) => handleChange("age", v)} keyboardType="numeric" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Height (cm)</Text>
                <AnimatedInput icon="📐" placeholder="cm" value={form.height}
                  onChangeText={(v) => handleChange("height", v)} keyboardType="numeric" />
              </View>
            </View>
            <Text style={styles.fieldLabel}>Weight (kg)</Text>
            <AnimatedInput icon="⚖️" placeholder="kg" value={form.weight}
              onChangeText={(v) => handleChange("weight", v)} keyboardType="numeric" />
          </SectionCard>
        </FadeSlideIn>

        {/* ── GENDER ── */}
        <FadeSlideIn delay={180}>
          <SectionCard title="Gender" icon="👤">
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((g) => (
                <OptionChip key={g.key} label={g.label} emoji={g.emoji}
                  selected={form.gender === g.key} color="#4C2E96"
                  onPress={() => handleChange("gender", g.key)} />
              ))}
            </View>
          </SectionCard>
        </FadeSlideIn>

        {/* ── ACTIVITY ── */}
        <FadeSlideIn delay={240}>
          <SectionCard title="Activity Level" icon="🏃">
            <View style={styles.activityRow}>
              {ACTIVITY_OPTIONS.map((a) => (
                <Pressable key={a.key} onPress={() => handleChange("activityLevel", a.key)}
                  style={{ flex: 1 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.activityLevel === a.key }}
                  accessibilityLabel={`${a.label}: ${a.desc}`}>
                  <View style={[
                    styles.activityCard,
                    form.activityLevel === a.key && {
                      borderColor: a.color, borderWidth: 2,
                      backgroundColor: a.color + "10",
                    },
                  ]}>
                    {form.activityLevel === a.key &&
                      <View style={[styles.activityDot, { backgroundColor: a.color }]} />}
                    <Text style={styles.activityEmoji}>{a.emoji}</Text>
                    <Text style={[styles.activityLabel,
                      form.activityLevel === a.key && { color: a.color }]}>
                      {a.label}
                    </Text>
                    <Text style={styles.activityDesc}>{a.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </SectionCard>
        </FadeSlideIn>

        {/* ── GOAL ── */}
        <FadeSlideIn delay={300}>
          <SectionCard title="Fitness Goal" icon="🎯">
            <View style={styles.activityRow}>
              {GOAL_OPTIONS.map((g) => (
                <Pressable key={g.key} onPress={() => handleChange("goal", g.key)}
                  style={{ flex: 1 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.goal === g.key }}
                  accessibilityLabel={`${g.label}: ${g.desc}`}>
                  <View style={[
                    styles.activityCard,
                    form.goal === g.key && {
                      borderColor: g.color, borderWidth: 2,
                      backgroundColor: g.color + "10",
                    },
                  ]}>
                    {form.goal === g.key &&
                      <View style={[styles.activityDot, { backgroundColor: g.color }]} />}
                    <Text style={styles.activityEmoji}>{g.emoji}</Text>
                    <Text style={[styles.activityLabel,
                      form.goal === g.key && { color: g.color }]}>
                      {g.label}
                    </Text>
                    <Text style={styles.activityDesc}>{g.desc}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </SectionCard>
        </FadeSlideIn>

        {/* ── DIET ── */}
        <FadeSlideIn delay={360}>
          <SectionCard title="Diet Preference" icon="🥗">
            <View style={styles.chipRow}>
              {DIET_OPTIONS.map((d) => (
                <OptionChip key={d.key} label={d.label} emoji={d.emoji}
                  selected={form.dietType === d.key} color="#10B981"
                  onPress={() => handleChange("dietType", d.key)} />
              ))}
            </View>
          </SectionCard>
        </FadeSlideIn>

        {/* ── HEALTH CONDITIONS ── */}
        <FadeSlideIn delay={390}>
          <SectionCard title="Health Conditions" icon="🏥">
            <Text style={styles.fieldLabel}>Diseases / Conditions (comma separated)</Text>
            <AnimatedInput
              icon="💊"
              placeholder="e.g. diabetes, hypertension"
              value={form.diseases}
              onChangeText={(v) => handleChange("diseases", v)}
            />
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Allergies (comma separated)</Text>
            <AnimatedInput
              icon="⚠️"
              placeholder="e.g. peanuts, gluten, dairy"
              value={form.allergies}
              onChangeText={(v) => handleChange("allergies", v)}
            />
          </SectionCard>
        </FadeSlideIn>

        {/* ── SUBMIT ── */}
        <FadeSlideIn delay={420}>
          <Pressable onPress={submitProfile} onPressIn={onBtnIn}
            onPressOut={onBtnOut} disabled={submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting, busy: submitting }}
            accessibilityLabel="Create my plan">
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <LinearGradient
                colors={submitting ? ["#9A94AE", "#9A94AE"] : ["#4C2E96", "#6339B8", "#8257D6"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.submitBtn}
              >
                {submitting ? (
                  <View style={styles.submittingRow}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.submitBtnText}>Creating your plan…</Text>
                  </View>
                ) : (
                  <Text style={styles.submitBtnText}>🚀  Create My Plan</Text>
                )}
              </LinearGradient>
            </Animated.View>
          </Pressable>
        </FadeSlideIn>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 56 },

  blobTop: {
    position: "absolute", top: -80, right: -70,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: "#4C2E9610",
  },
  blobBottom: {
    position: "absolute", bottom: 100, left: -60,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: "#8257D60C",
  },

  headerWrap:    { alignItems: "center", marginBottom: 28 },
  stepRow:       { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  stepDone: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#22C55E",
    justifyContent: "center", alignItems: "center",
  },
  stepDoneText:  { color: "#fff", fontSize: 14, fontWeight: "800" },
  stepLine:      { width: 36, height: 2, backgroundColor: "#4C2E96", marginHorizontal: 6 },
  stepActive: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
  },
  stepActiveText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  stepLabel:  { fontSize: 12, color: "#9A94AE", fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  title:      { fontSize: 26, fontWeight: "900", color: "#1B1730", letterSpacing: -0.6, marginBottom: 6 },
  subtitle:   { fontSize: 14, color: "#9A94AE", fontWeight: "500" },

  sectionCard: {
    backgroundColor: "#fff", borderRadius: 22,
    padding: 18, marginBottom: 14,
    boxShadow: "0px 2px 12px rgba(15,23,42,0.07)",
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#EDE9FE",
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  sectionIcon:  { fontSize: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#1B1730", letterSpacing: -0.2 },

  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#6B667D", marginBottom: 6, letterSpacing: 0.2 },
  metricsRow: { flexDirection: "row", marginBottom: 12 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F5F3FF", borderRadius: 14,
    borderWidth: 1.5, marginBottom: 0,
    paddingHorizontal: 12, paddingVertical: 2,
  },
  inputIcon: { fontSize: 15, marginRight: 8 },
  input: {
    flex: 1, paddingVertical: 12,
    fontSize: 15, color: "#1B1730", fontWeight: "500",
  },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F5F3FF", borderRadius: 24,
    borderWidth: 1.5, borderColor: "#E4E0F0",
    paddingVertical: 10, paddingHorizontal: 18, gap: 6,
  },
  chipEmoji: { fontSize: 16 },
  chipText:  { fontSize: 13, color: "#6B667D", fontWeight: "600" },

  activityRow: { flexDirection: "row", gap: 10 },
  activityCard: {
    flex: 1, backgroundColor: "#F5F3FF",
    borderRadius: 16, padding: 12,
    alignItems: "center", borderWidth: 2,
    borderColor: "#EDE9FE", position: "relative",
  },
  activityDot: {
    position: "absolute", top: 8, right: 8,
    width: 7, height: 7, borderRadius: 4,
  },
  activityEmoji: { fontSize: 22, marginBottom: 5 },
  activityLabel: { fontSize: 12, fontWeight: "800", color: "#1B1730", marginBottom: 3 },
  activityDesc:  { fontSize: 10, color: "#9A94AE", textAlign: "center", fontWeight: "500" },

  submitBtn: {
    borderRadius: 18, paddingVertical: 17,
    alignItems: "center", justifyContent: "center",
    boxShadow: "0px 6px 18px rgba(99,102,241,0.38)",
  },
  submittingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
});