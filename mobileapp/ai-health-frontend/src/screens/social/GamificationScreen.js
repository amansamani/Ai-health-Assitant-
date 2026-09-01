import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { COLORS } from "../../constants/theme";
import { useRouter } from "expo-router";

export default function GamificationScreen() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, board] = await Promise.all([
        API.get("/social/gamification/me"),
        API.get("/social/gamification/leaderboard"),
      ]);
      setData(me.data);
      setLeaderboard(Array.isArray(board.data) ? board.data : []);
    } catch (error) {
      console.warn("Gamification load failed", error?.response?.data || error?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading && !data) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const snapshot = data || { totalXp: 0, level: 1, levelTitle: "Rookie", rankTitle: "Bronze Dumbbell", levelProgress: 0, xpToNextLevel: 100 };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={22} color={COLORS.textDark} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Your Greatness</Text>
            <Text style={styles.subtitle}>Progress that reflects consistency, not perfection.</Text>
          </View>
        </View>

        <LinearGradient colors={[COLORS.primaryDark, COLORS.primary, COLORS.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.rankIcon}><Ionicons name={snapshot.rankIcon || "barbell-outline"} size={32} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rankEyebrow}>DUMBBELL RANK</Text>
              <Text style={styles.rankTitle}>{snapshot.rankTitle}</Text>
              <Text style={styles.levelText}>Level {snapshot.level} · {snapshot.levelTitle}</Text>
            </View>
            <View style={styles.xpBadge}><Text style={styles.xpValue}>{snapshot.totalXp}</Text><Text style={styles.xpLabel}>XP</Text></View>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round((snapshot.levelProgress || 0) * 100)}%` }]} /></View>
          <Text style={styles.progressText}>{snapshot.nextLevel ? `${snapshot.xpToNextLevel} XP to Level ${snapshot.nextLevel}` : "Maximum level reached"}</Text>
        </LinearGradient>

        <View style={styles.quickGrid}>
          <StatCard icon="trophy-outline" label="Achievements" value={snapshot.achievementCount ?? 0} />
          <StatCard icon="flash-outline" label="Current Level" value={snapshot.level} />
          <StatCard icon="barbell-outline" label="Rank" value={snapshot.rankTitle} compact />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>How XP works</Text><Ionicons name="sparkles-outline" size={20} color={COLORS.primary} /></View>
          <XpRow label="Confirm an exercise" xp="+10 XP" icon="barbell-outline" />
          <XpRow label="Complete a workout" xp="+50 XP" icon="fitness-outline" />
          <XpRow label="Log your meals" xp="+10 XP" icon="restaurant-outline" />
          <XpRow label="Hit 10,000 steps" xp="+20 XP" icon="footsteps-outline" />
          <XpRow label="Hit Active Burn goal" xp="+20 XP" icon="flame-outline" />
          <XpRow label="Win a duel" xp="+100 XP" icon="trophy-outline" last />
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Friends leaderboard</Text><Ionicons name="podium-outline" size={20} color={COLORS.primary} /></View>
          {leaderboard.map((row) => (
            <View key={String(row.user.id)} style={styles.leaderRow}>
              <Text style={[styles.position, row.isMe && styles.positionMe]}>#{row.position}</Text>
              <View style={styles.leaderAvatar}><Text style={styles.leaderInitial}>{String(row.user.name || "?").trim().charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.leaderName}>{row.isMe ? "You" : row.user.name}</Text><Text style={styles.leaderMeta}>Level {row.level} · {row.rankTitle}</Text></View>
              <Text style={styles.leaderXp}>{row.totalXp} XP</Text>
            </View>
          ))}
          {!leaderboard.length && <Text style={styles.empty}>Add friends to start your private leaderboard.</Text>}
        </View>

        <Pressable onPress={() => router.push("/(app)/social/achievements")} style={styles.achievementsButton}>
          <Ionicons name="medal-outline" size={20} color="#fff" /><Text style={styles.achievementsButtonText}>View achievements</Text><Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, compact }) {
  return <View style={styles.statCard}><Ionicons name={icon} size={20} color={COLORS.primary} /><Text style={styles.statValue} numberOfLines={1}>{String(value)}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function XpRow({ icon, label, xp, last }) {
  return <View style={[styles.xpRow, !last && styles.xpDivider]}><View style={styles.xpIcon}><Ionicons name={icon} size={18} color={COLORS.primary} /></View><Text style={styles.xpRowLabel}>{label}</Text><Text style={styles.xpRowValue}>{xp}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background || "#F7F0FA" },
  content: { padding: 20, paddingBottom: 36 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F0FA" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  backBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#EEE6F4", marginRight: 10 },
  title: { fontSize: 28, fontWeight: "800", color: COLORS.textDark },
  subtitle: { marginTop: 3, color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  hero: { borderRadius: 28, padding: 20, overflow: "hidden", marginBottom: 14 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  rankIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  rankEyebrow: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  rankTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 2 },
  levelText: { color: "rgba(255,255,255,0.82)", fontSize: 13, marginTop: 3 },
  xpBadge: { minWidth: 58, height: 58, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  xpValue: { color: "#fff", fontSize: 17, fontWeight: "800" },
  xpLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "800" },
  progressTrack: { height: 9, marginTop: 20, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 20 },
  progressText: { color: "rgba(255,255,255,0.76)", marginTop: 8, fontSize: 12, fontWeight: "700" },
  quickGrid: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: { flex: 1, borderRadius: 20, backgroundColor: "#fff", padding: 14, minHeight: 104, shadowColor: "#160B26", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  statValue: { marginTop: 8, fontSize: 20, fontWeight: "800", color: COLORS.textDark },
  statLabel: { marginTop: 4, color: COLORS.textMuted, fontSize: 11, fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: "#160B26", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sectionTitle: { color: COLORS.textDark, fontSize: 18, fontWeight: "800" },
  xpRow: { flexDirection: "row", alignItems: "center", minHeight: 58 },
  xpDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEE9F2" },
  xpIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: "#F2EAF7", alignItems: "center", justifyContent: "center", marginRight: 10 },
  xpRowLabel: { flex: 1, color: COLORS.textDark, fontSize: 14, fontWeight: "700" },
  xpRowValue: { color: COLORS.primary, fontSize: 14, fontWeight: "800" },
  leaderRow: { flexDirection: "row", alignItems: "center", minHeight: 66, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#EEE9F2" },
  position: { width: 32, color: COLORS.textMuted, fontWeight: "800", fontSize: 12 },
  positionMe: { color: COLORS.primary },
  leaderAvatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EEE5F5", alignItems: "center", justifyContent: "center", marginRight: 10 },
  leaderInitial: { color: COLORS.primary, fontWeight: "800" },
  leaderName: { color: COLORS.textDark, fontSize: 14, fontWeight: "800" },
  leaderMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 },
  leaderXp: { color: COLORS.primary, fontSize: 13, fontWeight: "800" },
  empty: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  achievementsButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 15 },
  achievementsButtonText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
