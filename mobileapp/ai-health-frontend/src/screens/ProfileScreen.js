import {
  View, Text, Pressable, StyleSheet,
  ActivityIndicator, Animated, ScrollView, Dimensions,
} from "react-native";
import { useEffect, useState, useContext, useRef } from "react";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// ── Fade + slide in animation wrapper ────────────────────────────────────────
function FadeSlideIn({ delay = 0, children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
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

// ── Goal Option Button ────────────────────────────────────────────────────────
const GOALS = [
  { key: "bulk",  label: "Bulk",  emoji: "💪", desc: "Build mass & strength",  color: "#F59E0B" },
  { key: "lean",  label: "Lean",  emoji: "🔥", desc: "Cut fat, stay toned",    color: "#EF4444" },
  { key: "fit",   label: "Fit",   emoji: "⚡", desc: "Overall fitness & health", color: "#22C55E" },
];

function GoalCard({ goal, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={{ flex: 1 }}>
      <Animated.View style={[
        styles.goalCard,
        selected && { borderColor: goal.color, borderWidth: 2 },
        { transform: [{ scale }] },
      ]}>
        {selected && (
          <View style={[styles.goalSelectedDot, { backgroundColor: goal.color }]} />
        )}
        <Text style={styles.goalEmoji}>{goal.emoji}</Text>
        <Text style={[styles.goalLabel, selected && { color: goal.color }]}>{goal.label}</Text>
        <Text style={styles.goalDesc}>{goal.desc}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Info Row ─────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Text style={styles.infoIcon}>{icon}</Text>
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || "—"}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { logout, token, setUserGoal } = useContext(AuthContext);
  const [profile, setProfile]           = useState(null);
  const [selectedGoal, setSelectedGoal] = useState("fit");
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchProfile();
  }, [token]);

  const fetchProfile = async () => {
    try {
      let storedToken = await AsyncStorage.getItem("token");
      let retries = 0;
      while (!storedToken && retries < 5) {
        await new Promise((r) => setTimeout(r, 300));
        storedToken = await AsyncStorage.getItem("token");
        retries++;
      }
      if (!storedToken) { setLoading(false); return; }
      const res = await API.get("/user/profile");
      if (res.data) {
        setProfile(res.data);
        setSelectedGoal(res.data.goal || "fit");
      }
    } catch (err) {
      console.log("Profile fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateGoal = async () => {
    try {
      setSaving(true);
      await API.put("/user/goal", { goal: selectedGoal });
      setUserGoal(selectedGoal);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      alert("Failed to update goal");
    } finally {
      setSaving(false);
    }
  };

  // Avatar initials
  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const activeGoal = GOALS.find((g) => g.key === selectedGoal) ?? GOALS[2];

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── HEADER ── */}
        <FadeSlideIn delay={0}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => navigation?.goBack()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={{ width: 40 }} />
          </View>
        </FadeSlideIn>

        {/* ── AVATAR HERO ── */}
        <FadeSlideIn delay={80}>
          <View style={styles.avatarSection}>
            <LinearGradient colors={["#6366F1", "#8B5CF6", "#A855F7"]} style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            </LinearGradient>
            <Text style={styles.profileName}>{profile?.name || "User"}</Text>
            <View style={[styles.goalBadge, { backgroundColor: activeGoal.color + "20", borderColor: activeGoal.color + "40" }]}>
              <Text style={[styles.goalBadgeText, { color: activeGoal.color }]}>
                {activeGoal.emoji} {activeGoal.label} Mode
              </Text>
            </View>
          </View>
        </FadeSlideIn>

        {/* ── INFO CARD ── */}
        <FadeSlideIn delay={160}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Info</Text>
            <InfoRow icon="👤" label="Full Name"     value={profile?.name}  />
            <View style={styles.divider} />
            <InfoRow icon="📧" label="Email Address" value={profile?.email} />
          </View>
        </FadeSlideIn>

        {/* ── GOAL SELECTOR ── */}
        <FadeSlideIn delay={240}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fitness Goal</Text>
            <Text style={styles.cardSubtitle}>Choose what you're training for</Text>
            <View style={styles.goalRow}>
              {GOALS.map((g) => (
                <GoalCard
                  key={g.key}
                  goal={g}
                  selected={selectedGoal === g.key}
                  onPress={() => setSelectedGoal(g.key)}
                />
              ))}
            </View>
          </View>
        </FadeSlideIn>

          <FadeSlideIn delay={200}>
            <Pressable onPress={() => navigation.navigate("EditHealthProfile")} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={[styles.infoIconWrap, { backgroundColor: "#F1F5F9" }]}>
                  <Text style={{ fontSize: 18 }}>🏋️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Health Profile</Text>
                  <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                    Update weight, height, activity & more
                  </Text>
                </View>
                <Text style={{ fontSize: 18, color: "#94A3B8" }}>→</Text>
              </View>
            </Pressable>
          </FadeSlideIn>

        {/* ── SAVE BUTTON ── */}
        <FadeSlideIn delay={320}>
          <Pressable
            onPress={updateGoal}
            disabled={saving}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
          >
            <LinearGradient
              colors={saved ? ["#22C55E", "#16A34A"] : ["#6366F1", "#8B5CF6"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>{saved ? "✓  Saved!" : "Save Changes"}</Text>
              }
            </LinearGradient>
          </Pressable>
        </FadeSlideIn>

        {/* ── LOGOUT ── */}
        <FadeSlideIn delay={380}>
          <Pressable onPress={logout} style={styles.logoutBtn}>
            <View style={styles.logoutInner}>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Log Out</Text>
            </View>
          </Pressable>
        </FadeSlideIn>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scroll:    { padding: 20, paddingTop: 8 },

  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  loadingText: { marginTop: 12, color: "#94A3B8", fontSize: 14, fontWeight: "500" },

  // Header
  headerRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 28,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center",
    boxShadow: "0px 2px 8px rgba(15,23,42,0.08)",
  },
  backIcon:    { fontSize: 20, color: "#0F172A", fontWeight: "700" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },

  // Avatar
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    padding: 3, marginBottom: 14,
    boxShadow: "0px 6px 20px rgba(99,102,241,0.35)",
  },
  avatarInner: {
    flex: 1, borderRadius: 45,
    backgroundColor: "#1E1B4B",
    justifyContent: "center", alignItems: "center",
  },
  avatarInitials: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  profileName:    { fontSize: 22, fontWeight: "800", color: "#0F172A", letterSpacing: -0.5, marginBottom: 10 },
  goalBadge: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  goalBadgeText: { fontSize: 13, fontWeight: "700" },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 22, padding: 20,
    marginBottom: 16,
    boxShadow: "0px 2px 12px rgba(15,23,42,0.07)",
  },
  cardTitle:    { fontSize: 16, fontWeight: "800", color: "#0F172A", marginBottom: 4, letterSpacing: -0.2 },
  cardSubtitle: { fontSize: 13, color: "#94A3B8", marginBottom: 16, fontWeight: "500" },

  // Info rows
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  infoIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center", alignItems: "center", marginRight: 14,
  },
  infoIcon:  { fontSize: 18 },
  infoText:  { flex: 1 },
  infoLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginTop: 2 },
  divider:   { height: 1, backgroundColor: "#F1F5F9", marginVertical: 2 },

  // Goal cards
  goalRow: { flexDirection: "row", gap: 10 },
  goalCard: {
    flex: 1, backgroundColor: "#F8FAFC",
    borderRadius: 16, padding: 14,
    alignItems: "center", borderWidth: 2,
    borderColor: "#F1F5F9", position: "relative",
  },
  goalSelectedDot: {
    position: "absolute", top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
  },
  goalEmoji: { fontSize: 24, marginBottom: 6 },
  goalLabel: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginBottom: 4 },
  goalDesc:  { fontSize: 10, color: "#94A3B8", textAlign: "center", fontWeight: "500", lineHeight: 14 },

  // Save button
  saveBtn: {
    borderRadius: 18, paddingVertical: 17,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
    boxShadow: "0px 6px 16px rgba(99,102,241,0.35)",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  // Logout
  logoutBtn: {
    backgroundColor: "#fff",
    borderRadius: 18, padding: 16,
    boxShadow: "0px 2px 8px rgba(15,23,42,0.06)",
  },
  logoutInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutIcon:  { fontSize: 18 },
  logoutText:  { fontSize: 15, fontWeight: "700", color: "#EF4444" },
});