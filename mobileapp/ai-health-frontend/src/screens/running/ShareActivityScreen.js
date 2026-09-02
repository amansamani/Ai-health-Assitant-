import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import LucideIcon from "../../components/ui/LucideIcon";
import RunRouteMap from "../../components/RunRouteMap";
import { COLORS, SHADOW } from "../../constants/theme";
import { getRunById } from "../../services/runService";
import { formatDistanceKm, formatDuration, formatPace, paceSecPerKm } from "../../utils/runMath";

const heroImage = require("./assets/run-hero-user.png");

function initials(name) {
  return String(name || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";
}

function getRegion(route) {
  if (!route?.length) return null;
  const lats = route.map((p) => Number(p.lat)).filter(Number.isFinite);
  const lngs = route.map((p) => Number(p.lng)).filter(Number.isFinite);
  if (lats.length < 2 || lngs.length < 2) return null;
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.004, (maxLat - minLat) * 1.5),
    longitudeDelta: Math.max(0.004, (maxLng - minLng) * 1.5),
  };
}

function metric(label, value) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
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

  const region = getRegion(run?.route);
  const pace = run ? paceSecPerKm(run.distanceMeters, run.durationSeconds) : 0;
  const activityLabel = run?.activityType === "cycle" ? "Cycling" : run?.activityType === "walk" ? "Walk" : "Running";
  const person = run?.user?.name || "FitLip athlete";
  const dateLabel = run?.startedAt
    ? new Date(run.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

  const captureStory = async () => {
    if (!shareRef.current || !run) return null;
    return captureRef(shareRef, {
      format: "png",
      quality: 1,
      result: "tmpfile",
      width: 1080,
      height: 1920,
    });
  };

  const shareActivity = async () => {
    if (!run || sharing) return;
    setSharing(true);
    try {
      const uri = await captureStory();
      const available = await Sharing.isAvailableAsync();
      if (available && uri) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Share your ${activityLabel.toLowerCase()}`,
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
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
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
        <Text style={styles.pageSubtitle}>A 9:16 activity card ready for Instagram Stories, Snapchat, WhatsApp and any app that accepts images.</Text>

        <View ref={shareRef} collapsable={false} style={styles.storyCard}>
          <Image source={heroImage} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.storyTopRow}>
            <View style={styles.brandPill}>
              <View style={styles.brandDot} />
              <Text style={styles.brandText}>FITLIP</Text>
            </View>
            <Text style={styles.storyDate}>{dateLabel}</Text>
          </View>

          <View style={styles.storyMain}>
            <Text style={styles.storyActivity}>{activityLabel}</Text>
            <Text style={styles.storyDistance}>{formatDistanceKm(run.distanceMeters)}</Text>
            <Text style={styles.storyUnit}>KILOMETERS</Text>
            <Text style={styles.storyCaption}>{run.caption || "Keep moving. Keep building."}</Text>
          </View>

          {region ? (
            <View style={styles.mapWrap}>
              <RunRouteMap
                style={styles.map}
                route={run.route}
                initialRegion={region}
                showStartMarker
                showEndMarker
                strokeWidth={5}
              />
            </View>
          ) : (
            <View style={styles.mapFallback}>
              <LucideIcon name="map-outline" size={30} color={COLORS.primary} />
              <Text style={styles.mapFallbackText}>Route map unavailable</Text>
            </View>
          )}

          <View style={styles.metricsCard}>
            {metric("TIME", formatDuration(run.durationSeconds))}
            {metric("PACE", pace ? `${formatPace(pace)}/km` : "—")}
            {metric("CALORIES", `${run.caloriesBurned || 0}`)}
          </View>

          <View style={styles.storyFooter}>
            <View style={styles.athleteLine}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(person)}</Text></View>
              <View>
                <Text style={styles.athleteName}>{person}</Text>
                <Text style={styles.athleteSub}>Shared from FitLip</Text>
              </View>
            </View>
            <Text style={styles.hashtag}>#MoveWithFitLip</Text>
          </View>
        </View>

        <View style={styles.sharePanel}>
          <View style={styles.sharePanelTitleRow}>
            <View>
              <Text style={styles.shareTitle}>Share anywhere</Text>
              <Text style={styles.shareSubtitle}>Your phone will show compatible apps.</Text>
            </View>
            <LucideIcon name="share" size={21} color={COLORS.primary} />
          </View>

          <View style={styles.appRow}>
            <View style={styles.appChip}><LucideIcon name="camera" size={17} color="#fff" /><Text style={styles.appChipText}>Instagram</Text></View>
            <View style={styles.appChip}><LucideIcon name="ghost" size={17} color="#fff" /><Text style={styles.appChipText}>Snapchat</Text></View>
            <View style={styles.appChip}><LucideIcon name="message-circle" size={17} color="#fff" /><Text style={styles.appChipText}>WhatsApp</Text></View>
          </View>

          <Pressable style={styles.primaryBtn} onPress={shareActivity} disabled={sharing}>
            {sharing ? <ActivityIndicator color={COLORS.onPrimary} /> : <>
              <LucideIcon name="share" size={19} color={COLORS.onPrimary} />
              <Text style={styles.primaryBtnText}>Share Activity</Text>
            </>}
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <LucideIcon name="info" size={17} color={COLORS.primary} />
          <Text style={styles.infoText}>The activity is already saved to FitLip and follows its visibility setting. Sharing this card only creates an image for another app.</Text>
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
  pageSubtitle: { color: COLORS.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 6, marginBottom: 16 },
  storyCard: { width: "100%", aspectRatio: 9 / 16, overflow: "hidden", borderRadius: 28, backgroundColor: "#081117", padding: 20, ...SHADOW, shadowOpacity: 0.28 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(2,8,12,0.60)" },
  storyTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandPill: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: "rgba(7,18,22,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  brandText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  storyDate: { color: "rgba(255,255,255,0.70)", fontSize: 10.5, fontWeight: "700" },
  storyMain: { marginTop: "25%" },
  storyActivity: { color: COLORS.primary, fontSize: 13, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  storyDistance: { color: "#fff", fontSize: 68, lineHeight: 72, fontWeight: "900", marginTop: 2 },
  storyUnit: { color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: "800", letterSpacing: 1.5 },
  storyCaption: { color: "rgba(255,255,255,0.88)", fontSize: 12, lineHeight: 17, marginTop: 12, maxWidth: "87%", fontWeight: "600" },
  mapWrap: { height: "30%", minHeight: 130, marginTop: "9%", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" },
  map: { flex: 1 },
  mapFallback: { height: "30%", minHeight: 130, marginTop: "9%", borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.13)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(4,15,20,0.55)" },
  mapFallbackText: { color: "rgba(255,255,255,0.60)", fontSize: 11, marginTop: 7 },
  metricsCard: { flexDirection: "row", marginTop: 12, borderRadius: 18, paddingVertical: 12, backgroundColor: "rgba(8,18,22,0.82)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  metric: { flex: 1, alignItems: "center" },
  metricValue: { color: "#fff", fontSize: 14, fontWeight: "900" },
  metricLabel: { color: "rgba(255,255,255,0.55)", fontSize: 8.5, letterSpacing: 0.8, fontWeight: "800", marginTop: 2 },
  storyFooter: { marginTop: "auto", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 10 },
  athleteLine: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.17)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  avatarText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  athleteName: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  athleteSub: { color: "rgba(255,255,255,0.52)", fontSize: 8.5, marginTop: 1, fontWeight: "600" },
  hashtag: { color: COLORS.primary, fontSize: 8.5, fontWeight: "900" },
  sharePanel: { marginTop: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16 },
  sharePanelTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shareTitle: { color: COLORS.textDark, fontSize: 16, fontWeight: "900" },
  shareSubtitle: { color: COLORS.textMuted, fontSize: 11.5, marginTop: 3 },
  appRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  appChip: { flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 5 },
  appChipText: { color: COLORS.textDark, fontSize: 10.5, fontWeight: "800" },
  primaryBtn: { minHeight: 50, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 14, paddingHorizontal: 16 },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 13.5, fontWeight: "900" },
  infoCard: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", gap: 9 },
  infoText: { color: COLORS.textMuted, flex: 1, fontSize: 11.5, lineHeight: 17, fontWeight: "600" },
});
