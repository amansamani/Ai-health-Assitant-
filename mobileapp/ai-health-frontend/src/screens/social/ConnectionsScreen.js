import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import LucideIcon from "../../components/ui/LucideIcon";
import Avatar from "../../components/Avatar";
import API, { API_BASE_URL } from "../../services/api";
import { getToken } from "../../utils/secureToken";
import { COLORS, SHADOW } from "../../constants/theme";
import FadeSlideIn from "../../components/FadeSlideIn";

const PAGE_SIZE = 20;

export default function ConnectionsScreen() {
  const router = useRouter();
  const { identifier, type = "followers" } = useLocalSearchParams();
  const connectionType = type === "following" ? "following" : "followers";
  const [items, setItems] = useState([]);
  const [profileName, setProfileName] = useState("Profile");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [token, setToken] = useState(null);

  const buildAvatarUri = useCallback((user) => {
    if (!token || !user?.hasProfilePhoto || !user?._id) return user?.picture || null;
    return `${API_BASE_URL}/user/profile/photo/${user._id}?v=${encodeURIComponent(user.profileImageUpdatedAt || "1")}`;
  }, [token]);

  const loadPage = useCallback(async (targetPage = 1, replace = true) => {
    if (targetPage === 1) {
      if (replace) setLoading(true);
      setError("");
    } else {
      setLoadingMore(true);
    }

    try {
      const profileRes = targetPage === 1
        ? await API.get(`/social/profile/${encodeURIComponent(identifier)}`)
        : null;
      if (profileRes) setProfileName(profileRes.data?.name || "Profile");

      const profileId = profileRes?.data?._id;
      const idForRequest = profileId || identifier;
      const [listRes, currentToken] = await Promise.all([
        API.get(`/social/profile/${idForRequest}/${connectionType}`, {
          params: { page: targetPage, limit: PAGE_SIZE },
        }),
        targetPage === 1 ? getToken() : Promise.resolve(token),
      ]);

      if (targetPage === 1 && currentToken) setToken(currentToken);

      const payload = listRes.data || {};
      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      setItems((prev) => (replace ? nextItems : [...prev, ...nextItems]));
      setPage(Number(payload.page || targetPage));
      setHasMore(Boolean(payload.hasMore));
      setTotal(Number(payload.total || 0));
    } catch (err) {
      if (targetPage === 1) {
        setItems([]);
        setError(err.response?.data?.message || `Couldn't load ${connectionType}.`);
      }
    } finally {
      if (targetPage === 1) {
        setLoading(false);
        setRefreshing(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [identifier, connectionType, token]);

  useFocusEffect(useCallback(() => { loadPage(1, true); }, [loadPage]));

  const loadMore = () => {
    if (!loadingMore && !loading && hasMore) loadPage(page + 1, false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPage(1, true);
  };

  const title = connectionType === "followers" ? "Followers" : "Following";
  const countLabel = `${total || items.length}`;

  const renderItem = ({ item: user, index }) => (
    <FadeSlideIn delay={Math.min(index * 20, 180)}>
      <Pressable
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        onPress={() => router.push({ pathname: "/(app)/social/profile", params: { identifier: user.username || user._id } })}
      >
        <Avatar
          name={user.name}
          uri={buildAvatarUri(user)}
          size={48}
        />
        <View style={styles.copy}>
          <Text style={styles.name} numberOfLines={1}>{user.name || "User"}</Text>
          <Text style={styles.username}>@{user.username || "user"}</Text>
        </View>
        <View style={styles.openHint}>
          <LucideIcon name="chevron-forward" size={18} color={COLORS.textLight} />
        </View>
      </Pressable>
    </FadeSlideIn>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <LucideIcon name="chevron-back" size={22} color={COLORS.textDark} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{profileName}</Text>
        </View>
        <View style={styles.countPill}><Text style={styles.countText}>{countLabel}</Text></View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}><LucideIcon name="lock-closed" size={24} color={COLORS.primary} /></View>
          <Text style={styles.emptyTitle}>Can't view this list</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(user) => String(user._id)}
          renderItem={renderItem}
          contentContainerStyle={[styles.scroll, items.length === 0 && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.55}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <FadeSlideIn>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}><LucideIcon name="people-outline" size={26} color={COLORS.primary} /></View>
                <Text style={styles.emptyTitle}>No {connectionType} yet</Text>
                <Text style={styles.emptyText}>{connectionType === "followers" ? "When people follow this account, they'll appear here." : "Accounts this person follows will appear here."}</Text>
              </View>
            </FadeSlideIn>
          }
          ListFooterComponent={
            loadingMore ? <View style={styles.footer}><ActivityIndicator color={COLORS.primary} /></View> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { minHeight: 72, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  topBtn: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontSize: 19, fontWeight: "850", color: COLORS.textDark },
  subtitle: { marginTop: 2, fontSize: 11.5, color: COLORS.textMuted, fontWeight: "650" },
  countPill: { minWidth: 48, height: 32, paddingHorizontal: 10, borderRadius: 12, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 12.5, color: COLORS.primary, fontWeight: "850" },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 36 },
  emptyList: { flexGrow: 1 },
  row: { minHeight: 72, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, ...SHADOW, shadowOpacity: 0.035 },
  rowPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  copy: { flex: 1, marginLeft: 12, paddingRight: 10, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "800", color: COLORS.textDark },
  username: { marginTop: 3, fontSize: 11.5, color: COLORS.primary, fontWeight: "700" },
  openHint: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceMuted },
  footer: { paddingVertical: 18, alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  emptyCard: { marginTop: 8, padding: 30, borderRadius: 22, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "850", color: COLORS.textDark },
  emptyText: { marginTop: 7, maxWidth: 300, textAlign: "center", fontSize: 12.5, lineHeight: 18, color: COLORS.textMuted, fontWeight: "600" },
});
