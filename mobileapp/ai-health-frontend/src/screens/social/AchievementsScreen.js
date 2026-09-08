import { useState, useCallback, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, Share, Modal, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import LucideIcon from "../../components/ui/LucideIcon";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import API from "../../services/api";
import { COLORS } from "../../constants/theme";
import ScreenHeader from "../../components/ScreenHeader";
import FadeSlideIn from "../../components/FadeSlideIn";

const CATEGORY_GRADIENT = {
  streak: ["#7C2D12", "#9A3412", "#EA580C"],
  duel: ["#170F36", "#49225B", "#6E3482"],
};

// The card is rendered as a transparent outer frame with a rounded inner surface so
// PNG exports keep alpha in all four corners instead of becoming a black rectangle.
function AchievementCard({ achievement, cardRef }) {
  const gradient = CATEGORY_GRADIENT[achievement.category] ?? CATEGORY_GRADIENT.streak;
  return (
    <View ref={cardRef} collapsable={false} style={cardStyles.captureFrame}>
      <LinearGradient colors={gradient} style={cardStyles.card}>
        <View style={cardStyles.glowOrb} />
        <View style={cardStyles.iconWrap}>
          <LucideIcon name={achievement.icon} size={36} color="#fff" />
        </View>
        <Text style={cardStyles.kicker}>ACHIEVEMENT UNLOCKED</Text>
        <Text style={cardStyles.title}>{achievement.title}</Text>
        <Text style={cardStyles.description}>{achievement.description}</Text>
        <View style={cardStyles.brandRow}>
          <Text style={cardStyles.brand}>FITLIP</Text>
          <Text style={cardStyles.date}>
            {new Date(achievement.earnedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </Text>
        </View>
        <Text style={cardStyles.hashtag}>#MoveWithFitLip</Text>
      </LinearGradient>
    </View>
  );
}

export default function AchievementsScreen() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const achievementRef = useRef(null);
  const [sharing, setSharing] = useState(false);

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

  const captureAchievement = async () => {
    if (!achievementRef.current || !selected) return null;
    return captureRef(achievementRef, { width: 1080, height: 1080, format: "png", quality: 1, result: "tmpfile" });
  };

  const handleShare = async (achievement) => {
    if (!achievement || sharing) return;
    setSharing(true);
    try {
      const uri = await captureAchievement();
      const available = await Sharing.isAvailableAsync();
      if (available && uri) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Share your FitLip achievement`,
        });
      } else {
        await Share.share({ message: `🔥 ${achievement.title} on FitLip — ${achievement.description}` });
      }
    } catch (error) {
      Alert.alert("Couldn't share achievement", error?.message || "Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = async (achievement) => {
    if (!achievement || sharing) return;
    setSharing(true);
    try {
      const uri = await captureAchievement();
      if (!uri) return;
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow FitLip to save your achievement card to your photo library.");
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved to Photos", "Your FitLip achievement PNG is ready to post or use in a video.");
    } catch (error) {
      Alert.alert("Couldn't save achievement", error?.message || "Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Achievements" subtitle={`${achievements.length} earned`} />

        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : achievements.length === 0 ? (
          <View style={styles.emptyState}>
            <LucideIcon name="ribbon-outline" size={32} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No badges yet — keep your streaks going to earn your first one</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {achievements.map((a, i) => (
              <FadeSlideIn key={a._id} delay={i * 30} style={styles.gridItem}>
                <Pressable onPress={() => setSelected(a)} style={styles.badgeRow}>
                  <View style={[styles.badgeIconWrap, { backgroundColor: (a.category === "duel" ? COLORS.primary : "#F97316") + "18" }]}>
                    <LucideIcon name={a.icon} size={22} color={a.category === "duel" ? COLORS.primary : "#F97316"} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.badgeTitle}>{a.title}</Text>
                    <Text style={styles.badgeDesc} numberOfLines={1}>{a.description}</Text>
                  </View>
                  <LucideIcon name="chevron-forward" size={16} color={COLORS.textLight} />
                </Pressable>
              </FadeSlideIn>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selected && <AchievementCard achievement={selected} cardRef={achievementRef} />}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setSelected(null)} style={[styles.modalBtn, styles.modalCloseBtn]}>
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </Pressable>
              <Pressable onPress={() => selected && handleDownload(selected)} style={[styles.modalBtn, styles.modalDownloadBtn]} disabled={sharing}>
                <LucideIcon name="download-outline" size={16} color={COLORS.primary} />
                <Text style={styles.modalDownloadBtnText}>Save PNG</Text>
              </Pressable>
              <Pressable onPress={() => selected && handleShare(selected)} style={[styles.modalBtn, styles.modalShareBtn]} disabled={sharing}>
                <LucideIcon name="share-outline" size={16} color="#fff" />
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
  modalActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  modalBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 13 },
  modalCloseBtn: { backgroundColor: "rgba(255,255,255,0.15)" },
  modalCloseBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalDownloadBtn: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border },
  modalDownloadBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 13 },
  modalShareBtn: { backgroundColor: COLORS.primary },
  modalShareBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});

const cardStyles = StyleSheet.create({
  captureFrame: { borderRadius: 32, backgroundColor: "transparent", overflow: "hidden" },
  card: { minHeight: 340, borderRadius: 32, padding: 28, alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  glowOrb: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(255,255,255,0.08)", top: -80, right: -50 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  kicker: { color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: "900", letterSpacing: 1.8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "900", color: "#fff", textAlign: "center" },
  description: { fontSize: 13.5, color: "rgba(255,255,255,0.85)", textAlign: "center", marginTop: 8, lineHeight: 19 },
  brandRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)" },
  brand: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  date: { color: "rgba(255,255,255,0.7)", fontSize: 11.5, fontWeight: "600" },
  hashtag: { color: "rgba(255,255,255,0.82)", fontSize: 10, fontWeight: "800", marginTop: 12, letterSpacing: 0.5 },
});
