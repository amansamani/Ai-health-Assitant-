import { useCallback, useContext, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Image,
  Animated,
  ActivityIndicator,
  RefreshControl,
  Platform,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import LucideIcon from "../../components/ui/LucideIcon";
import RunRouteArt from "../../components/RunRouteArt";
import ConfirmModal from "../../components/ui/ConfirmModal";
import { COLORS, SHADOW } from "../../constants/theme";
import Avatar from "../../components/Avatar";
import { AuthContext } from "../../context/AuthContext";
import {
  getRunFeed,
  toggleRunLike,
  syncPendingRunLikes,
  deleteRun,
} from "../../services/runService";
import { formatDuration, formatDistanceKm, formatPace, paceSecPerKm } from "../../utils/runMath";
import { showToast } from "../../services/uiFeedback";

const ACTIVITY_META = {
  run: { label: "Running", icon: "footsteps-outline", verb: "ran" },
  walk: { label: "Walk", icon: "walk-outline", verb: "walked" },
  cycle: { label: "Cycling", icon: "bicycle-outline", verb: "cycled" },
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

function RunCard({ run, viewerId, onToggleLike, onShare, onDelete, onOpenPost, onOpenProfile }) {
  const meta = ACTIVITY_META[run.activityType] || ACTIVITY_META.run;
  const likeScale = useRef(new Animated.Value(1)).current;
  const ownerId = run.user?._id || run.user?.id;
  const isOwner = Boolean(run.isOwner) || Boolean(viewerId && ownerId && String(viewerId) === String(ownerId));

  const handleLike = () => {
    if (!run.likedByMe && Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.sequence([
      Animated.spring(likeScale, { toValue: 1.3, useNativeDriver: true, speed: 40, bounciness: 14 }),
      Animated.spring(likeScale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }),
    ]).start();
    onToggleLike(run);
  };

  const handleProfile = () => {
    const identifier = run.user?.username || ownerId;
    if (identifier) onOpenProfile(identifier);
  };

  return (
    <Pressable
      onPress={() => onOpenPost(run)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${meta.label.toLowerCase()} activity by ${run.user?.name || "someone"}`}
    >
      <View style={styles.cardHeader}>
        <Pressable
          onPress={handleProfile}
          hitSlop={8}
          style={styles.identityPressable}
          accessibilityRole="button"
          accessibilityLabel={`Open ${run.user?.name || "user"} profile`}
        >
          <Avatar name={run.user?.name} uri={run.user?.profileImageUrl || run.user?.picture} size={44} />
          <View style={styles.headerText}>
            <Text style={styles.userName} numberOfLines={1}>{run.user?.name || "Someone"}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.timeAgo}>{timeAgo(run.startedAt)}</Text>
              <View style={styles.dot} />
              <Text style={styles.tapHint}>View profile</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.headerRight}>
          <View style={styles.activityPill}>
            <LucideIcon name={meta.icon} size={13} color={COLORS.primary} />
            <Text style={styles.activityPillText}>{meta.label}</Text>
          </View>
          {isOwner && (
            <Pressable
              onPress={(event) => {
                event?.stopPropagation?.();
                onDelete(run);
              }}
              hitSlop={10}
              style={({ pressed }) => [styles.moreButton, pressed && styles.moreButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Delete my activity"
            >
              <LucideIcon name="ellipsis-horizontal" size={19} color={COLORS.textLight} />
            </Pressable>
          )}
        </View>
      </View>

      {!!run.caption && <Text style={styles.caption}>{run.caption}</Text>}

      <View style={styles.mediaWrap}>
        {run.photoUrl ? (
          <Image source={{ uri: run.photoUrl }} style={styles.photo} />
        ) : (
          <RunRouteArt route={run.route} style={styles.routeThumb} />
        )}
        <View style={styles.mediaBadge}>
          <LucideIcon name={meta.icon} size={13} color="#fff" />
          <Text style={styles.mediaBadgeText}>{meta.label}</Text>
        </View>
        <View style={styles.glassStats}>
          <Stat icon="footsteps-outline" value={`${formatDistanceKm(run.distanceMeters)} km`} label="DISTANCE" />
          <View style={styles.statDivider} />
          <Stat icon="time-outline" value={formatDuration(run.durationSeconds)} label="TIME" />
          <View style={styles.statDivider} />
          <Stat icon="flash-outline" value={formatPace(paceSecPerKm(run.distanceMeters, run.durationSeconds))} label="PACE /KM" />
          <View style={styles.statDivider} />
          <Stat icon="flame-outline" value={`${run.caloriesBurned || 0}`} label="KCAL" />
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={(event) => {
            event?.stopPropagation?.();
            handleLike();
          }}
          accessibilityRole="button"
          accessibilityLabel={run.likedByMe ? "Unlike activity" : "Like activity"}
        >
          <Animated.View style={{ transform: [{ scale: likeScale }] }}>
            <LucideIcon
              name={run.likedByMe ? "heart" : "heart-outline"}
              size={20}
              color={run.likedByMe ? COLORS.error : COLORS.textLight}
            />
          </Animated.View>
          <Text style={[styles.likeCount, run.likedByMe && { color: COLORS.error }]}>{run.likesCount || 0}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={(event) => {
            event?.stopPropagation?.();
            onShare(run);
          }}
          accessibilityRole="button"
          accessibilityLabel="Share activity"
        >
          <LucideIcon name="share-outline" size={19} color={COLORS.textLight} />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
        <View style={styles.openPostHint}>
          <Text style={styles.openPostHintText}>Open activity</Text>
          <LucideIcon name="chevron-forward" size={15} color={COLORS.textMuted} />
        </View>
      </View>
    </Pressable>
  );
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

export default function RunFeedScreen() {
  const router = useRouter();
  const { user: viewer } = useContext(AuthContext);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const likeInFlightRef = useRef(new Set());

  const load = useCallback(async () => {
    try {
      const data = await getRunFeed(1, 20);
      const syncedRuns = await syncPendingRunLikes(data.runs || []);
      setRuns(syncedRuns);
    } catch {
      // keep whatever's already on screen
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") load();
    });
    return () => subscription.remove();
  }, [load]);

  const handleOpenPost = (run) => {
    router.push({ pathname: "/(app)/share-activity", params: { runId: run._id } });
  };

  const handleOpenProfile = (identifier) => {
    router.push({ pathname: "/(app)/social/profile", params: { identifier } });
  };

  const handleShare = (run) => {
    router.push({ pathname: "/(app)/share-activity", params: { runId: run._id } });
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id || deleting) return;
    setDeleting(true);
    try {
      await deleteRun(deleteTarget._id);
      setRuns((prev) => prev.filter((run) => run._id !== deleteTarget._id));
      setDeleteTarget(null);
      showToast("Your activity has been deleted.", {
        title: "Activity deleted",
        type: "success",
      });
    } catch (error) {
      showToast(error?.response?.data?.message || "Couldn't delete this activity. Please try again.", {
        title: "Delete failed",
        type: "error",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleLike = async (run) => {
    if (!run?._id || likeInFlightRef.current.has(run._id)) return;
    likeInFlightRef.current.add(run._id);

    const previousLiked = !!run.likedByMe;
    const previousCount = Number(run.likesCount || 0);

    setRuns((prev) =>
      prev.map((r) =>
        r._id === run._id
          ? { ...r, likedByMe: !previousLiked, likesCount: Math.max(0, previousCount + (previousLiked ? -1 : 1)) }
          : r
      )
    );

    try {
      const result = await toggleRunLike(run._id, !previousLiked);
      const liked = Boolean(result?.liked);
      const likesCount = Number(result?.likesCount);
      setRuns((prev) =>
        prev.map((r) =>
          r._id === run._id
            ? { ...r, likedByMe: liked, likesCount: Number.isFinite(likesCount) ? likesCount : r.likesCount }
            : r
        )
      );
    } catch {
      load();
    } finally {
      likeInFlightRef.current.delete(run._id);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Activity</Text>
          <Text style={styles.headerSubtitle}>Your fitness circle, one activity at a time</Text>
        </View>
        <Pressable style={styles.startFab} onPress={() => router.push("/run-tracking")}>
          <LinearGradient colors={[COLORS.secondary, COLORS.primary]} style={StyleSheet.absoluteFillObject} />
          <LucideIcon name="add" size={18} color={COLORS.onPrimary} />
          <Text style={styles.startFabText}>Track</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <RunCard
              run={item}
              viewerId={viewer?._id || viewer?.id}
              onToggleLike={handleToggleLike}
              onShare={handleShare}
              onDelete={setDeleteTarget}
              onOpenPost={handleOpenPost}
              onOpenProfile={handleOpenProfile}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <LucideIcon name="walk-outline" size={32} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyText}>
                Track a run, walk, or ride — or follow people to see theirs here.
              </Text>
            </View>
          }
        />
      )}

      <ConfirmModal
        visible={Boolean(deleteTarget)}
        title="Delete activity?"
        message="This removes the activity from your profile and everyone's feed. This action can't be undone."
        confirmText={deleting ? "Deleting…" : "Delete activity"}
        cancelText="Keep it"
        icon="trash-2"
        tone="danger"
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 23, fontWeight: "900", color: COLORS.textDark, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 3 },
  startFab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    overflow: "hidden",
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  startFabText: { color: COLORS.onPrimary, fontWeight: "800", fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    ...SHADOW,
  },
  cardPressed: { opacity: 0.96, transform: [{ scale: 0.995 }] },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  identityPressable: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  headerText: { marginLeft: 14, flex: 1, minWidth: 0 },
  userName: { fontWeight: "900", color: COLORS.textDark, fontSize: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  timeAgo: { fontSize: 11, color: COLORS.textLight },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: COLORS.textMuted, marginHorizontal: 6 },
  tapHint: { fontSize: 10, color: COLORS.textMuted, fontWeight: "700" },
  headerRight: { alignItems: "flex-end", gap: 7, marginLeft: 8 },
  activityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.primaryLight + "33",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activityPillText: { fontSize: 10.5, fontWeight: "900", color: COLORS.primaryDark },
  moreButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  moreButtonPressed: { backgroundColor: COLORS.surfaceMuted },
  caption: { fontSize: 13.5, color: COLORS.textDark, marginBottom: 11, lineHeight: 19, fontWeight: "500" },
  mediaWrap: { position: "relative", marginBottom: 11, borderRadius: 20, overflow: "hidden", backgroundColor: COLORS.surfaceMuted },
  photo: { width: "100%", height: 230 },
  routeThumb: { width: "100%", height: 230 },
  mediaBadge: {
    position: "absolute", top: 10, left: 10, flexDirection: "row", alignItems: "center",
    gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999,
    backgroundColor: "rgba(15,8,22,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
  },
  mediaBadgeText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  glassStats: {
    position: "absolute", left: 9, right: 9, bottom: 9, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(15,8,22,0.68)", borderWidth: 1, borderColor: "rgba(255,255,255,0.17)",
    borderRadius: 16, paddingVertical: 9, paddingHorizontal: 5,
  },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.18)" },
  statValue: { fontWeight: "900", color: "#fff", fontSize: 13 },
  statLabel: { fontSize: 8.5, letterSpacing: 0.6, fontWeight: "900", color: "rgba(255,255,255,0.68)" },
  actionsRow: { flexDirection: "row", alignItems: "center", paddingTop: 1 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 9, borderRadius: 12 },
  actionBtnPressed: { backgroundColor: COLORS.surfaceMuted },
  likeCount: { color: COLORS.textLight, fontSize: 13, fontWeight: "800" },
  actionText: { color: COLORS.textLight, fontSize: 13, fontWeight: "800" },
  openPostHint: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 },
  openPostHintText: { color: COLORS.textMuted, fontSize: 10.5, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 60, gap: 8, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryLight + "2A",
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { color: COLORS.textDark, fontWeight: "900", fontSize: 16 },
  emptyText: { color: COLORS.textLight, textAlign: "center", fontSize: 13, lineHeight: 18 },
});
