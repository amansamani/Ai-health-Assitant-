import { useState, useCallback, useContext } from "react";
import { showToast } from "../../services/uiFeedback";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter, useLocalSearchParams } from "expo-router";
import LucideIcon from "../../components/ui/LucideIcon";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { COLORS } from "../../constants/theme";
import Avatar from "../../components/Avatar";
import FadeSlideIn from "../../components/FadeSlideIn";

const METRIC_META = {
  steps: { label: "Steps", icon: "footsteps-outline" },
  caloriesBurned: { label: "Active Burn (kcal)", icon: "flame-outline" },
  workouts: { label: "Workouts Completed", icon: "barbell-outline" },
};

export default function DuelDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useContext(AuthContext);
  const [duel, setDuel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const fetchDuel = useCallback(async () => {
    try {
      const res = await API.get(`/social/duels/${id}`);
      setDuel(res.data);
    } catch (err) {
      console.log("Failed to load duel:", err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { fetchDuel(); }, [fetchDuel]));

  const myId = user?.id ?? user?._id;

  const respond = async (action) => {
    setActing(true);
    try {
      await API.post(`/social/duels/${id}/respond`, { action });
      fetchDuel();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to respond", { title: "Something went wrong", type: "error" });
    } finally {
      setActing(false);
    }
  };

  const cancel = async () => {
    setActing(true);
    try {
      await API.post(`/social/duels/${id}/cancel`);
      router.back();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to cancel", { title: "Something went wrong", type: "error" });
      setActing(false);
    }
  };

  if (loading || !duel) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const isChallenger = duel.challenger._id === myId;
  const me = isChallenger ? duel.challenger : duel.opponent;
  const them = isChallenger ? duel.opponent : duel.challenger;
  const myScore = isChallenger ? duel.challengerScore : duel.opponentScore;
  const theirScore = isChallenger ? duel.opponentScore : duel.challengerScore;
  const meta = METRIC_META[duel.metric];
  const total = (myScore || 0) + (theirScore || 0);
  const myShare = total > 0 ? (myScore || 0) / total : 0.5;

  const iWon = duel.status === "completed" && duel.winner?._id === myId;
  const iLost = duel.status === "completed" && duel.winner && duel.winner._id !== myId;
  const isTie = duel.status === "completed" && !duel.winner;

  const daysLeft = duel.endDate
    ? Math.max(0, Math.ceil((new Date(duel.endDate) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <LinearGradient colors={["#170F36", "#49225B"]} style={styles.hero}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
            <LucideIcon name="chevron-back" size={20} color="#fff" />
          </Pressable>

          <View style={styles.vsRow}>
            <View style={styles.vsPlayer}>
              <Avatar name={me.name} size={56} />
              <Text style={styles.vsName}>You</Text>
            </View>
            <Text style={styles.vsLabel}>VS</Text>
            <View style={styles.vsPlayer}>
              <Avatar name={them.name} size={56} highlight />
              <Text style={styles.vsName}>{them.name}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <LucideIcon name={meta.icon} size={13} color="#B8AFD6" />
            <Text style={styles.metaText}>{meta.label} · {duel.durationDays}-day duel</Text>
          </View>

          {duel.status === "active" && daysLeft != null && (
            <Text style={styles.daysLeft}>{daysLeft === 0 ? "Ends today" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}</Text>
          )}
        </LinearGradient>

        {(duel.status === "active" || duel.status === "completed") && (
          <FadeSlideIn delay={0}>
            <View style={styles.scoreCard}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreNum}>{myScore ?? 0}</Text>
                <Text style={styles.scoreNum}>{theirScore ?? 0}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.round(myShare * 100)}%` }]} />
              </View>

              {duel.status === "completed" && (
                <View style={[styles.resultBanner, iWon ? styles.wonBanner : iLost ? styles.lostBanner : styles.tieBanner]}>
                  <LucideIcon name={iWon ? "trophy" : isTie ? "flag-outline" : "sad-outline"} size={18} color={iWon ? "#15803D" : isTie ? COLORS.textMuted : "#B91C1C"} />
                  <Text style={[styles.resultBannerText, { color: iWon ? "#15803D" : isTie ? COLORS.textMuted : "#B91C1C" }]}>
                    {iWon ? "You won this duel!" : isTie ? "It's a tie" : `${them.name} won this one`}
                  </Text>
                </View>
              )}
            </View>
          </FadeSlideIn>
        )}

        {duel.status === "pending" && !isChallenger && (
          <FadeSlideIn delay={0}>
            <Text style={styles.promptText}>{them.name} challenged you to this duel.</Text>
            <Pressable onPress={() => respond("accept")} disabled={acting} style={[styles.actionBtn, styles.acceptBtn]}>
              {acting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnText}>Accept Challenge</Text>}
            </Pressable>
            <Pressable onPress={() => respond("decline")} disabled={acting} style={[styles.actionBtn, styles.declineBtn]}>
              <Text style={[styles.actionBtnText, { color: COLORS.textMuted }]}>Decline</Text>
            </Pressable>
          </FadeSlideIn>
        )}

        {duel.status === "pending" && isChallenger && (
          <FadeSlideIn delay={0}>
            <Text style={styles.promptText}>Waiting for {them.name} to respond.</Text>
            <Pressable onPress={cancel} disabled={acting} style={[styles.actionBtn, styles.declineBtn]}>
              {acting ? <ActivityIndicator size="small" color={COLORS.textMuted} /> : <Text style={[styles.actionBtnText, { color: COLORS.textMuted }]}>Cancel Challenge</Text>}
            </Pressable>
          </FadeSlideIn>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 40 },

  hero: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  backBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center", marginBottom: 18,
  },
  vsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 24 },
  vsPlayer: { alignItems: "center", gap: 8 },
  vsName: { color: "#fff", fontWeight: "700", fontSize: 13 },
  vsLabel: { color: "#B8AFD6", fontWeight: "800", fontSize: 13, letterSpacing: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18 },
  metaText: { color: "#B8AFD6", fontSize: 12, fontWeight: "600" },
  daysLeft: { color: "#fff", fontSize: 12.5, fontWeight: "700", textAlign: "center", marginTop: 6 },

  scoreCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 18,
    marginHorizontal: 16, marginTop: -14, borderWidth: 1, borderColor: COLORS.border,
  },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  scoreNum: { fontSize: 30, fontWeight: "800", color: COLORS.textDark },
  progressBarBg: { height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceMuted, overflow: "hidden" },
  progressBarFill: { height: "100%", backgroundColor: "#F97316", borderRadius: 4 },

  resultBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, padding: 12, marginTop: 16 },
  wonBanner: { backgroundColor: "#DCFCE7" },
  lostBanner: { backgroundColor: "#FEE2E2" },
  tieBanner: { backgroundColor: COLORS.surfaceMuted },
  resultBannerText: { fontSize: 13.5, fontWeight: "800" },

  promptText: { textAlign: "center", color: COLORS.textMuted, fontSize: 13.5, fontWeight: "600", marginTop: 24, marginHorizontal: 30, marginBottom: 16 },
  actionBtn: { marginHorizontal: 20, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginBottom: 10 },
  acceptBtn: { backgroundColor: "#F97316" },
  declineBtn: { backgroundColor: COLORS.surfaceMuted },
  actionBtnText: { fontSize: 15, fontWeight: "800", color: "#fff" },
});
