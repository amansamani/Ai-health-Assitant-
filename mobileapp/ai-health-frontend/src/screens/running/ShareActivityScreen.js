import { useCallback, useEffect, useRef, useState } from "react";
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
import LucideIcon from "../../components/ui/LucideIcon";
import RunRouteArt from "../../components/RunRouteArt";
import { COLORS, SHADOW } from "../../constants/theme";
import { getRunById } from "../../services/runService";
import { formatDistanceKm, formatDuration, formatPace, paceSecPerKm } from "../../utils/runMath";

const heroImage = require("./assets/run-hero-user.png");

// A dark, brand-tinted palette scoped to the shareable card only — the rest
// of the screen stays on the app's normal light theme (COLORS from theme.ts).
const CARD = {
  bg: "#0B0611",
  ink: "#F8F2FB",
  inkDim: "rgba(248,242,251,0.74)",
  inkFaint: "rgba(248,242,251,0.48)",
  glass: "rgba(28,15,38,0.55)",
  glassBorder: "rgba(255,255,255,0.14)",
  glow: "#C79BD6",
  glowSoft: "rgba(199,155,214,0.32)",
};

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

function StatChip({ icon, label, value }) {
  return (
    <View style={styles.statChip}>
      <LucideIcon name={icon} size={13} color={CARD.inkDim} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ShareActivityScreen() {
  const router = useRouter();
  const { runId } = useLocalSearchParams();
  const shareRef = useRef(null);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [format, setFormat] = useState("story"); // "story" (9:16) | "post" (1:1)
  const isStory = format === "story";

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(14)).current;

  const load = useCallback(async () => {
    const id = Array.isArray(runId) ? runId[0] : runId;
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const data = await getRunById(id);
      setRun(data);
    } catch {
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && run) {
      fade.setValue(0);
      rise.setValue(14);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(rise, { toValue: 0, duration: 480, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [loading, run, format]);

  const pace = run ? paceSecPerKm(run.distanceMeters, run.durationSeconds) : 0;
  const activityType = run?.activityType || "run";
  const activityLabel = activityType === "cycle" ? "Cycling" : activityType === "walk" ? "Walk" : "Running";
  const activityIcon = activityType === "cycle" ? "bicycle-outline" : "footsteps-outline";
  const person = run?.user?.name || "FitLip athlete";
  const avatarUri = run?.user?.picture || run?.user?.profileImageUrl || null;
  const heroSource = run?.photoUrl ? { uri: run.photoUrl } : heroImage;
  const dateLabel = run?.startedAt
    ? new Date(run.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const distanceStr = run ? formatDistanceKm(run.distanceMeters) : "0.00";
  const heroFontSize = distanceStr.length > 5 ? 58 : 78;

  const captureCard = async () => {
    if (!shareRef.current || !run) return null;
    const dims = isStory ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 };
    return captureRef(shareRef, { format: "png", quality: 1, result: "tmpfile", ...dims });
  };

  const shareActivity = async () => {
    if (!run || sharing) return;
    setSharing(true);
    try {
      const uri = await captureCard();
      const available = await Sharing.isAvailableAsync();
      if (available && uri) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Share your ${activityLabel.toLowerCase()} ${isStory ? "story" : "post"}`,
        });
      } else {
        await Share.share({
          message: `${activityLabel} with FitLip — ${formatDistanceKm(run.distanceMeters)} km in ${formatDuration(run.durationSeconds)}.`,
        });
      }
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!run) {
    return (
      <View style={styles.center}>
        <LucideIcon name="alert-circle" size={34} color={COLORS.textLight} />
        <Text style={styles.errorTitle}>Activity unavailable</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace("/(app)/run-feed")}>
          <Text style={styles.primaryBtnText}>Back to Activity</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={() => router.back()}>
          <LucideIcon name="chevron-back" size={22} color={COLORS.textDark} />
        </Pressable>
        <Text style={styles.headerTitle}>Share Activity</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Make it yours.</Text>
        <Text style={styles.pageSubtitle}>
          A share-ready card for Instagram, Snapchat, WhatsApp — or anywhere else that takes an image.
        </Text>

        <View style={styles.formatSwitch}>
          <Pressable style={[styles.formatBtn, isStory && styles.formatBtnActive]} onPress={() => setFormat("story")}>
            <Text style={[styles.formatBtnText, isStory && styles.formatBtnTextActive]}>Story · 9:16</Text>
          </Pressable>
          <Pressable style={[styles.formatBtn, !isStory && styles.formatBtnActive]} onPress={() => setFormat("post")}>
            <Text style={[styles.formatBtnText, !isStory && styles.formatBtnTextActive]}>Post · 1:1</Text>
          </Pressable>
        </View>

        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <View
            ref={shareRef}
            collapsable={false}
            style={[styles.card, isStory ? styles.cardStory : styles.cardPost]}
          >
            <Image source={heroSource} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            <LinearGradient
              colors={["rgba(11,6,17,0.90)", "rgba(20,10,28,0.26)", "rgba(14,8,20,0.40)", "rgba(7,3,11,0.95)"]}
              locations={[0, 0.32, 0.58, 1]}
              style={StyleSheet.absoluteFillObject}
            />

            <View style={styles.cardTopRow}>
              <View style={styles.brandMark}>
                <LinearGradient colors={[CARD.glow, COLORS.primary]} style={styles.brandGlyph}>
                  <LucideIcon name="footsteps-outline" size={12} color="#fff" />
                </LinearGradient>
                <Text style={styles.brandWordmark}>FITLIP</Text>
              </View>
              <Text style={styles.cardDate}>{dateLabel}</Text>
            </View>

            <View style={[styles.heroBlock, !isStory && styles.heroBlockCentered]}>
              <View style={[styles.eyebrowPill, !isStory && styles.eyebrowPillCentered]}>
                <LucideIcon name={activityIcon} size={11} color={CARD.ink} />
                <Text style={styles.eyebrowText}>{activityLabel}</Text>
              </View>
              <Text style={[styles.heroNumber, { fontSize: heroFontSize, lineHeight: heroFontSize + 6 }]}>
                {distanceStr}
              </Text>
              <Text style={styles.heroUnit}>KILOMETERS</Text>
              {!!run.caption && (
                <Text style={[styles.heroCaption, !isStory && styles.heroCaptionCentered]} numberOfLines={isStory ? 3 : 1}>
                  {run.caption}
                </Text>
              )}
            </View>

            <View style={styles.routeFlexWrap}>
              <RunRouteArt route={run.route} tint={CARD.glow} style={styles.routePanel} />
            </View>

            <View style={styles.statBar}>
              <StatChip icon="time-outline" label="TIME" value={formatDuration(run.durationSeconds)} />
              <View style={styles.statDivider} />
              <StatChip icon="flash-outline" label="PACE" value={pace ? `${formatPace(pace)}/km` : "—"} />
              <View style={styles.statDivider} />
              <StatChip icon="flame-outline" label="CALORIES" value={`${run.caloriesBurned || 0}`} />
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.athleteLine}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials(person)}</Text>
                  </View>
                )}
                <View>
                  <Text style={styles.athleteName} numberOfLines={1}>{person}</Text>
                  <Text style={styles.athleteSub}>Shared from FitLip</Text>
                </View>
              </View>
              <Text style={styles.hashtag}>#MoveWithFitLip</Text>
            </View>
          </View>
        </Animated.View>

        <View style={styles.sharePanel}>
          <View style={styles.sharePanelTitleRow}>
            <View>
              <Text style={styles.shareTitle}>Share anywhere</Text>
              <Text style={styles.shareSubtitle}>Your phone will show compatible apps.</Text>
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

          <Pressable style={styles.primaryBtn} onPress={shareActivity} disabled={sharing}>
            {sharing ? (
              <ActivityIndicator color={COLORS.onPrimary} />
            ) : (
              <>
                <LucideIcon name="share-outline" size={19} color={COLORS.onPrimary} />
                <Text style={styles.primaryBtnText}>Share {isStory ? "Story" : "Post"}</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <LucideIcon name="information-circle-outline" size={17} color={COLORS.primary} />
          <Text style={styles.infoText}>
            The activity is already saved to FitLip and follows its visibility setting. Sharing this card only creates an image for another app.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background, padding: 24, gap: 14 },
  errorTitle: { color: COLORS.textDark, fontSize: 18, fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: COLORS.textDark, fontSize: 17, fontWeight: "800" },
  content: { paddingHorizontal: 16, paddingBottom: 36 },
  pageTitle: { color: COLORS.textDark, fontSize: 26, fontWeight: "900", marginTop: 8 },
  pageSubtitle: { color: COLORS.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 6, marginBottom: 14 },

  formatSwitch: { flexDirection: "row", backgroundColor: COLORS.surfaceMuted, borderRadius: 14, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  formatBtn: { flex: 1, minHeight: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  formatBtnActive: { backgroundColor: COLORS.primary },
  formatBtnText: { fontSize: 12.5, fontWeight: "800", color: COLORS.textMuted },
  formatBtnTextActive: { color: COLORS.onPrimary },

  // The shareable card itself — everything inside here is what gets captured
  // and sent to Instagram/WhatsApp/etc.
  card: { width: "100%", overflow: "hidden", borderRadius: 30, backgroundColor: CARD.bg, padding: 20, ...SHADOW, shadowOpacity: 0.32, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
  cardStory: { aspectRatio: 9 / 16 },
  cardPost: { aspectRatio: 1 },

  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandMark: { flexDirection: "row", alignItems: "center", gap: 7 },
  brandGlyph: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  brandWordmark: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.6 },
  cardDate: { color: CARD.inkFaint, fontSize: 10.5, fontWeight: "700" },

  heroBlock: { marginTop: 16 },
  heroBlockCentered: { alignItems: "center", marginTop: 10 },
  eyebrowPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6 },
  eyebrowPillCentered: { alignSelf: "center" },
  eyebrowText: { color: CARD.ink, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" },
  heroNumber: { color: "#fff", fontWeight: "900", letterSpacing: -1.5, fontVariant: ["tabular-nums"] },
  heroUnit: { color: "rgba(255,255,255,0.78)", fontSize: 12.5, fontWeight: "800", letterSpacing: 2.4 },
  heroCaption: { color: "rgba(255,255,255,0.88)", fontSize: 12, lineHeight: 17, marginTop: 10, maxWidth: "88%", fontWeight: "600" },
  heroCaptionCentered: { maxWidth: "94%", textAlign: "center", alignSelf: "center" },

  // Flex:1 so the route panel absorbs whatever vertical space is left
  // between the hero text and the stat bar — this is what keeps the same
  // layout looking right on both the 9:16 story and the 1:1 post.
  routeFlexWrap: { flex: 1, marginTop: 14, marginBottom: 14, minHeight: 64 },
  routePanel: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: CARD.glassBorder },

  statBar: { flexDirection: "row", alignItems: "center", borderRadius: 18, paddingVertical: 12, backgroundColor: "rgba(10,5,15,0.75)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  statChip: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, height: "62%", backgroundColor: "rgba(255,255,255,0.12)" },
  statValue: { color: "#fff", fontSize: 14, fontWeight: "900", fontVariant: ["tabular-nums"] },
  statLabel: { color: "rgba(255,255,255,0.55)", fontSize: 8.5, letterSpacing: 0.8, fontWeight: "800" },

  cardFooter: { marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 10 },
  athleteLine: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.17)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  avatarImg: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  avatarText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  athleteName: { color: "#fff", fontSize: 10.5, fontWeight: "800", maxWidth: 140 },
  athleteSub: { color: "rgba(255,255,255,0.52)", fontSize: 8.5, marginTop: 1, fontWeight: "600" },
  hashtag: { color: CARD.glow, fontSize: 8.5, fontWeight: "900" },

  sharePanel: { marginTop: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16 },
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