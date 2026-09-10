import { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";
import LucideIcon from "../components/ui/LucideIcon";
import { COLORS } from "../constants/theme";
import { showToast } from "../services/uiFeedback";
import { AuthContext } from "../context/AuthContext";

// Same dark premium palette as the run share card — keeps every FitLip
// export visually consistent regardless of what it's sharing.
const ELITE = {
  bg: "#0B0910",
  border: "rgba(255,255,255,0.08)",
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.30)",
};

const CARD_RADIUS = 34;

function initials(name) {
  return (
    String(name || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}

function clampPct(value, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(1, value / goal));
}

export default function ShareDailyStatsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user: viewer } = useContext(AuthContext);
  const shareRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(14)).current;

  const steps = Number(params.steps) || 0;
  const calories = Number(params.calories) || 0;
  const sleep = Number(params.sleep) || 0;
  const stepGoal = Number(params.stepGoal) || 10000;
  const calorieGoal = Number(params.calorieGoal) || 400;
  const sleepGoal = Number(params.sleepGoal) || 8;

  const person = viewer?.name || "FitLip athlete";
  const avatarUri = viewer?.profileImageUrl || viewer?.picture || null;
  const dateLabel = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  useEffect(() => {
    fade.setValue(0);
    rise.setValue(14);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const captureCard = async () => {
    if (!shareRef.current) return null;
    // PNG is mandatory: it is the only format that keeps the transparent
    // (rounded) corners in the exported file.
    return captureRef(shareRef, { format: "png", quality: 1, result: "tmpfile", width: 1080, height: 1080 });
  };

  const shareCard = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureCard();
      if (!uri) throw new Error("Could not create the share image.");

      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: "Share your daily progress",
        });
      } else {
        await Share.share({
          message: `Today with FitLip — ${steps.toLocaleString()} steps, ${calories} kcal burned, ${sleep}h sleep.`,
        });
      }
    } catch (error) {
      if (error?.message && !/cancel|dismiss/i.test(error.message)) {
        showToast("We couldn't open the share sheet. Please try again.", {
          title: "Share failed",
          type: "error",
        });
      }
    } finally {
      setSharing(false);
    }
  };

  const stats = [
    {
      key: "steps",
      icon: "footsteps-outline",
      color: "#22C55E",
      label: "STEPS",
      value: steps.toLocaleString("en-IN"),
      pct: clampPct(steps, stepGoal),
    },
    {
      key: "burn",
      icon: "flame-outline",
      color: "#F97316",
      label: "ACTIVE BURN",
      value: `${calories} kcal`,
      pct: clampPct(calories, calorieGoal),
    },
    {
      key: "sleep",
      icon: "moon-outline",
      color: COLORS.primary,
      label: "SLEEP",
      value: `${sleep}h`,
      pct: clampPct(sleep, sleepGoal),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <LucideIcon name="chevron-back" size={22} color={COLORS.textDark} />
        </Pressable>
        <Text style={styles.headerTitle}>Share</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Flex today's progress.</Text>
        <Text style={styles.pageSubtitle}>
          A share-ready card for Instagram, Snapchat, WhatsApp — or anywhere else that takes an image.
        </Text>

        <View style={styles.previewWell}>
          <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
            <View ref={shareRef} collapsable={false} style={styles.captureStage}>
              <View style={styles.shadowWrap}>
                <View style={[styles.bakedShadow, { top: -20, left: -20, right: -20, bottom: -20, borderRadius: CARD_RADIUS + 20, backgroundColor: "rgba(4,3,8,0.10)" }]} />
                <View style={[styles.bakedShadow, { top: -12, left: -12, right: -12, bottom: -12, borderRadius: CARD_RADIUS + 12, backgroundColor: "rgba(4,3,8,0.20)" }]} />
                <View style={[styles.bakedShadow, { top: -6, left: -6, right: -6, bottom: -6, borderRadius: CARD_RADIUS + 6, backgroundColor: "rgba(4,3,8,0.38)" }]} />

                <View style={styles.eliteCard}>
                  <LinearGradient
                    colors={["#0B0910", "#14111D", "#0B0910"]}
                    locations={[0, 0.5, 1]}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: CARD_RADIUS }]}
                  />

                  {/* 1. TOP BAR */}
                  <View style={styles.eliteTopRow}>
                    <Text style={styles.eliteBrand}>FITLIP</Text>
                    <Text style={styles.eliteDate}>{dateLabel.toUpperCase()}</Text>
                  </View>

                  {/* 2. EYEBROW */}
                  <View style={styles.eyebrowCentered}>
                    <View style={styles.eliteDot} />
                    <Text style={styles.eliteEyebrowText}>DAILY PROGRESS</Text>
                  </View>

                  {/* 3. STAT ROWS */}
                  <View style={styles.statsStack}>
                    {stats.map((stat) => (
                      <View key={stat.key} style={styles.statRow}>
                        <View style={[styles.statIconWrap, { backgroundColor: `${stat.color}22`, borderColor: `${stat.color}44` }]}>
                          <LucideIcon name={stat.icon} size={20} color={stat.color} />
                        </View>
                        <View style={styles.statMid}>
                          <View style={styles.statLabelRow}>
                            <Text style={styles.statLabel}>{stat.label}</Text>
                            <Text style={styles.statValue}>{stat.value}</Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.round(stat.pct * 100)}%`, backgroundColor: stat.color }]} />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* 4. FOOTER */}
                  <View style={styles.eliteFooter}>
                    <View style={styles.eliteAthleteLine}>
                      {avatarUri ? (
                        <Image source={{ uri: avatarUri }} style={styles.eliteAvatar} />
                      ) : (
                        <View style={styles.eliteAvatarFallback}>
                          <Text style={styles.eliteAvatarText}>{initials(person)}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eliteAthleteName} numberOfLines={1}>{person}</Text>
                        <Text style={styles.eliteAthleteSub}>Verified Progress</Text>
                      </View>
                    </View>
                    <Text style={styles.eliteHashtag}>#MoveWithFitLip</Text>
                  </View>

                  {/* 5. HAIRLINE BORDER OVERLAY */}
                  <View style={[styles.eliteBorderOverlay, { borderRadius: CARD_RADIUS }]} />
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        <View style={styles.sharePanel}>
          <View style={styles.sharePanelTitleRow}>
            <View>
              <Text style={styles.shareTitle}>Share anywhere</Text>
              <Text style={styles.shareSubtitle}>Rounded corners & soft shadow are baked into the image.</Text>
            </View>
            <LucideIcon name="share-outline" size={21} color={COLORS.primary} />
          </View>

          <View style={styles.appRow}>
            <View style={styles.appChip}>
              <LucideIcon name="camera" size={17} color="#fff" />
              <Text style={styles.appChipText}>Instagram</Text>
            </View>
            <View style={styles.appChip}>
              <LucideIcon name="chatbubble-ellipses-outline" size={17} color="#fff" />
              <Text style={styles.appChipText}>WhatsApp</Text>
            </View>
            <View style={styles.appChip}>
              <LucideIcon name="options-outline" size={17} color="#fff" />
              <Text style={styles.appChipText}>More</Text>
            </View>
          </View>

          <Pressable style={styles.primaryBtn} onPress={shareCard} disabled={sharing}>
            {sharing ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <LucideIcon name="share-outline" size={19} color={COLORS.onPrimary} />
                <Text style={styles.primaryBtnText}>Share Card</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <LucideIcon name="information-circle-outline" size={17} color={COLORS.primary} />
          <Text style={styles.infoText}>
            The exported PNG keeps transparent rounded corners. Tip: use “Save Image” in the share sheet to download it exactly as previewed.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: COLORS.textDark, fontSize: 17, fontWeight: "800" },
  content: { paddingHorizontal: 16, paddingBottom: 36 },
  pageTitle: { color: COLORS.textDark, fontSize: 26, fontWeight: "900", marginTop: 8 },
  pageSubtitle: { color: COLORS.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 6, marginBottom: 16 },

  previewWell: { backgroundColor: "#0E0C13", borderRadius: 40, padding: 6, overflow: "hidden" },

  captureStage: { width: "100%", aspectRatio: 1, backgroundColor: "transparent", padding: 24 },
  shadowWrap: { flex: 1 },
  bakedShadow: { position: "absolute" },

  eliteCard: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: ELITE.bg,
    padding: 28,
    justifyContent: "space-between",
  },
  eliteBorderOverlay: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: ELITE.border, pointerEvents: "none" },

  eliteTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eliteBrand: { color: "rgba(255,255,255,0.40)", fontSize: 10, fontWeight: "800", letterSpacing: 4 },
  eliteDate: { color: "rgba(255,255,255,0.40)", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },

  eyebrowCentered: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 },
  eliteDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#FFFFFF" },
  eliteEyebrowText: { color: "rgba(255,255,255,0.80)", fontSize: 10, fontWeight: "800", letterSpacing: 2 },

  statsStack: { flex: 1, justifyContent: "center", gap: 22 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  statIconWrap: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  statMid: { flex: 1, gap: 8 },
  statLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  statLabel: { color: ELITE.textFaint, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.5 },
  statValue: { color: "#FFFFFF", fontSize: 19, fontWeight: "900", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },

  eliteFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16, paddingTop: 20, borderTopWidth: 1, borderColor: ELITE.border },
  eliteAthleteLine: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  eliteAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  eliteAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  eliteAvatarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  eliteAthleteName: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  eliteAthleteSub: { color: "rgba(255,255,255,0.40)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  eliteHashtag: { color: ELITE.textFaint, fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  sharePanel: { marginTop: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16 },
  sharePanelTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shareTitle: { color: COLORS.textDark, fontSize: 16, fontWeight: "900" },
  shareSubtitle: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 3 },
  appRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  appChip: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: COLORS.textDark, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  appChipText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  primaryBtn: { minHeight: 50, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 14, paddingHorizontal: 16 },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 13.5, fontWeight: "900" },
  infoCard: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", gap: 9 },
  infoText: { color: COLORS.textMuted, flex: 1, fontSize: 11.5, lineHeight: 17, fontWeight: "600" },
});