import { useCallback, useRef, useState, useEffect } from "react";
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

import { COLORS, SHADOW } from "../../constants/theme";
import Avatar from "../../components/Avatar";
import { getRunFeed, toggleRunLike, syncPendingRunLikes } from "../../services/runService";
import { formatDuration, formatDistanceKm, formatPace, paceSecPerKm } from "../../utils/runMath";

const ACTIVITY_META = {
  run: { label: "Running", icon: "footsteps-outline" },
  walk: { label: "Walk", icon: "footsteps-outline" },
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

function RunCard({ run, onToggleLike, onShare }) {
  const meta = ACTIVITY_META[run.activityType] || ACTIVITY_META.run;
  const likeScale = useRef(new Animated.Value(1)).current;

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

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar name={run.user?.name} uri={run.user?.profileImageUrl || run.user?.picture} size={40} />
        <View style={styles.headerText}>
          <Text style={styles.userName} numberOfLines={1}>{run.user?.name || "Someone"}</Text>
          <Text style={styles.timeAgo}>{timeAgo(run.startedAt)}</Text>
        </View>
        <View style={styles.activityPill}>
          <LucideIcon name={meta.icon} size={12} color={COLORS.primary} />
          <Text style={styles.activityPillText}>{meta.label}</Text>
        </View>
      </View>

      {!!run.caption && <Text style={styles.caption}>{run.caption}</Text>}

      <View style={styles.mediaWrap}>
        {run.photoUrl ? (
          <Image source={{ uri: run.photoUrl }} style={styles.photo} />
        ) : (
          <RunRouteArt route={run.route} style={styles.routeThumb} />
        )}
        <View style={styles.glassStats}>
          <Stat icon="footsteps-outline" value={`${formatDistanceKm(run.distanceMeters)} km`} label="DISTANCE" />
          <View style={styles.statDivider} />
          <Stat icon="time-outline" value={formatDuration(run.durationSeconds)} label="TIME" />
          <View style={styles.statDivider} />
          <Stat icon="flash-outline" value={formatPace(paceSecPerKm(run.distanceMeters, run.durationSeconds))} label="PACE /KM" />
          <View style={styles.statDivider} />
          <Stat icon="flame-outline" value={`${run.caloriesBurned}`} label="KCAL" />
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
              size={20}
              color={run.likedByMe ? COLORS.error : COLORS.textLight}
            />
          </Animated.View>
          <Text style={[styles.likeCount, run.likedByMe && { color: COLORS.error }]}>{run.likesCount || 0}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
          onPress={() => onShare(run)}
          accessibilityRole="button"
          accessibilityLabel="Share activity"
        >
          <LucideIcon name="share-outline" size={19} color={COLORS.textLight} />
          <Text style={styles.actionText}>Share</Text>
        </Pressable>
      </View>
    </View>
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
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const handleShare = (run) => {
    router.push({ pathname: "/(app)/share-activity", params: { runId: run._id } });
  };

  const handleToggleLike = async (run) => {
    if (!run?._id || likeInFlightRef.current.has(run._id)) return;
    likeInFlightRef.current.add(run._id);

    const previousLiked = !!run.likedByMe;
    const previousCount = Number(run.likesCount || 0);

    // Optimistic UI, then reconcile from the server response so state survives
    // navigation/backgrounding and cannot drift from the DB.
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
        <Text style={styles.headerTitle}>Activity</Text>
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
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => <RunCard run={item} onToggleLike={handleToggleLike} onShare={handleShare} />}
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
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: COLORS.textDark },
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 14,
    marginBottom: 16,
    ...SHADOW,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  headerText: { marginLeft: 10, flex: 1 },
  userName: { fontWeight: "800", color: COLORS.textDark, fontSize: 14 },
  timeAgo: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  activityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primaryLight + "33",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  activityPillText: { fontSize: 10.5, fontWeight: "800", color: COLORS.primaryDark },
  caption: { fontSize: 13, color: COLORS.textDark, marginBottom: 10, lineHeight: 18 },
  mediaWrap: { position: "relative", marginBottom: 12, borderRadius: 20, overflow: "hidden" },
  photo: { width: "100%", height: 220 },
  routeThumb: { width: "100%", height: 220 },
  glassStats: { position: "absolute", left: 10, right: 10, bottom: 10, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(15,8,22,0.60)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", borderRadius: 16, paddingVertical: 9, paddingHorizontal: 5 },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 16,
    paddingVertical: 10,
    marginBottom: 6,
  },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, height: "60%", backgroundColor: COLORS.border },
  statValue: { fontWeight: "800", color: "#fff", fontSize: 13 },
  statLabel: { fontSize: 8.5, letterSpacing: 0.6, fontWeight: "800", color: "rgba(255,255,255,0.68)" },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 6 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 8, borderRadius: 12 },
  actionBtnPressed: { backgroundColor: COLORS.surfaceMuted },
  likeCount: { color: COLORS.textLight, fontSize: 13, fontWeight: "700" },
  actionText: { color: COLORS.textLight, fontSize: 13, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 60, gap: 8, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight + "2A",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { color: COLORS.textDark, fontWeight: "800", fontSize: 15 },
  emptyText: { color: COLORS.textLight, textAlign: "center", fontSize: 13, lineHeight: 18 },
});