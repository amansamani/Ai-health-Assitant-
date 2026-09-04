import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import API, { API_BASE_URL } from "../../services/api";
import { getToken } from "../../utils/secureToken";
import { COLORS, SHADOW } from "../../constants/theme";
import LucideIcon from "../../components/ui/LucideIcon";
import Avatar from "../../components/Avatar";
import FadeSlideIn from "../../components/FadeSlideIn";
import { showToast } from "../../services/uiFeedback";

const PAGE_SIZE = 20;

export default function FollowRequestsScreen() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [token, setToken] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const buildAvatar = useCallback((user) => {
    if (token && user?.hasProfilePhoto && user?._id) {
      return {
        uri: `${API_BASE_URL}/user/profile/photo/${user._id}?v=${encodeURIComponent(user.profileImageUpdatedAt || "1")}`,
        headers: { Authorization: `Bearer ${token}` },
      };
    }
    return user?.picture || undefined;
  }, [token]);

  const load = useCallback(async (targetPage = 1, replace = true) => {
    if (targetPage === 1) {
      setLoading(true);
      setRefreshing(false);
    } else {
      setLoadingMore(true);
    }
    try {
      const [res, currentToken] = await Promise.all([
        API.get("/social/follow-requests", { params: { page: targetPage, limit: PAGE_SIZE } }),
        targetPage === 1 ? getToken() : Promise.resolve(token),
      ]);
      if (targetPage === 1 && currentToken) setToken(currentToken);
      const data = res.data || {};
      const next = Array.isArray(data.items) ? data.items : [];
      setItems((prev) => replace ? next : [...prev, ...next]);
      setPage(Number(data.page || targetPage));
      setHasMore(Boolean(data.hasMore));
      setTotal(Number(data.total || 0));
    } catch (err) {
      if (targetPage === 1) showToast(err.response?.data?.message || "Couldn't load follow requests.", { title: "Follow requests", type: "error" });
    } finally {
      if (targetPage === 1) setLoading(false);
      else setLoadingMore(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { load(1, true); }, [load]));

  const respond = async (requestId, action) => {
    if (!requestId || busyId) return;
    setBusyId(requestId);
    try {
      await API.post(`/social/follow-requests/${requestId}/respond`, { action });
      setItems((prev) => prev.filter((item) => String(item.requestId) !== String(requestId)));
      setTotal((prev) => Math.max(0, prev - 1));
      showToast(action === "accept" ? "You are now connected." : "Request declined.", { title: action === "accept" ? "Request accepted" : "Request declined", type: "success" });
    } catch (err) {
      showToast(err.response?.data?.message || "Couldn't update the request.", { title: "Follow request", type: "error" });
    } finally {
      setBusyId(null);
    }
  };

  const renderItem = ({ item, index }) => (
    <FadeSlideIn delay={Math.min(index * 20, 180)}>
      <View style={styles.card}>
        <Pressable style={styles.identity} onPress={() => router.push({ pathname: "/(app)/social/profile", params: { identifier: item.username || item._id } })}>
          <Avatar name={item.name} uri={buildAvatar(item)} size={52} />
          <View style={styles.copy}>
            <Text style={styles.name} numberOfLines={1}>{item.name || "FitLip user"}</Text>
            <Text style={styles.username}>@{item.username || "user"}</Text>
            <Text style={styles.time}>Requested recently</Text>
          </View>
        </Pressable>
        <View style={styles.actions}>
          <Pressable style={[styles.actionBtn, styles.reject]} disabled={busyId === item.requestId} onPress={() => respond(item.requestId, "reject")}>
            <LucideIcon name="close" size={17} color={COLORS.textDark} />
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.accept]} disabled={busyId === item.requestId} onPress={() => respond(item.requestId, "accept")}>
            {busyId === item.requestId ? <ActivityIndicator size="small" color="#fff" /> : <LucideIcon name="checkmark" size={18} color="#fff" />}
          </Pressable>
        </View>
      </View>
    </FadeSlideIn>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}><LucideIcon name="chevron-back" size={22} color={COLORS.textDark} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.title}>Follow Requests</Text><Text style={styles.subtitle}>{total} pending</Text></View>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View> : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.requestId)}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, !items.length && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          onEndReached={() => { if (!loadingMore && hasMore) load(page + 1, false); }}
          onEndReachedThreshold={0.5}
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(1, true); }}
          ListEmptyComponent={<View style={styles.empty}><View style={styles.emptyIcon}><LucideIcon name="person-add-outline" size={26} color={COLORS.primary} /></View><Text style={styles.emptyTitle}>No pending requests</Text><Text style={styles.emptyText}>When someone requests to follow you, you'll review it here.</Text></View>}
          ListFooterComponent={loadingMore ? <View style={styles.footer}><ActivityIndicator color={COLORS.primary} /></View> : null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { minHeight: 76, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 }, title: { fontSize: 20, fontWeight: "800", color: COLORS.textDark }, subtitle: { marginTop: 2, fontSize: 11.5, color: COLORS.textMuted, fontWeight: "600" },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 36 }, emptyList: { flexGrow: 1, justifyContent: "center" },
  card: { backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 13, marginBottom: 10, flexDirection: "row", alignItems: "center", ...SHADOW },
  identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" }, copy: { flex: 1, minWidth: 0, marginLeft: 12 }, name: { fontSize: 15, fontWeight: "800", color: COLORS.textDark }, username: { marginTop: 2, fontSize: 11.5, color: COLORS.primary, fontWeight: "700" }, time: { marginTop: 3, fontSize: 10.5, color: COLORS.textMuted, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 8, marginLeft: 8 }, actionBtn: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" }, reject: { backgroundColor: COLORS.surfaceMuted }, accept: { backgroundColor: COLORS.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" }, footer: { paddingVertical: 18, alignItems: "center" },
  empty: { margin: 18, padding: 30, borderRadius: 22, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" }, emptyIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginBottom: 12 }, emptyTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textDark }, emptyText: { marginTop: 7, maxWidth: 300, textAlign: "center", fontSize: 12.5, lineHeight: 18, color: COLORS.textMuted, fontWeight: "600" },
});
