import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import LucideIcon from "../../components/ui/LucideIcon";
import Avatar from "../../components/Avatar";
import API from "../../services/api";
import { COLORS } from "../../constants/theme";

export default function LeaderboardScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (nextPage = 1) => {
    nextPage === 1 ? setLoading(true) : setLoadingMore(true);
    try {
      const res = await API.get("/social/gamification/leaderboard", { params: { page: nextPage, limit: 20 } });
      setItems((prev) => nextPage === 1 ? (res.data?.items || []) : [...prev, ...(res.data?.items || [])]);
      setPage(nextPage);
      setHasMore(Boolean(res.data?.hasMore));
    } catch (_) {}
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(1); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}><LucideIcon name="chevron-back" size={22} color={COLORS.textDark} /></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.title}>Leaderboard</Text><Text style={styles.subtitle}>Your friends, ranked by XP</Text></View>
        <LucideIcon name="podium-outline" size={22} color={COLORS.primary} />
      </View>
      {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.user.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
          renderItem={({ item, index }) => (
            <View style={[styles.row, item.isMe && styles.rowMe]}>
              <Text style={[styles.position, item.position <= 3 && styles.positionTop]}>#{item.position}</Text>
              <Avatar name={item.user.name} uri={item.user.picture || undefined} size={44} />
              <View style={{ flex: 1, marginLeft: 12 }}><Text style={styles.name}>{item.isMe ? "You" : item.user.name}</Text><Text style={styles.meta}>Level {item.level} · {item.rankTitle}</Text></View>
              <View style={styles.xp}><Text style={styles.xpValue}>{item.totalXp}</Text><Text style={styles.xpLabel}>XP</Text></View>
            </View>
          )}
          onEndReached={() => { if (hasMore && !loadingMore) load(page + 1); }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={<Text style={styles.empty}>Add friends to start your leaderboard.</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 18 }} /> : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.textDark, fontSize: 24, fontWeight: "900" },
  subtitle: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 9 },
  rowMe: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceMuted },
  position: { width: 42, color: COLORS.textMuted, fontSize: 13, fontWeight: "800" },
  positionTop: { color: COLORS.primary },
  name: { color: COLORS.textDark, fontSize: 14.5, fontWeight: "800" },
  meta: { color: COLORS.textMuted, fontSize: 11, marginTop: 3, fontWeight: "600" },
  xp: { minWidth: 54, alignItems: "flex-end" },
  xpValue: { color: COLORS.textDark, fontSize: 15, fontWeight: "900" },
  xpLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  empty: { textAlign: "center", color: COLORS.textMuted, padding: 30, fontWeight: "600" },
});
