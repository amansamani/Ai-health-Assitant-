import { useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Share, Modal } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { COLORS } from "../../constants/theme";
import ScreenHeader from "../../components/ScreenHeader";
import FadeSlideIn from "../../components/FadeSlideIn";

const CATEGORY_GRADIENT = {
  streak: ["#7C2D12", "#9A3412", "#EA580C"],
  duel: ["#170F36", "#49225B", "#6E3482"],
};

// The share card itself — reused both inline (in the modal preview) and
// conceptually for what gets described in the shared text. Actual image
// capture (sharing this exact view as a PNG) would need react-native-view-shot,
// a new native dependency — text-based sharing works today with zero rebuild.
function AchievementCard({ achievement }) {
  const gradient = CATEGORY_GRADIENT[achievement.category] ?? CATEGORY_GRADIENT.streak;
  return (
    <LinearGradient colors={gradient} style={cardStyles.card}>
      <View style={cardStyles.iconWrap}>
        <Ionicons name={achievement.icon} size={36} color="#fff" />
      </View>
      <Text style={cardStyles.title}>{achievement.title}</Text>
      <Text style={cardStyles.description}>{achievement.description}</Text>
      <View style={cardStyles.brandRow}>
        <Text style={cardStyles.brand}>FitLip</Text>
        <Text style={cardStyles.date}>
          {new Date(achievement.earnedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </Text>
      </View>
    </LinearGradient>
  );
}

export default function AchievementsScreen() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchAchievements = useCallback(async () => {
    try {
      const res = await API.get("/social/achievements");
      setAchievements(res.data);
    } catch (err) {
      console.log("Failed to load achievements:", err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAchievements(); }, [fetchAchievements]));

  const handleShare = (achievement) => {
    Share.share({
      message: `🔥 ${achievement.title} on FitLip — ${achievement.description}`,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Achievements" subtitle={`${achievements.length} earned`} />

        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : achievements.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="ribbon-outline" size={32} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No badges yet — keep your streaks going to earn your first one</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {achievements.map((a, i) => (
              <FadeSlideIn key={a._id} delay={i * 30} style={styles.gridItem}>
                <Pressable onPress={() => setSelected(a)} style={styles.badgeRow}>
                  <View style={[styles.badgeIconWrap, { backgroundColor: (a.category === "duel" ? COLORS.primary : "#F97316") + "18" }]}>
                    <Ionicons name={a.icon} size={22} color={a.category === "duel" ? COLORS.primary : "#F97316"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.badgeTitle}>{a.title}</Text>
                    <Text style={styles.badgeDesc} numberOfLines={1}>{a.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                </Pressable>
              </FadeSlideIn>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selected && <AchievementCard achievement={selected} />}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setSelected(null)} style={[styles.modalBtn, styles.modalCloseBtn]}>
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </Pressable>
              <Pressable onPress={() => selected && handleShare(selected)} style={[styles.modalBtn, styles.modalShareBtn]}>
                <Ionicons name="share-outline" size={16} color="#fff" />
                <Text style={styles.modalShareBtnText}>Share</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  emptyState: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 30 },

  grid: {},
  gridItem: { marginBottom: 10 },
  badgeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  badgeIconWrap: { width: 44, height: 44, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  badgeTitle: { fontSize: 14.5, fontWeight: "700", color: COLORS.textDark },
  badgeDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 30 },
  modalContent: { width: "100%", maxWidth: 340 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 13 },
  modalCloseBtn: { backgroundColor: "rgba(255,255,255,0.15)" },
  modalCloseBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalShareBtn: { backgroundColor: "#F97316" },
  modalShareBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});

const cardStyles = StyleSheet.create({
  card: { borderRadius: 20, padding: 26, alignItems: "center" },
  iconWrap: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#fff", textAlign: "center" },
  description: { fontSize: 13.5, color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: 8, lineHeight: 19 },
  brandRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" },
  brand: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  date: { color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: "600" },
});
