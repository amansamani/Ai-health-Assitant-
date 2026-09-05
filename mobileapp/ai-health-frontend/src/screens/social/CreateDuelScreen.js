import { useState, useEffect } from "react";
import { showToast } from "../../services/uiFeedback";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Alert, TextInput } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import LucideIcon from "../../components/ui/LucideIcon";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { COLORS } from "../../constants/theme";
import ScreenHeader from "../../components/ScreenHeader";
import FadeSlideIn from "../../components/FadeSlideIn";
import Avatar from "../../components/Avatar";

const METRICS = [
  { key: "steps", label: "Steps", icon: "footsteps-outline", color: "#22C55E" },
  { key: "caloriesBurned", label: "Active Burn", icon: "flame-outline", color: "#F97316" },
  { key: "workouts", label: "Workouts", icon: "barbell-outline", color: COLORS.primary },
];
const DURATIONS = [3, 7, 14];

export default function CreateDuelScreen() {
  const router = useRouter();
  const { opponentId: preselectedId, opponentName: preselectedName } = useLocalSearchParams();

  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [opponentId, setOpponentId] = useState(preselectedId || null);
  const [metric, setMetric] = useState("steps");
  const [durationDays, setDurationDays] = useState(7);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (preselectedId || friendQuery.trim().length < 2) { setFriends([]); return undefined; }
    const timer = setTimeout(async () => {
      setLoadingFriends(true);
      try {
        const res = await API.get("/social/friends/search", { params: { q: friendQuery.trim(), page: 1, limit: 20 } });
        setFriends(res.data?.items || []);
      } catch { setFriends([]); }
      finally { setLoadingFriends(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [preselectedId, friendQuery]);

  const handleSend = async () => {
    if (!opponentId) {
      setErrorMsg("Pick a friend to challenge");
      return;
    }
    setErrorMsg("");
    setSending(true);
    try {
      await API.post("/social/duels", { opponentId, metric, durationDays });
      showToast("They'll see it in their Duels list.", { title: "Challenge sent", type: "success", duration: 1800 });
      setTimeout(() => router.replace("/(app)/social/duels"), 450);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to send challenge");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="New Duel" subtitle="Challenge a friend head-to-head" />

        {/* Opponent */}
        <FadeSlideIn delay={0}>
          <Text style={styles.sectionLabel}>WHO?</Text>
          {preselectedId ? (
            <View style={styles.selectedOpponent}>
              <Avatar name={preselectedName} size={40} />
              <Text style={styles.selectedOpponentName}>{preselectedName}</Text>
            </View>
          ) : (
            <>
              <View style={styles.searchWrap}>
                <LucideIcon name="search-outline" size={18} color={COLORS.textMuted} />
                <TextInput value={friendQuery} onChangeText={setFriendQuery} placeholder="Search your friends" placeholderTextColor={COLORS.textMuted} style={styles.searchInput} />
              </View>
              {loadingFriends ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={{ marginVertical: 16 }}
                />
              ) : friends.length === 0 ? (
                <View style={styles.emptyState}>
                  <LucideIcon name="people-outline" size={28} color={COLORS.textLight} />
                  <Text style={styles.emptyText}>
                    {friendQuery.trim().length < 2
                      ? "Search by name or username"
                      : "No friends found"}
                  </Text>
                </View>
              ) : (
                friends.map((f) => (
                  <Pressable
                    key={f._id}
                    onPress={() => setOpponentId(f._id)}
                    style={[
                      styles.friendPick,
                      opponentId === f._id && styles.friendPickSelected,
                    ]}
                  >
                    <Avatar name={f.name} size={36} />
                    <Text style={styles.friendPickName}>{f.name}</Text>
                    {opponentId === f._id && (
                      <LucideIcon
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    )}
                  </Pressable>
                ))
              )}
              </>
            )}
        </FadeSlideIn>

        {/* Metric */}
        <FadeSlideIn delay={80}>
          <Text style={styles.sectionLabel}>ON WHAT?</Text>
          <View style={styles.chipRow}>
            {METRICS.map((m) => (
              <Pressable
                key={m.key}
                onPress={() => setMetric(m.key)}
                style={[
                  styles.metricChip,
                  metric === m.key && { backgroundColor: m.color + "18", borderColor: m.color },
                ]}
              >
                <LucideIcon name={m.icon} size={16} color={metric === m.key ? m.color : COLORS.textMuted} />
                <Text style={[styles.metricChipText, metric === m.key && { color: m.color }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </FadeSlideIn>

        {/* Duration */}
        <FadeSlideIn delay={140}>
          <Text style={styles.sectionLabel}>FOR HOW LONG?</Text>
          <View style={styles.chipRow}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                onPress={() => setDurationDays(d)}
                style={[styles.durationChip, durationDays === d && styles.durationChipSelected]}
              >
                <Text style={[styles.durationChipText, durationDays === d && { color: "#fff" }]}>{d} days</Text>
              </Pressable>
            ))}
          </View>
        </FadeSlideIn>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

        <Pressable
          onPress={handleSend}
          disabled={sending || !opponentId}
          style={[styles.sendBtn, (sending || !opponentId) && { opacity: 0.5 }]}
        >
          {sending ? <ActivityIndicator size="small" color="#fff" /> : (
            <>
              <LucideIcon name="flash" size={18} color="#fff" />
              <Text style={styles.sendBtnText}>Send Challenge</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textLight,
    letterSpacing: 0.6, marginBottom: 10, marginTop: 4,
  },

  selectedOpponent: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: COLORS.primary, marginBottom: 8,
  },
  selectedOpponentName: { fontSize: 15, fontWeight: "700", color: COLORS.textDark },

  emptyState: { alignItems: "center", paddingVertical: 20, gap: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center" },

  friendPick: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: COLORS.border, marginBottom: 8,
  },
  friendPickSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceMuted },
  friendPickName: { flex: 1, fontSize: 14.5, fontWeight: "700", color: COLORS.textDark },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  metricChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
  },
  metricChipText: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },

  durationChip: {
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10,
  },
  durationChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  durationChipText: { fontSize: 13.5, fontWeight: "700", color: COLORS.textMuted },

  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 12, height: 48, marginBottom: 10 },
  searchInput: { flex: 1, marginLeft: 8, color: COLORS.textDark, fontSize: 13.5, fontWeight: "600" },

  errorText: { color: COLORS.error, fontSize: 12.5, fontWeight: "600", marginTop: 4, marginBottom: 8 },

  sendBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#F97316", borderRadius: 16, paddingVertical: 16, marginTop: 12,
  },
  sendBtnText: { color: "#fff", fontSize: 15.5, fontWeight: "800" },
});
