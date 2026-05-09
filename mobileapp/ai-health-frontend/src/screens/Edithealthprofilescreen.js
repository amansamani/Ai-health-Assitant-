import React, { useState, useRef, useEffect, useContext } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  Pressable, ActivityIndicator, Animated, KeyboardAvoidingView,
  Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { AuthContext } from "../context/AuthContext";
import API from "../services/api";

// ── Animated Input ────────────────────────────────────────────────────────────
function AnimatedInput({ icon, label, placeholder, value, onChangeText, keyboardType }) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 180, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1], outputRange: ["#E2E8F0", "#6366F1"],
  });

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
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
          keyboardType={keyboardType ?? "default"}
        />
      </Animated.View>
    </View>
  );
}

// ── Selector Card (like activity/goal) ───────────────────────────────────────
function SelectorCard({ option, selected, color, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={{ flex: 1 }}>
      <Animated.View style={[
        styles.selectorCard,
        selected && { borderColor: color, borderWidth: 2, backgroundColor: color + "12" },
        { transform: [{ scale }] },
      ]}>
        {selected && <View style={[styles.selDot, { backgroundColor: color }]} />}
        <Text style={styles.selEmoji}>{option.emoji}</Text>
        <Text style={[styles.selLabel, selected && { color }]}>{option.label}</Text>
        {option.desc ? <Text style={styles.selDesc}>{option.desc}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

// ── Chip (gender / diet) ──────────────────────────────────────────────────────
function Chip({ option, selected, color, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <View style={[
        styles.chip,
        selected && { borderColor: color, borderWidth: 2, backgroundColor: color + "14" },
      ]}>
        <Text style={styles.chipEmoji}>{option.emoji}</Text>
        <Text style={[styles.chipText, selected && { color, fontWeight: "800" }]}>
          {option.label}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
function Section({ icon, title, children, delay }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 450, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 450, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.section, { opacity, transform: [{ translateY }] }]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Text style={styles.sectionIcon}>{icon}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </Animated.View>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const GENDER_OPTIONS = [
  { key: "male",   label: "Male",   emoji: "👨" },
  { key: "female", label: "Female", emoji: "👩" },
];

const ACTIVITY_OPTIONS = [
  { key: "sedentary", label: "Sedentary", emoji: "🛋️", desc: "Little movement",   color: "#94A3B8" },
  { key: "moderate",  label: "Moderate",  emoji: "🚶", desc: "Light exercise",     color: "#F59E0B" },
  { key: "active",    label: "Active",    emoji: "🏃", desc: "Regular training",   color: "#22C55E" },
];

const GOAL_OPTIONS = [
  { key: "lose",     label: "Lose",     emoji: "🔥", desc: "Cut fat",       color: "#EF4444" },
  { key: "maintain", label: "Maintain", emoji: "⚖️", desc: "Stay healthy",  color: "#6366F1" },
  { key: "gain",     label: "Gain",     emoji: "💪", desc: "Build mass",    color: "#F59E0B" },
];

const DIET_OPTIONS = [
  { key: "veg",     label: "Veg",     emoji: "🥦" },
  { key: "non-veg", label: "Non-Veg", emoji: "🍗" },
  { key: "vegan",   label: "Vegan",   emoji: "🌱" },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function EditHealthProfileScreen({ navigation }) {
  const { fetchUserGoal } = useContext(AuthContext);

  const [form, setForm] = useState({
    age: "", gender: "male", height: "", weight: "",
    activityLevel: "moderate", goal: "maintain", dietType: "non-veg",
  });
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [showRegen, setShowRegen]   = useState(false);

  // Header fade
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY       = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerY,       { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    fetchCurrentProfile();
  }, []);

  const fetchCurrentProfile = async () => {
    try {
      const res = await API.get("/health");
      const d = res.data ?? {};
      setForm({
        age:           String(d.age           ?? ""),
        gender:        d.gender        ?? "male",
        height:        String(d.height  ?? ""),
        weight:        String(d.weight  ?? ""),
        activityLevel: d.activityLevel ?? "moderate",
        goal:          d.goal          ?? "maintain",
        dietType:      d.dietType      ?? "non-veg",
      });
    } catch (err) {
      console.log("Fetch health profile error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const saveProfile = async () => {
    if (!form.age || !form.height || !form.weight) {
      Alert.alert("Missing Fields", "Please fill in Age, Height, and Weight.");
      return;
    }
    try {
      setSaving(true);
      await API.put("/health", {
        age:           Number(form.age),
        gender:        form.gender,
        height:        Number(form.height),
        weight:        Number(form.weight),
        activityLevel: form.activityLevel,
        goal:          form.goal,
        dietType:      form.dietType,
      });
      // Also sync goal to user model
      const GOAL_TO_USER = { lose: "lean", maintain: "fit", gain: "bulk" };
      await API.put("/user/goal", { goal: GOAL_TO_USER[form.goal] ?? "fit" });

      await fetchUserGoal(); // refresh context
      setSaved(true);
      setShowRegen(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const regeneratePlan = async () => {
    try {
      setRegenerating(true);
      await API.post("/nutrition/generate");
      setShowRegen(false);
      Alert.alert("✅ Done!", "Your new diet plan has been generated based on your updated profile.", [
        { text: "View Plan", onPress: () => navigation?.navigate("NutritionDashboard") },
        { text: "OK" },
      ]);
    } catch {
      Alert.alert("Error", "Could not regenerate plan. Try again.");
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading your profile…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── HEADER ── */}
          <Animated.View style={[styles.headerRow, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}>
            <Pressable onPress={() => navigation?.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </Pressable>
            <View>
              <Text style={styles.headerTitle}>Health Profile</Text>
              <Text style={styles.headerSub}>Update your body stats</Text>
            </View>
            <View style={{ width: 40 }} />
          </Animated.View>

          {/* ── REGEN BANNER ── */}
          {showRegen && (
            <Animated.View style={styles.regenBanner}>
              <View style={{ flex: 1 }}>
                <Text style={styles.regenBannerTitle}>Profile saved! 🎉</Text>
                <Text style={styles.regenBannerSub}>Regenerate diet plan with new data?</Text>
              </View>
              <Pressable
                onPress={regeneratePlan}
                disabled={regenerating}
                style={styles.regenBannerBtn}
              >
                {regenerating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.regenBannerBtnText}>Regenerate</Text>
                }
              </Pressable>
            </Animated.View>
          )}

          {/* ── BODY METRICS ── */}
          <Section icon="📏" title="Body Metrics" delay={60}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <AnimatedInput
                  icon="🎂" label="Age" placeholder="Years"
                  value={form.age} onChangeText={(v) => handleChange("age", v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <AnimatedInput
                  icon="📐" label="Height (cm)" placeholder="cm"
                  value={form.height} onChangeText={(v) => handleChange("height", v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <AnimatedInput
              icon="⚖️" label="Weight (kg)" placeholder="kg"
              value={form.weight} onChangeText={(v) => handleChange("weight", v)}
              keyboardType="numeric"
            />
          </Section>

          {/* ── GENDER ── */}
          <Section icon="👤" title="Gender" delay={120}>
            <View style={styles.chipRow}>
              {GENDER_OPTIONS.map((g) => (
                <Chip
                  key={g.key} option={g}
                  selected={form.gender === g.key}
                  color="#6366F1"
                  onPress={() => handleChange("gender", g.key)}
                />
              ))}
            </View>
          </Section>

          {/* ── ACTIVITY ── */}
          <Section icon="🏃" title="Activity Level" delay={180}>
            <View style={styles.selectorRow}>
              {ACTIVITY_OPTIONS.map((a) => (
                <SelectorCard
                  key={a.key} option={a}
                  selected={form.activityLevel === a.key}
                  color={a.color}
                  onPress={() => handleChange("activityLevel", a.key)}
                />
              ))}
            </View>
          </Section>

          {/* ── GOAL ── */}
          <Section icon="🎯" title="Fitness Goal" delay={240}>
            <View style={styles.selectorRow}>
              {GOAL_OPTIONS.map((g) => (
                <SelectorCard
                  key={g.key} option={g}
                  selected={form.goal === g.key}
                  color={g.color}
                  onPress={() => handleChange("goal", g.key)}
                />
              ))}
            </View>
          </Section>

          {/* ── DIET ── */}
          <Section icon="🥗" title="Diet Preference" delay={300}>
            <View style={styles.chipRow}>
              {DIET_OPTIONS.map((d) => (
                <Chip
                  key={d.key} option={d}
                  selected={form.dietType === d.key}
                  color="#10B981"
                  onPress={() => handleChange("dietType", d.key)}
                />
              ))}
            </View>
          </Section>

          {/* ── SAVE BUTTON ── */}
          <Pressable
            onPress={saveProfile}
            disabled={saving}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, marginTop: 8 }]}
          >
            <LinearGradient
              colors={saved ? ["#22C55E", "#16A34A"] : ["#6366F1", "#8B5CF6"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>
                    {saved ? "✓  Saved!" : "Save Changes"}
                  </Text>
              }
            </LinearGradient>
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#F8FAFC" },
  scroll:      { padding: 20, paddingTop: 8 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  loadingText: { marginTop: 12, color: "#94A3B8", fontSize: 14, fontWeight: "500" },

  // Header
  headerRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 20,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center",
    shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  backIcon:    { fontSize: 20, color: "#0F172A", fontWeight: "700" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3, textAlign: "center" },
  headerSub:   { fontSize: 12, color: "#94A3B8", fontWeight: "500", textAlign: "center", marginTop: 2 },

  // Regen banner
  regenBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0F172A", borderRadius: 18,
    padding: 16, marginBottom: 18, gap: 12,
  },
  regenBannerTitle: { fontSize: 14, fontWeight: "800", color: "#fff" },
  regenBannerSub:   { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  regenBannerBtn: {
    backgroundColor: "#6366F1", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    minWidth: 100, alignItems: "center",
  },
  regenBannerBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  // Section
  section: {
    backgroundColor: "#fff", borderRadius: 22,
    padding: 18, marginBottom: 14,
    shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  sectionIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center", alignItems: "center", marginRight: 10,
  },
  sectionIcon:  { fontSize: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },

  // Input
  row:        { flexDirection: "row", marginBottom: 0 },
  inputGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase" },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8FAFC", borderRadius: 14,
    borderWidth: 1.5, paddingHorizontal: 12,
  },
  inputIcon: { fontSize: 15, marginRight: 8 },
  input: {
    flex: 1, paddingVertical: 13,
    fontSize: 15, color: "#0F172A", fontWeight: "600",
  },

  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F8FAFC", borderRadius: 24,
    borderWidth: 1.5, borderColor: "#E2E8F0",
    paddingVertical: 10, paddingHorizontal: 18, gap: 6,
  },
  chipEmoji: { fontSize: 16 },
  chipText:  { fontSize: 13, color: "#64748B", fontWeight: "600" },

  // Selector cards
  selectorRow: { flexDirection: "row", gap: 8 },
  selectorCard: {
    flex: 1, backgroundColor: "#F8FAFC",
    borderRadius: 16, padding: 12,
    alignItems: "center", borderWidth: 2,
    borderColor: "#F1F5F9", position: "relative",
  },
  selDot: {
    position: "absolute", top: 7, right: 7,
    width: 7, height: 7, borderRadius: 4,
  },
  selEmoji: { fontSize: 22, marginBottom: 5 },
  selLabel: { fontSize: 12, fontWeight: "800", color: "#0F172A", marginBottom: 2 },
  selDesc:  { fontSize: 10, color: "#94A3B8", textAlign: "center", fontWeight: "500" },

  // Save button
  saveBtn: {
    borderRadius: 18, paddingVertical: 17,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#6366F1", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
});