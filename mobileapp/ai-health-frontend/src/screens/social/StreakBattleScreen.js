import { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { COLORS } from "../../constants/theme";
import ScreenHeader from "../../components/ScreenHeader";
import FadeSlideIn from "../../components/FadeSlideIn";
import Avatar from "../../components/Avatar";

const STREAK_ICONS = {
  workout: { icon: "barbell-outline", color: COLORS.primary, label: "Workout" },
  steps: { icon: "footsteps-outline", color: "#22C55E", label: "Steps" },
  caloriesBurned: { icon: "flame-outline", color: "#F97316", label: "Active Burn" },
};

function StreakPill({ type, value }) {
  const meta = STREAK_ICONS[type];
  return (
    <View style={[pillStyles.pill, { backgroundColor: meta.color + "14" }]}>
      <Ionicons name={meta.icon} size={12} color={meta.color} />
      <Text style={[pillStyles.text, { color: meta.color }]}>{value}d</Text>
    </View>
  );
}

export default function StreakBattleScreen() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [compareData, setCompareData] = useState({});
  const [comparingId, setComparingId] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await API.get("/social/streaks/leaderboard");
      setRows(res.data);
    } catch (err) {
      console.log("Failed to load streak leaderboard:", err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchLeaderboard(); }, [fetchLeaderboard]));

  const toggleExpand = async (row) => {
    if (row.isMe) return;
    const friendId = row.user._id;
    if (expandedId === friendId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(friendId);
    if (!compareData[friendId]) {
      setComparingId(friendId);
      try {
        const res = await API.get(`/social/streaks/compare/${friendId}`);
        setCompareData((prev) => ({ ...prev, [friendId]: res.data }));
      } catch (err) {
        console.log("Failed to compare streaks:", err.response?.data?.message || err.message);
      } finally {
        setComparingId(null);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Streak Battles" subtitle="Ranked by workout streak" />

        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : rows.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="podium-outline" size={32} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Add friends to start comparing streaks</Text>
          </View>
        ) : (
          rows.map((row, i) => {
            const friendId = row.user._id;
            const isExpanded = expandedId === friendId;
            const compare = compareData[friendId];

            return (
              <FadeSlideIn key={friendId} delay={i * 40}>
                <Pressable onPress={() => toggleExpand(row)} style={[styles.row, row.isMe && styles.rowMe]}>
                  <Text style={styles.rank}>#{i + 1}</Text>
                  <Avatar name={row.user.name} size={38} highlight={row.isMe} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.rowName}>{row.isMe ? "You" : row.user.name}</Text>
                    <View style={styles.pillRow}>
                      <StreakPill type="workout" value={row.streaks.workout} />
                      <StreakPill type="steps" value={row.streaks.steps} />
                      <StreakPill type="caloriesBurned" value={row.streaks.caloriesBurned} />
                    </View>
                  </View>
                  {!row.isMe && <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textLight} />}
                </Pressable>

                {isExpanded && (
                  <View style={styles.compareCard}>
                    {comparingId === friendId ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : compare ? (
                      <>
                        <Text style={styles.compareTitle}>You vs {row.user.name}</Text>
                        {Object.entries(STREAK_ICONS).map(([key, meta]) => {
                          const mine = compare.me[key];
                          const theirs = compare.friend.streaks[key];
                          return (
                            <View key={key} style={styles.compareMetricRow}>
                              <Ionicons name={meta.icon} size={13} color={meta.color} />
                              <Text style={styles.compareMetricLabel}>{meta.label}</Text>
                              <Text style={[styles.compareValue, mine >= theirs && { color: meta.color }]}>{mine}d</Text>
                              <Text style={styles.compareVs}>vs</Text>
                              <Text style={[styles.compareValue, theirs > mine && { color: meta.color }]}>{theirs}d</Text>
                            </View>
                          );
                        })}
                      </>
                    ) : (
                      <Text style={styles.emptyText}>Couldn't load comparison</Text>
                    )}
                  </View>
                )}
              </FadeSlideIn>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const pillStyles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  text: { fontSize: 10.5, fontWeight: "800" },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 30 },

  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  rowMe: { borderColor: "#F97316", backgroundColor: "#F973160A" },
  rank: { width: 24, fontSize: 13, fontWeight: "800", color: COLORS.textMuted },
  rowName: { fontSize: 14.5, fontWeight: "700", color: COLORS.textDark, marginBottom: 5 },
  pillRow: { flexDirection: "row", gap: 6 },

  compareCard: {
    backgroundColor: COLORS.surfaceMuted, borderRadius: 14, padding: 14,
    marginTop: -4, marginBottom: 10,
  },
  compareTitle: { fontSize: 13, fontWeight: "800", color: COLORS.textDark, marginBottom: 10 },
  compareMetricRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  compareMetricLabel: { flex: 1, fontSize: 12.5, fontWeight: "600", color: COLORS.textMuted },
  compareValue: { fontSize: 14, fontWeight: "800", color: COLORS.textLight, width: 28, textAlign: "center" },
  compareVs: { fontSize: 10, fontWeight: "700", color: COLORS.textLight },
});
