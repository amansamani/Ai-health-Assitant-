import { useState, useCallback, useContext } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import { COLORS } from "../../constants/theme";
import ScreenHeader from "../../components/ScreenHeader";
import FadeSlideIn from "../../components/FadeSlideIn";
import Avatar from "../../components/Avatar";

const METRIC_META = {
  steps: { label: "Steps", icon: "footsteps-outline", color: "#22C55E" },
  caloriesBurned: { label: "Active Burn", icon: "flame-outline", color: "#F97316" },
  workouts: { label: "Workouts", icon: "barbell-outline", color: COLORS.primary },
};

function DuelCard({ duel, myId, onPress }) {
  const isChallenger = duel.challenger._id === myId;
  const opponent = isChallenger ? duel.opponent : duel.challenger;
  const meScore = isChallenger ? duel.challengerScore : duel.opponentScore;
  const themScore = isChallenger ? duel.opponentScore : duel.challengerScore;
  const meta = METRIC_META[duel.metric];
  const iWon = duel.status === "completed" && duel.winner?._id === myId;
  const iLost = duel.status === "completed" && duel.winner && duel.winner._id !== myId;

  return (
    <Pressable onPress={onPress} style={styles.duelCard}>
      <View style={styles.duelCardTop}>
        <Avatar name={opponent.name} size={36} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.duelOpponent}>
            {duel.status === "pending" && !isChallenger ? "Challenged you" : `vs ${opponent.name}`}
          </Text>
          <View style={styles.duelMetaRow}>
            <Ionicons name={meta.icon} size={12} color={meta.color} />
            <Text style={styles.duelMetaText}>{meta.label} · {duel.durationDays}d</Text>
          </View>
        </View>
        {duel.status === "completed" && (
          <View style={[styles.resultBadge, iWon ? styles.wonBadge : iLost ? styles.lostBadge : styles.tieBadge]}>
            <Text style={styles.resultBadgeText}>{iWon ? "Won" : iLost ? "Lost" : "Tie"}</Text>
          </View>
        )}
        {duel.status === "pending" && isChallenger && (
          <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Waiting</Text></View>
        )}
      </View>

      {(duel.status === "active" || duel.status === "completed") && (
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreText, { color: meta.color }]}>{meScore ?? 0}</Text>
          <Text style={styles.scoreVs}>vs</Text>
          <Text style={styles.scoreText}>{themScore ?? 0}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function DuelsScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const [duels, setDuels] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDuels = useCallback(async () => {
    try {
      const res = await API.get("/social/duels");
      setDuels(res.data);
    } catch (err) {
      console.log("Failed to load duels:", err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchDuels(); }, [fetchDuels]));

  const myId = user?.id ?? user?._id;
  const needsResponse = duels.filter((d) => d.status === "pending" && d.opponent._id === myId);
  const sent = duels.filter((d) => d.status === "pending" && d.challenger._id === myId);
  const active = duels.filter((d) => d.status === "active");
  const finished = duels.filter((d) => ["completed", "declined", "cancelled"].includes(d.status));

  const Section = ({ title, items }) =>
    items.length === 0 ? null : (
      <>
        <Text style={styles.sectionLabel}>{title}</Text>
        {items.map((d, i) => (
          <FadeSlideIn key={d._id} delay={i * 40}>
            <DuelCard duel={d} myId={myId} onPress={() => router.push({ pathname: "/(app)/social/duel-detail", params: { id: d._id } })} />
          </FadeSlideIn>
        ))}
      </>
    );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader
          title="Duels"
          subtitle={`${active.length} active`}
          rightAction={
            <Pressable onPress={() => router.push("/(app)/social/create-duel")} style={styles.newBtn} accessibilityRole="button" accessibilityLabel="New duel">
              <Ionicons name="add" size={20} color="#fff" />
            </Pressable>
          }
        />

        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : duels.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flash-outline" size={32} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No duels yet — challenge a friend to get started</Text>
          </View>
        ) : (
          <>
            <Section title="NEEDS YOUR RESPONSE" items={needsResponse} />
            <Section title="ACTIVE" items={active} />
            <Section title="WAITING ON THEM" items={sent} />
            <Section title="PAST DUELS" items={finished} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  newBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#F97316", alignItems: "center", justifyContent: "center",
  },

  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textLight,
    letterSpacing: 0.6, marginBottom: 10, marginTop: 16,
  },

  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 30 },

  duelCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  duelCardTop: { flexDirection: "row", alignItems: "center" },
  duelOpponent: { fontSize: 14.5, fontWeight: "700", color: COLORS.textDark },
  duelMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  duelMetaText: { fontSize: 11.5, color: COLORS.textMuted, fontWeight: "600" },

  pendingBadge: { backgroundColor: COLORS.surfaceMuted, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  pendingBadgeText: { fontSize: 10.5, fontWeight: "700", color: COLORS.textMuted },
  resultBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  wonBadge: { backgroundColor: "#DCFCE7" },
  lostBadge: { backgroundColor: "#FEE2E2" },
  tieBadge: { backgroundColor: COLORS.surfaceMuted },
  resultBadgeText: { fontSize: 10.5, fontWeight: "800", color: COLORS.textDark },

  scoreRow: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 10,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  scoreText: { fontSize: 20, fontWeight: "800", color: COLORS.textDark },
  scoreVs: { fontSize: 11, fontWeight: "700", color: COLORS.textLight },
});
