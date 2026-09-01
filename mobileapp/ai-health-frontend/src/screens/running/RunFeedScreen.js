import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import RunRouteMap from "../../components/RunRouteMap";

import { COLORS, SHADOW } from "../../constants/theme";
import Avatar from "../../components/Avatar";
import { getRunFeed, toggleRunLike } from "../../services/runService";
import { formatDuration, formatDistanceKm, formatPace, paceSecPerKm } from "../../utils/runMath";

const ACTIVITY_ICON = { run: "walk", walk: "footsteps-outline", cycle: "bicycle" };

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function RunCard({ run, onToggleLike }) {
  const region =
    run.route?.length > 1
      ? (() => {
          const lats = run.route.map((p) => p.lat);
          const lngs = run.route.map((p) => p.lng);
          const minLat = Math.min(...lats), maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
          return {
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(0.003, (maxLat - minLat) * 1.4),
            longitudeDelta: Math.max(0.003, (maxLng - minLng) * 1.4),
          };
        })()
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar name={run.user?.name} uri={run.user?.profileImageUrl || run.user?.picture} size={38} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.userName}>{run.user?.name || "Someone"}</Text>
          <Text style={styles.timeAgo}>{timeAgo(run.startedAt)}</Text>
        </View>
        <Ionicons name={ACTIVITY_ICON[run.activityType] || "walk"} size={20} color={COLORS.primary} />
      </View>

      {!!run.caption && <Text style={styles.caption}>{run.caption}</Text>}

      {run.photoUrl ? (
        <Image source={{ uri: run.photoUrl }} style={styles.photo} />
      ) : region ? (
        <View style={styles.routeThumb}>
          <RunRouteMap
            style={{ flex: 1 }}
            route={run.route}
            initialRegion={region}
            showStartMarker={false}
            showEndMarker={false}
          />
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <Stat value={`${formatDistanceKm(run.distanceMeters)} km`} label="distance" />
        <Stat value={formatDuration(run.durationSeconds)} label="time" />
        <Stat value={`${formatPace(paceSecPerKm(run.distanceMeters, run.durationSeconds))}`} label="pace /km" />
        <Stat value={`${run.caloriesBurned}`} label="kcal" />
      </View>

      <Pressable style={styles.likeRow} onPress={() => onToggleLike(run)}>
        <Ionicons
          name={run.likedByMe ? "heart" : "heart-outline"}
          size={20}
          color={run.likedByMe ? COLORS.error : COLORS.textLight}
        />
        <Text style={styles.likeCount}>{run.likesCount || 0}</Text>
      </Pressable>
    </View>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function RunFeedScreen() {
  const router = useRouter();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getRunFeed(1, 20);
      setRuns(data.runs || []);
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

  const handleToggleLike = async (run) => {
    // Optimistic — feed feel should be instant, like every other social app.
    setRuns((prev) =>
      prev.map((r) =>
        r._id === run._id
          ? { ...r, likedByMe: !r.likedByMe, likesCount: (r.likesCount || 0) + (r.likedByMe ? -1 : 1) }
          : r
      )
    );
    try {
      await toggleRunLike(run._id);
    } catch {
      load(); // reconcile on failure
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Activity</Text>
        <Pressable style={styles.startFab} onPress={() => router.push("/run-tracking")}>
          <Ionicons name="add" size={20} color={COLORS.onPrimary} />
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
          renderItem={({ item }) => <RunCard run={item} onToggleLike={handleToggleLike} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="walk-outline" size={40} color={COLORS.textLight} />
              <Text style={styles.emptyText}>
                No runs yet. Track one, or follow people to see theirs here.
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
    gap: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  startFabText: { color: COLORS.onPrimary, fontWeight: "700", fontSize: 13 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    ...SHADOW,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  userName: { fontWeight: "700", color: COLORS.textDark, fontSize: 14 },
  timeAgo: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  caption: { fontSize: 13, color: COLORS.textDark, marginBottom: 10 },
  photo: { width: "100%", height: 180, borderRadius: 12, marginBottom: 10 },
  routeThumb: { width: "100%", height: 140, borderRadius: 12, overflow: "hidden", marginBottom: 10 },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  statItem: { alignItems: "center", flex: 1 },
  statValue: { fontWeight: "700", color: COLORS.textDark, fontSize: 14 },
  statLabel: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  likeRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 6 },
  likeCount: { color: COLORS.textLight, fontSize: 13, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 60, gap: 10, paddingHorizontal: 40 },
  emptyText: { color: COLORS.textLight, textAlign: "center", fontSize: 13 },
});
