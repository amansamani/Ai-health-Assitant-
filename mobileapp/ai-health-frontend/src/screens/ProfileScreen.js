import {
  View, Text, Pressable, StyleSheet,
  ActivityIndicator, Animated, ScrollView, Alert,
} from "react-native";
import { useEffect, useState, useContext, useRef } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { getToken } from "../utils/secureToken";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../constants/theme";

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

// ── Goal Option Card ──────────────────────────────────────────────────────────
const GOALS = [
  { key: "bulk", label: "Bulk", icon: "barbell-outline", desc: "Build mass & strength",    color: COLORS.warning },
  { key: "lean", label: "Lean", icon: "flame-outline",   desc: "Cut fat, stay toned",       color: COLORS.error },
  { key: "fit",  label: "Fit",  icon: "flash-outline",   desc: "Overall fitness & health",  color: COLORS.success },
];

function GoalCard({ goal, selected, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress} onPressIn={onIn} onPressOut={onOut}
      style={{ flex: 1 }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${goal.label}: ${goal.desc}`}
    >
      <Animated.View style={[
        styles.goalCard,
        selected && { borderColor: goal.color, borderWidth: 2, backgroundColor: goal.color + "10" },
        { transform: [{ scale }] },
      ]}>
        {selected && <View style={[styles.goalSelectedDot, { backgroundColor: goal.color }]} />}
        <Ionicons name={goal.icon} size={22} color={selected ? goal.color : COLORS.textMuted} style={{ marginBottom: 6 }} />
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
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || "—"}</Text>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
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
      let storedToken = await getToken();
      let retries = 0;
      while (!storedToken && retries < 5) {
        await new Promise((r) => setTimeout(r, 300));
        storedToken = await getToken();
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
      Alert.alert("Error", "Failed to update goal. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Avatar initials
  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const activeGoal = GOALS.find((g) => g.key === selectedGoal) ?? GOALS[2];
  const hasGoalChanged = selectedGoal !== (profile?.goal || "fit");

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.headerIconWrap}>
              <Ionicons name="person-circle-outline" size={22} color={COLORS.primary} />
            </View>
          </View>
        </FadeSlideIn>

        {/* ── AVATAR HERO ── */}
        <FadeSlideIn delay={80}>
          <View style={styles.avatarSection}>
            <LinearGradient colors={[COLORS.primaryDark, COLORS.primary, COLORS.primaryLight]} style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            </LinearGradient>
            <Text style={styles.profileName}>{profile?.name || "User"}</Text>
            <View style={[styles.goalBadge, { backgroundColor: activeGoal.color + "18", borderColor: activeGoal.color + "40" }]}>
              <Ionicons name={activeGoal.icon} size={13} color={activeGoal.color} style={{ marginRight: 5 }} />
              <Text style={[styles.goalBadgeText, { color: activeGoal.color }]}>{activeGoal.label} Mode</Text>
            </View>
          </View>
        </FadeSlideIn>

        {/* ── INFO CARD ── */}
        <FadeSlideIn delay={160}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account Info</Text>
            <InfoRow icon="person-outline" label="Full Name"     value={profile?.name}  />
            <View style={styles.divider} />
            <InfoRow icon="mail-outline"   label="Email Address" value={profile?.email} />
          </View>
        </FadeSlideIn>

        {/* ── HEALTH PROFILE LINK ── */}
        <FadeSlideIn delay={200}>
          <Pressable
            onPress={() => router.push("/(app)/edit-health-profile")}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Edit health profile: update weight, height, activity and more"
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[styles.infoIconWrap, { backgroundColor: COLORS.surfaceMuted }]}>
                <Ionicons name="body-outline" size={18} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>Health Profile</Text>
                <Text style={styles.cardSubtitle}>Update weight, height, activity & more</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </View>
          </Pressable>
        </FadeSlideIn>

        {/* ── FITNESS GOAL ── */}
        <FadeSlideIn delay={260}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fitness Goal</Text>
            <Text style={styles.cardSubtitle}>Changing this updates your workout & diet plan</Text>
            <View style={styles.goalRow}>
              {GOALS.map((g) => (
                <GoalCard key={g.key} goal={g} selected={selectedGoal === g.key} onPress={() => setSelectedGoal(g.key)} />
              ))}
            </View>
          </View>
        </FadeSlideIn>

        {/* ── SAVE BUTTON ── */}
        <FadeSlideIn delay={320}>
          <Pressable
            onPress={updateGoal}
            disabled={saving || !hasGoalChanged}
            style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving || !hasGoalChanged }}
            accessibilityLabel="Save changes"
          >
            <LinearGradient
              colors={saved ? ["#22C55E", "#16A34A"] : (!hasGoalChanged && !saving) ? [COLORS.textLight, COLORS.textLight] : [COLORS.primaryDark, COLORS.primary]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveBtn}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {saved && <Ionicons name="checkmark" size={18} color="#fff" style={{ marginRight: 6 }} />}
                    <Text style={styles.saveBtnText}>{saved ? "Saved!" : "Save Changes"}</Text>
                  </View>
                )
              }
            </LinearGradient>
          </Pressable>
        </FadeSlideIn>

        {/* ── LOGOUT ── */}
        <FadeSlideIn delay={380}>
          <Pressable
            onPress={logout}
            style={styles.logoutBtn}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <View style={styles.logoutInner}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
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
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll:    { padding: 20, paddingTop: 8 },

  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14, fontWeight: "500" },

  // Header
  headerRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 22,
  },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surfaceMuted, justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.5 },

  // Avatar
  avatarSection: { alignItems: "center", marginBottom: 28 },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    padding: 3, marginBottom: 14,
    boxShadow: "0px 6px 20px rgba(76,46,150,0.35)",
  },
  avatarInner: {
    flex: 1, borderRadius: 45,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center", alignItems: "center",
  },
  avatarInitials: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  profileName:    { fontSize: 22, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.5, marginBottom: 10 },
  goalBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  goalBadgeText: { fontSize: 13, fontWeight: "700" },

  // Card
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22, padding: 20,
    marginBottom: 16,
    boxShadow: "0px 2px 12px rgba(23,15,54,0.07)",
  },
  cardTitle:    { fontSize: 16, fontWeight: "800", color: COLORS.textDark, marginBottom: 4, letterSpacing: -0.2 },
  cardSubtitle: { fontSize: 13, color: COLORS.textMuted, marginBottom: 16, fontWeight: "500" },

  // Info rows
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  infoIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    justifyContent: "center", alignItems: "center", marginRight: 14,
  },
  infoText:  { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  infoValue: { fontSize: 15, fontWeight: "700", color: COLORS.textDark, marginTop: 2 },
  divider:   { height: 1, backgroundColor: COLORS.surfaceMuted, marginVertical: 2 },

  // Goal cards
  goalRow: { flexDirection: "row", gap: 10 },
  goalCard: {
    flex: 1, backgroundColor: COLORS.surfaceMuted,
    borderRadius: 16, padding: 14,
    alignItems: "center", borderWidth: 2,
    borderColor: "transparent", position: "relative",
  },
  goalSelectedDot: {
    position: "absolute", top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
  },
  goalLabel: { fontSize: 14, fontWeight: "800", color: COLORS.textDark, marginBottom: 4 },
  goalDesc:  { fontSize: 10, color: COLORS.textMuted, textAlign: "center", fontWeight: "500", lineHeight: 14 },

  // Save button
  saveBtn: {
    borderRadius: 18, paddingVertical: 17,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
    boxShadow: "0px 6px 16px rgba(76,46,150,0.3)",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  // Logout
  logoutBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 18, padding: 16,
    boxShadow: "0px 2px 8px rgba(23,15,54,0.06)",
  },
  logoutInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText:  { fontSize: 15, fontWeight: "700", color: COLORS.error },
});
