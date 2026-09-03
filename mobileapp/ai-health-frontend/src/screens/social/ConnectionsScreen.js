import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import LucideIcon from "../../components/ui/LucideIcon";
import Avatar from "../../components/Avatar";
import API from "../../services/api";
import { COLORS, SHADOW } from "../../constants/theme";
import FadeSlideIn from "../../components/FadeSlideIn";

export default function ConnectionsScreen() {
  const router = useRouter();
  const { identifier, type = "followers" } = useLocalSearchParams();
  const connectionType = type === "following" ? "following" : "followers";
  const [items, setItems] = useState([]);
  const [profileName, setProfileName] = useState("Profile");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const profileRes = await API.get(`/social/profile/${encodeURIComponent(identifier)}`);
      setProfileName(profileRes.data?.name || "Profile");
      const listRes = await API.get(`/social/profile/${profileRes.data?._id}/${connectionType}`);
      setItems(Array.isArray(listRes.data) ? listRes.data : []);
    } catch (err) {
      setItems([]);
      setError(err.response?.data?.message || `Couldn't load ${connectionType}.`);
    } finally {
      setLoading(false);
    }
  }, [identifier, connectionType]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.topBar}>
        <Pressable style={styles.topBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <LucideIcon name="chevron-back" size={22} color={COLORS.textDark} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{connectionType === "followers" ? "Followers" : "Following"}</Text>
          <Text style={styles.subtitle}>{profileName}</Text>
        </View>
        <View style={styles.countPill}><Text style={styles.countText}>{items.length}</Text></View>
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {items.length === 0 ? (
            <FadeSlideIn>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}><LucideIcon name="people-outline" size={26} color={COLORS.primary} /></View>
                <Text style={styles.emptyTitle}>No {connectionType} yet</Text>
                <Text style={styles.emptyText}>{connectionType === "followers" ? "When people follow this account, they'll appear here." : "Accounts this person follows will appear here."}</Text>
              </View>
            </FadeSlideIn>
          ) : items.map((user, index) => (
            <FadeSlideIn key={user._id} delay={Math.min(index * 20, 180)}>
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => router.push({ pathname: "/(app)/social/profile", params: { identifier: user.username || user._id } })}
              >
                <Avatar name={user.name} uri={user.picture || user.profileImageUrl} size={48} />
                <View style={styles.copy}>
                  <Text style={styles.name} numberOfLines={1}>{user.name || "User"}</Text>
                  <Text style={styles.username}>@{user.username || "user"}</Text>
                </View>
                <LucideIcon name="chevron-forward" size={18} color={COLORS.textLight} />
              </Pressable>
            </FadeSlideIn>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { minHeight: 68, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  topBtn: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  titleWrap: { flex: 1 },
  title: { fontSize: 19, fontWeight: "850", color: COLORS.textDark },
  subtitle: { marginTop: 2, fontSize: 11.5, color: COLORS.textMuted, fontWeight: "650" },
  countPill: { minWidth: 42, height: 32, paddingHorizontal: 10, borderRadius: 12, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center" },
  countText: { fontSize: 12.5, color: COLORS.primary, fontWeight: "850" },
  scroll: { padding: 16, paddingTop: 8, paddingBottom: 36 },
  row: { minHeight: 72, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 17, borderWidth: 1, borderColor: COLORS.border, ...SHADOW, shadowOpacity: 0.035 },
  rowPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  copy: { flex: 1, marginLeft: 12, paddingRight: 10 },
  name: { fontSize: 15, fontWeight: "800", color: COLORS.textDark },
  username: { marginTop: 3, fontSize: 11.5, color: COLORS.primary, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  emptyCard: { marginTop: 8, padding: 30, borderRadius: 22, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "850", color: COLORS.textDark },
  emptyText: { marginTop: 7, maxWidth: 300, textAlign: "center", fontSize: 12.5, lineHeight: 18, color: COLORS.textMuted, fontWeight: "600" },
});
