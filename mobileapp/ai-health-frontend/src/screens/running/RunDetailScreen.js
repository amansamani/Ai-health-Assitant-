import { useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import LucideIcon from "../../components/ui/LucideIcon";
import RunRouteArt from "../../components/RunRouteArt";
import ConfirmModal from "../../components/ui/ConfirmModal";
import Avatar from "../../components/Avatar";
import { COLORS, SHADOW } from "../../constants/theme";
import { showToast } from "../../services/uiFeedback";
import { AuthContext } from "../../context/AuthContext";
import { deleteRun, getRunById, toggleRunLike } from "../../services/runService";
import { formatDistanceKm, formatDuration, formatPace, paceSecPerKm } from "../../utils/runMath";

const ACTIVITY_META = {
  run: { label: "Running", icon: "footsteps-outline" },
  walk: { label: "Walk", icon: "walk-outline" },
  cycle: { label: "Cycling", icon: "bicycle-outline" },
};

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Stat({ icon, value, label }) {
  return (
    <View style={styles.statItem}>
      <LucideIcon name={icon} size={13} color={COLORS.textLight} />
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function RunDetailScreen() {
  const router = useRouter();
  const { runId } = useLocalSearchParams();
  const { user: viewer } = useContext(AuthContext);
  const id = Array.isArray(runId) ? runId[0] : runId;

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
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
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const meta = ACTIVITY_META[run?.activityType] || ACTIVITY_META.run;
  const ownerId = run?.user?._id || run?.user?.id || null;
  const viewerId = viewer?._id || viewer?.id || null;
  const isOwner = Boolean(run?.isOwner) || Boolean(viewerId && ownerId && String(viewerId) === String(ownerId));

  const handleProfile = () => {
    const identifier = run?.user?.username || ownerId;
    if (identifier) router.push({ pathname: "/(app)/social/profile", params: { identifier } });
  };

  const handleLike = async () => {
    if (!run?._id) return;
    if (!run.likedByMe && Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.3, useNativeDriver: true, speed: 40, bounciness: 14 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }),
    ]).start();

    const previousLiked = !!run.likedByMe;
    const previousCount = Number(run.likesCount || 0);
    setRun((prev) => ({
      ...prev,
      likedByMe: !previousLiked,
      likesCount: Math.max(0, previousCount + (previousLiked ? -1 : 1)),
    }));

    try {
      const result = await toggleRunLike(run._id, !previousLiked);
      setRun((prev) => ({
        ...prev,
        likedByMe: Boolean(result?.liked),
        likesCount: Number.isFinite(Number(result?.likesCount)) ? Number(result.likesCount) : prev.likesCount,
      }));
    } catch {
      load();
    }
  };

  const handleShare = () => {
    router.push({ pathname: "/(app)/share-activity", params: { runId: id } });
  };

  const handleDelete = async () => {
    if (!run?._id || deleting) return;
    setDeleting(true);
    try {
      await deleteRun(run._id);
      showToast("Your activity has been deleted.", { title: "Activity deleted", type: "success" });
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

  const pace = paceSecPerKm(run.distanceMeters, run.durationSeconds);

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
        <Pressable onPress={handleProfile} style={styles.identityRow} accessibilityRole="button">
          <Avatar name={run.user?.name} uri={run.user?.profileImageUrl || run.user?.picture} size={46} />
          <View style={styles.headerText}>
            <Text style={styles.userName} numberOfLines={1}>{run.user?.name || "Someone"}</Text>
            <Text style={styles.timeAgo}>{timeAgo(run.startedAt)}</Text>
          </View>
          <View style={styles.activityPill}>
            <LucideIcon name={meta.icon} size={13} color={COLORS.primary} />
            <Text style={styles.activityPillText}>{meta.label}</Text>
          </View>
        </Pressable>

        {!!run.caption && <Text style={styles.caption}>{run.caption}</Text>}

        <View style={styles.mediaWrap}>
          {run.photoUrl ? (
            <Image source={{ uri: run.photoUrl }} style={styles.photo} resizeMode="cover" />
          ) : (
            <RunRouteArt route={run.route} style={styles.routeThumb} />
          )}
          <View style={styles.glassStats}>
            <Stat icon="footsteps-outline" value={`${formatDistanceKm(run.distanceMeters)} km`} label="DISTANCE" />
            <View style={styles.statDivider} />
            <Stat icon="time-outline" value={formatDuration(run.durationSeconds)} label="TIME" />
            <View style={styles.statDivider} />
            <Stat icon="flash-outline" value={formatPace(pace)} label="PACE /KM" />
            <View style={styles.statDivider} />
            <Stat icon="flame-outline" value={`${run.caloriesBurned || 0}`} label="KCAL" />
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
            onPress={handleLike}
            accessibilityRole="button"
            accessibilityLabel={run.likedByMe ? "Unlike activity" : "Like activity"}
          >
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <LucideIcon
                name={run.likedByMe ? "heart" : "heart-outline"}
                size={22}
                color={run.likedByMe ? COLORS.error : COLORS.textLight}
              />
            </Animated.View>
            <Text style={[styles.likeCount, run.likedByMe && { color: COLORS.error }]}>{run.likesCount || 0}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && styles.actionBtnPressed]}
            onPress={handleShare}
            accessibilityRole="button"
            accessibilityLabel="Share this activity"
          >
            <LucideIcon name="share-outline" size={19} color={COLORS.onPrimary} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={deleteConfirmVisible}
        title="Delete activity?"
        message="This removes the activity from your profile and everyone's feed. This action can't be undone."
        confirmText={deleting ? "Deleting…" : "Delete activity"}
        cancelText="Keep it"
        icon="trash-2"
        tone="danger"
        onCancel={() => {
          if (!deleting) setDeleteConfirmVisible(false);
        }}
        onConfirm={handleDelete}
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
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  identityRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  userName: { fontWeight: "900", color: COLORS.textDark, fontSize: 16 },
  timeAgo: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  activityPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: COLORS.primaryLight + "33", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  activityPillText: { fontSize: 10.5, fontWeight: "900", color: COLORS.primaryDark },

  caption: { fontSize: 15, color: COLORS.textDark, marginBottom: 14, lineHeight: 21, fontWeight: "500" },

  mediaWrap: { position: "relative", marginBottom: 16, borderRadius: 24, overflow: "hidden", backgroundColor: COLORS.surfaceMuted },
  photo: { width: "100%", height: 340 },
  routeThumb: { width: "100%", height: 340 },
  glassStats: {
    position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(15,8,22,0.68)", borderWidth: 1, borderColor: "rgba(255,255,255,0.17)",
    borderRadius: 18, paddingVertical: 11, paddingHorizontal: 6,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.18)" },
  statValue: { fontWeight: "900", color: "#fff", fontSize: 14 },
  statLabel: { fontSize: 8.5, letterSpacing: 0.6, fontWeight: "900", color: "rgba(255,255,255,0.68)" },

  actionsRow: { flexDirection: "row", alignItems: "center", gap: 12, ...SHADOW },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 46, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  actionBtnPressed: { backgroundColor: COLORS.surfaceMuted },
  likeCount: { color: COLORS.textLight, fontSize: 14, fontWeight: "800" },
  shareBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 46, borderRadius: 14, backgroundColor: COLORS.primary },
  shareBtnText: { color: COLORS.onPrimary, fontSize: 14, fontWeight: "900" },

  primaryBtn: { minHeight: 50, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  primaryBtnText: { color: COLORS.onPrimary, fontSize: 13.5, fontWeight: "900" },
});