import { useCallback, useContext, useEffect, useRef, useState } from "react";
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
import Svg, { Circle, Path, Rect } from "react-native-svg";
import NativeShare from "react-native-share";
import LucideIcon from "../../components/ui/LucideIcon";
import RunRouteArt from "../../components/RunRouteArt";
import { COLORS } from "../../constants/theme";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { showToast } from "../../services/uiFeedback";
import { AuthContext } from "../../context/AuthContext";
import { deleteRun, getRunById } from "../../services/runService";
import { formatDistanceKm, formatDuration, formatPace, paceSecPerKm } from "../../utils/runMath";

// ─────────────────────────────────────────────────────────────
// ELITE PREMIUM PALETTE
// ─────────────────────────────────────────────────────────────
const ELITE = {
  bg: "#0B0910",
  border: "rgba(255,255,255,0.08)",
  text: "#FFFFFF",
  textDim: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.30)",
};

// Single source of truth for the card corner radius.
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


function InstagramLogo({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5" stroke="#FFFFFF" strokeWidth="2" />
      <Circle cx="12" cy="12" r="4.1" stroke="#FFFFFF" strokeWidth="2" />
      <Circle cx="17.4" cy="6.7" r="1.2" fill="#FFFFFF" />
    </Svg>
  );
}

function WhatsAppLogo({ size = 20 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.6" stroke="#FFFFFF" strokeWidth="2" />
      <Path d="M8.9 8.8c.2-.3.4-.3.7-.3h.5c.2 0 .4.1.5.4l.8 1.8c.1.2.1.4-.1.6l-.5.6c-.1.1-.1.3 0 .4.4.7 1 1.2 1.7 1.6.2.1.3.1.4-.1l.6-.7c.1-.2.3-.2.5-.1l1.8.8c.2.1.3.3.2.5-.1.7-.4 1.2-.9 1.5-.5.3-1.1.2-1.7 0-1.2-.4-2.3-1.1-3.2-2-.8-.8-1.5-1.8-1.9-2.9-.2-.7-.3-1.4.1-2.1l.5-.7Z" fill="#FFFFFF" />
      <Path d="M8 18.1 6.8 19l.4-1.7" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function ShareActivityScreen() {
  const router = useRouter();
  const { runId } = useLocalSearchParams();
  const { user: viewer } = useContext(AuthContext);
  const shareRef = useRef(null); // ← now points at the TRANSPARENT stage, not the card
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [format, setFormat] = useState("story"); // "story" (9:16) | "post" (4:3)
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
  const person = run?.user?.name || "FitLip athlete";
  const ownerId = run?.user?._id || run?.user?.id || run?.userId || run?.ownerId || null;
  const viewerId = viewer?._id || viewer?.id || null;
  const isOwner = Boolean(run?.isOwner) || Boolean(viewerId && ownerId && String(viewerId) === String(ownerId));
  const sharedByOther = !isOwner;
  const avatarUri = run?.user?.picture || run?.user?.profileImageUrl || null;
  const dateLabel = run?.startedAt
    ? new Date(run.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const distanceStr = run ? formatDistanceKm(run.distanceMeters) : "0.00";

  const removeActivity = async () => {
    if (!run?._id || deleting) return;
    setDeleting(true);
    try {
      await deleteRun(run._id);
      setDeleteConfirmVisible(false);
      showToast("Your activity has been deleted.", {
        title: "Activity deleted",
        type: "success",
      });
      router.replace("/(app)/run-feed");
    } catch (error) {
      showToast(error?.response?.data?.message || "Couldn't delete this activity. Please try again.", {
        title: "Delete failed",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const captureCard = async () => {
    if (!shareRef.current || !run) return null;
    const dims = isStory ? { width: 1080, height: 1920 } : { width: 1080, height: 810 };
    // PNG is mandatory: it is the only format that keeps the transparent
    // (rounded) corners in the exported file.
    return captureRef(shareRef, { format: "png", quality: 1, result: "tmpfile", ...dims });
  };

  const shareActivity = async () => {
    if (!run || sharing) return;
    setSharing(true);
    try {
      const uri = await captureCard();
      if (!uri) throw new Error("Could not create the share image.");

      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Share your ${activityLabel.toLowerCase()} ${isStory ? "story" : "post"}`,
        });
      } else {
        await Share.share({
          message: `${activityLabel} with FitLip — ${formatDistanceKm(run.distanceMeters)} km in ${formatDuration(run.durationSeconds)}.`,
        });
      }
    } catch (error) {
      // iOS/Android can throw when the user dismisses the native share sheet or
      // when image capture is unavailable. Do not leave the button spinning.
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

  const shareToApp = async (social) => {
    if (!run || sharing) return;
    setSharing(true);
    try {
      const uri = await captureCard();
      if (!uri) throw new Error("Could not create the share image.");

      await NativeShare.shareSingle({
        social,
        url: uri,
        type: "image/png",
        title: `Share your ${activityLabel.toLowerCase()}`,
        message: `${activityLabel} with FitLip — ${distanceStr} km in ${formatDuration(run.durationSeconds)}.`,
        forceDialog: social === NativeShare.Social.INSTAGRAM,
      });
    } catch (error) {
      if (error?.message && !/cancel|dismiss|back/i.test(error.message)) {
        showToast("We couldn't share to that app. Try Share Card instead.", {
          title: "Share failed",
          type: "error",
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
        <Text style={styles.headerTitle}>Activity</Text>
        {isOwner ? (
          <Pressable
            style={styles.headerBtn}
            onPress={() => setDeleteConfirmVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Delete activity"
          >
            <LucideIcon name="trash-2" size={19} color={COLORS.error} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>{sharedByOther ? "Share their achievement." : "Make it yours."}</Text>
        <Text style={styles.pageSubtitle}>
          {sharedByOther
            ? `Share ${person}'s activity with your friends.`
            : "Create a polished activity card and share it anywhere."}
        </Text>

        {!!ownerId && (
          <Pressable
            style={styles.ownerLink}
            onPress={() => router.push({ pathname: "/(app)/social/profile", params: { identifier: String(ownerId) } })}
            accessibilityRole="button"
            accessibilityLabel={`Open ${person}'s profile`}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.ownerLinkAvatar} />
            ) : (
              <View style={styles.ownerLinkAvatarFallback}>
                <Text style={styles.ownerLinkAvatarText}>{initials(person)}</Text>
              </View>
            )}
            <View style={styles.ownerLinkCopy}>
              <Text style={styles.ownerLinkLabel}>ACTIVITY BY</Text>
              <Text style={styles.ownerLinkName} numberOfLines={1}>{person}</Text>
            </View>
            <LucideIcon name="chevron-forward" size={18} color={COLORS.textMuted} />
          </Pressable>
        )}

        <View style={styles.formatSwitch}>
          <Pressable style={[styles.formatBtn, isStory && styles.formatBtnActive]} onPress={() => setFormat("story")}>
            <Text style={[styles.formatBtnText, isStory && styles.formatBtnTextActive]}>Story · 9:16</Text>
          </Pressable>
          <Pressable style={[styles.formatBtn, !isStory && styles.formatBtnActive]} onPress={() => setFormat("post")}>
            <Text style={[styles.formatBtnText, !isStory && styles.formatBtnTextActive]}>Post · 4:3</Text>
          </Pressable>
        </View>

        {/* Dark presentation well — NOT captured. Only makes the rounded
            corners + floating shadow visible inside the app. */}
        <View style={styles.previewWell}>
          <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
            {/* ── CAPTURE STAGE ─────────────────────────────────
                Transparent root. This is the view we capture, so the
                exported PNG keeps TRUE rounded (alpha) corners. */}
            <View
              ref={shareRef}
              collapsable={false}
              style={[styles.captureStage, isStory ? styles.captureStageStory : styles.captureStagePost]}
            >
              <View style={styles.shadowWrap}>
                {/* Baked soft shadow — real elevation shadows do NOT
                    survive native capture, so we paint 3 feathered rings. */}
                <View style={[styles.bakedShadow, { top: -20, left: -20, right: -20, bottom: -20, borderRadius: CARD_RADIUS + 20, backgroundColor: "rgba(4,3,8,0.10)" }]} />
                <View style={[styles.bakedShadow, { top: -12, left: -12, right: -12, bottom: -12, borderRadius: CARD_RADIUS + 12, backgroundColor: "rgba(4,3,8,0.20)" }]} />
                <View style={[styles.bakedShadow, { top: -6, left: -6, right: -6, bottom: -6, borderRadius: CARD_RADIUS + 6, backgroundColor: "rgba(4,3,8,0.38)" }]} />

                {/* ── THE CARD (child of the stage) ─────────────
                    Rounding lives HERE, on a child, which the capture
                    pipeline clips correctly on both platforms. */}
                <View style={styles.eliteCard}>
                  {/* Gradient gets its OWN borderRadius as a safety net:
                      even if parent clipping ever fails during capture,
                      the gradient can never paint square corners. */}
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

                  {/* 2. HERO DISTANCE */}
                  <View style={[styles.eliteHeroBlock, !isStory && styles.eliteHeroBlockCentered]}>
                    <View style={[styles.eliteEyebrow, !isStory && styles.eliteEyebrowCentered]}>
                      <View style={styles.eliteDot} />
                      <Text style={styles.eliteEyebrowText}>{activityLabel.toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.eliteDistance, { fontSize: isStory ? 100 : 78, lineHeight: isStory ? 90 : 70 }]}>
                      {distanceStr}
                    </Text>
                    <Text style={styles.eliteUnit}>KILOMETERS</Text>
                    {!!run.caption && (
                      <Text style={[styles.eliteCaption, !isStory && styles.eliteCaptionCentered]} numberOfLines={2}>
                        {run.caption}
                      </Text>
                    )}
                  </View>

                  {/* 3. ETCHED GLASS ROUTE CONTAINER */}
                  <View style={styles.eliteRouteContainer}>
                    <RunRouteArt route={run.route} tint="#FFFFFF" style={styles.eliteRouteArt} />
                  </View>

                  {/* 4. ELITE STATS GRID */}
                  <View style={styles.eliteStatsRow}>
                    <View style={styles.eliteStat}>
                      <Text style={styles.eliteStatLabel}>TIME</Text>
                      <Text style={styles.eliteStatValue}>{formatDuration(run.durationSeconds)}</Text>
                    </View>
                    <View style={styles.eliteDivider} />
                    <View style={styles.eliteStat}>
                      <Text style={styles.eliteStatLabel}>PACE</Text>
                      <Text style={styles.eliteStatValue}>{pace ? `${formatPace(pace)}` : "—"}</Text>
                    </View>
                    <View style={styles.eliteDivider} />
                    <View style={styles.eliteStat}>
                      <Text style={styles.eliteStatLabel}>CALORIES</Text>
                      <Text style={styles.eliteStatValue}>{run.caloriesBurned || 0}</Text>
                    </View>
                  </View>

                  {/* 5. FOOTER */}
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
                        <Text style={styles.eliteAthleteSub}>{sharedByOther ? "Original athlete" : "Verified Activity"}</Text>
                      </View>
                    </View>
                    <Text style={styles.eliteHashtag}>#MoveWithFitLip</Text>
                  </View>

                  {/* 6. HAIRLINE BORDER OVERLAY */}
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
              <Text style={styles.shareSubtitle}>Choose where you want to share your activity card.</Text>
            </View>
            <LucideIcon name="share-outline" size={21} color={COLORS.primary} />
          </View>

          <View style={styles.appRow}>
            <Pressable style={styles.appChip} onPress={() => shareToApp(NativeShare.Social.INSTAGRAM)} disabled={sharing} accessibilityRole="button" accessibilityLabel="Share to Instagram">
              <InstagramLogo size={19} />
              <Text style={styles.appChipText}>Instagram</Text>
            </Pressable>
            <Pressable style={styles.appChip} onPress={() => shareToApp(NativeShare.Social.WHATSAPP)} disabled={sharing} accessibilityRole="button" accessibilityLabel="Share to WhatsApp">
              <WhatsAppLogo size={19} />
              <Text style={styles.appChipText}>WhatsApp</Text>
            </Pressable>
            <Pressable style={styles.appChip} onPress={shareActivity} disabled={sharing} accessibilityRole="button" accessibilityLabel="Share using other apps">
              <LucideIcon name="options-outline" size={19} color="#fff" />
              <Text style={styles.appChipText}>More</Text>
            </Pressable>
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
            Your card is exported as a high-quality PNG. Instagram and WhatsApp buttons open their native sharing flow.
          </Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={deleteConfirmVisible}
        title="Delete activity?"
        message="This removes the activity from your profile and the activity feed. This action can't be undone."
        confirmText={deleting ? "Deleting…" : "Delete activity"}
        cancelText="Keep it"
        icon="trash-2"
        tone="danger"
        onCancel={() => {
          if (!deleting) setDeleteConfirmVisible(false);
        }}
        onConfirm={removeActivity}
      />
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
  pageSubtitle: { color: COLORS.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 6, marginBottom: 12 },
  ownerLink: { flexDirection: "row", alignItems: "center", minHeight: 58, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14, borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  ownerLinkAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: COLORS.border },
  ownerLinkAvatarFallback: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center" },
  ownerLinkAvatarText: { color: COLORS.textDark, fontSize: 12, fontWeight: "900" },
  ownerLinkCopy: { flex: 1, marginLeft: 10 },
  ownerLinkLabel: { color: COLORS.textMuted, fontSize: 8.5, fontWeight: "800", letterSpacing: 1.2 },
  ownerLinkName: { color: COLORS.textDark, fontSize: 14, fontWeight: "800", marginTop: 2 },

  formatSwitch: { flexDirection: "row", backgroundColor: COLORS.surfaceMuted, borderRadius: 14, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  formatBtn: { flex: 1, minHeight: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  formatBtnActive: { backgroundColor: COLORS.primary },
  formatBtnText: { fontSize: 12.5, fontWeight: "800", color: COLORS.textMuted },
  formatBtnTextActive: { color: COLORS.onPrimary },

  // In-app presentation only (never captured)
  previewWell: {
    backgroundColor: "#0E0C13",
    borderRadius: 40,
    padding: 6,
    overflow: "hidden",
  },

  // ── CAPTURE STAGE: transparent root, owns the aspect ratio ──
  captureStage: {
    width: "100%",
    backgroundColor: "transparent",
    padding: 24, // room for the baked shadow inside the export
  },
  captureStageStory: { aspectRatio: 9 / 16 },
  captureStagePost: { aspectRatio: 4 / 3 },

  shadowWrap: { flex: 1 },
  bakedShadow: { position: "absolute" },

  // ── THE ELITE CARD ──
  eliteCard: {
    flex: 1,
    borderRadius: CARD_RADIUS,
    borderCurve: "continuous", // iOS squircle-style continuous corners
    overflow: "hidden",
    backgroundColor: ELITE.bg, // solid paint UNDER the gradient = safe clipping
    padding: 30,
    justifyContent: "space-between",
  },
  eliteBorderOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: ELITE.border,
    pointerEvents: "none",
  },

  eliteTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  eliteBrand: { color: "rgba(255,255,255,0.40)", fontSize: 10, fontWeight: "800", letterSpacing: 4 },
  eliteDate: { color: "rgba(255,255,255,0.40)", fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },

  eliteHeroBlock: { marginBottom: 6 },
  eliteHeroBlockCentered: { alignItems: "center" },
  eliteEyebrow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  eliteEyebrowCentered: { alignSelf: "center" },
  eliteDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#FFFFFF" },
  eliteEyebrowText: { color: "rgba(255,255,255,0.80)", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  eliteDistance: { color: "#FFFFFF", fontWeight: "900", letterSpacing: -4, fontVariant: ["tabular-nums"] },
  eliteUnit: { color: "rgba(255,255,255,0.40)", fontSize: 11, fontWeight: "700", letterSpacing: 3, marginTop: 4 },
  eliteCaption: { color: "rgba(255,255,255,0.60)", fontSize: 13, lineHeight: 18, marginTop: 14, fontWeight: "500", maxWidth: "85%" },
  eliteCaptionCentered: { maxWidth: "90%", textAlign: "center", alignSelf: "center" },

  eliteRouteContainer: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    backgroundColor: "rgba(0,0,0,0.25)",
    overflow: "hidden",
    marginVertical: 22,
    minHeight: 110,
  },
  eliteRouteArt: { flex: 1, backgroundColor: "transparent" },

  eliteStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: ELITE.border,
    marginBottom: 20,
  },
  eliteStat: { flex: 1, alignItems: "center", gap: 6 },
  eliteStatLabel: { color: ELITE.textFaint, fontSize: 8.5, fontWeight: "700", letterSpacing: 1.5 },
  eliteStatValue: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"], letterSpacing: -0.5 },
  eliteDivider: { width: 1, height: 24, backgroundColor: ELITE.border },

  eliteFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16 },
  eliteAthleteLine: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  eliteAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  eliteAvatarFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  eliteAvatarText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  eliteAthleteName: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  eliteAthleteSub: { color: "rgba(255,255,255,0.40)", fontSize: 10, fontWeight: "600", marginTop: 2 },
  eliteHashtag: { color: ELITE.textFaint, fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  // Outer app UI
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