import { useState, useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import API, { API_BASE_URL } from "../../services/api";
import { getToken } from "../../utils/secureToken";
import { COLORS } from "../../constants/theme";
import ScreenHeader from "../../components/ScreenHeader";
import FadeSlideIn from "../../components/FadeSlideIn";
import Avatar from "../../components/Avatar";
import { LinearGradient } from "expo-linear-gradient";

function HubTile({ icon, color, title, subtitle, badge, onPress, delay }) {
  return (
    <FadeSlideIn delay={delay} style={{ width: "48%" }}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={[styles.tileIconWrap, { backgroundColor: color + "18" }]}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        {badge != null && badge > 0 && <View style={[styles.tileBadge, { backgroundColor: color }]}><Text style={styles.tileBadgeText}>{badge}</Text></View>}
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileSubtitle}>{subtitle}</Text>
      </Pressable>
    </FadeSlideIn>
  );
}

function ProfileResult({ user, token, onPress }) {
  const imageSource = user.hasProfilePhoto && token
    ? { uri: `${API_BASE_URL}/user/profile/photo/${user._id}?v=${encodeURIComponent(user.profileImageUpdatedAt || "1")}`, headers: { Authorization: `Bearer ${token}` } }
    : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.82 }]}>
      <Avatar name={user.name} size={44} uri={imageSource ? undefined : user.picture || undefined} imageSource={imageSource || undefined} />
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Text style={styles.resultName}>{user.name}</Text>
        <Text style={styles.resultHandle}>@{user.username}</Text>
        <Text style={styles.resultMeta}>{user.followerCount || 0} followers</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </Pressable>
  );
}

export default function CompeteHubScreen() {
  const router = useRouter();
  const [counts, setCounts] = useState({ friends: 0, activeDuels: 0, needsResponse: 0, achievements: 0 });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [token, setToken] = useState(null);

  const fetchCounts = useCallback(async () => {
    try {
      const [friendsRes, duelsRes, achievementsRes, profileRes, tokenRes] = await Promise.all([
        API.get("/social/friends"),
        API.get("/social/duels"),
        API.get("/social/achievements"),
        API.get("/user/profile"),
        getToken(),
      ]);
      const duels = duelsRes.data;
      setCounts({
        friends: friendsRes.data.length,
        activeDuels: duels.filter((d) => d.status === "active").length,
        needsResponse: duels.filter((d) => d.status === "pending").length,
        achievements: achievementsRes.data.length,
      });
      setToken(tokenRes);
    } catch (err) {
      console.log("Failed to load compete counts:", err.response?.data?.message || err.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchCounts(); }, [fetchCounts]));

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const { data } = await API.get("/social/discover", { params: { q: value } });
        setResults(data || []);
      } catch (err) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Pressable style={styles.greatnessCard} onPress={() => router.push("/(app)/social/gamification")}>
        <LinearGradient colors={[COLORS.primaryDark, COLORS.primary, COLORS.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.greatnessInner}>
          <View style={styles.greatnessIcon}><Ionicons name="barbell-outline" size={22} color="#fff" /></View>
          <View style={{ flex: 1 }}><Text style={styles.greatnessEyebrow}>YOUR GREATNESS</Text><Text style={styles.greatnessTitle}>Build your Dumbbell rank</Text><Text style={styles.greatnessSub}>Earn XP from real fitness actions and climb with friends.</Text></View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </LinearGradient>
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Compete" subtitle="Build your FitLip identity" />

        <FadeSlideIn delay={0}>
          <Pressable onPress={() => router.push("/(app)/profile")} style={({ pressed }) => [styles.identityCard, pressed && { opacity: 0.9 }]}>
            <View style={styles.identityIcon}><Ionicons name="person-circle-outline" size={27} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.identityTitle}>Your social profile</Text>
              <Text style={styles.identitySubtitle}>Username, profile photo, followers & visibility</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
          </Pressable>
        </FadeSlideIn>

        <Text style={styles.sectionLabel}>FIND PEOPLE</Text>
        <FadeSlideIn delay={50}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={19} color={COLORS.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Search username or name"
              placeholderTextColor={COLORS.textMuted}
              style={styles.searchInput}
            />
            {searching && <ActivityIndicator size="small" color={COLORS.primary} />}
          </View>
        </FadeSlideIn>

        {results.length > 0 && (
          <View style={styles.resultsCard}>
            {results.map((user) => <ProfileResult key={user._id} user={user} token={token} onPress={() => router.push({ pathname: "/(app)/social/profile", params: { identifier: user.username } })} />)}
          </View>
        )}
        {query.trim().length >= 2 && !searching && results.length === 0 && (
          <Text style={styles.noResults}>No public profiles found for “{query.trim()}”.</Text>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>YOUR FITNESS CIRCLE</Text>
        <View style={styles.grid}>
          <HubTile icon="people-outline" color={COLORS.primary} title="Friends" subtitle={`${counts.friends} connected`} onPress={() => router.push("/(app)/social/friends")} delay={80} />
          <HubTile icon="flash-outline" color="#F97316" title="Duels" subtitle={`${counts.activeDuels} active`} badge={counts.needsResponse} onPress={() => router.push("/(app)/social/duels")} delay={120} />
          <HubTile icon="podium-outline" color="#22C55E" title="Streak Battles" subtitle="See who's ahead" onPress={() => router.push("/(app)/social/streaks")} delay={160} />
          <HubTile icon="ribbon-outline" color="#8E24AA" title="Achievements" subtitle={`${counts.achievements} earned`} onPress={() => router.push("/(app)/social/achievements")} delay={200} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  identityCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 15, marginBottom: 18 },
  identityIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginRight: 12 },
  identityTitle: { fontSize: 15, fontWeight: "900", color: COLORS.textDark },
  identitySubtitle: { marginTop: 3, fontSize: 11.5, lineHeight: 16, fontWeight: "600", color: COLORS.textMuted },
  sectionLabel: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.8, color: COLORS.textMuted, marginBottom: 9 },
  searchWrap: { height: 50, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14 },
  searchInput: { flex: 1, marginLeft: 9, fontSize: 14, fontWeight: "600", color: COLORS.textDark },
  resultsCard: { marginTop: 9, backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12 },
  resultRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceMuted },
  resultRowLast: { borderBottomWidth: 0 },
  resultName: { fontSize: 14, fontWeight: "800", color: COLORS.textDark },
  resultHandle: { marginTop: 1, fontSize: 11.5, color: COLORS.primary, fontWeight: "700" },
  resultMeta: { marginTop: 2, fontSize: 10.5, color: COLORS.textMuted, fontWeight: "600" },
  noResults: { marginTop: 11, color: COLORS.textMuted, fontSize: 12.5, fontWeight: "600", textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  tile: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: COLORS.border, minHeight: 130 },
  tileIconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  tileBadge: { position: "absolute", top: 14, right: 14, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  tileBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  tileTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark, marginBottom: 3 },
  tileSubtitle: { fontSize: 11.5, color: COLORS.textMuted, fontWeight: "600" },
  greatnessCard: { marginBottom: 16, borderRadius: 22, overflow: "hidden" },
  greatnessInner: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  greatnessIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  greatnessEyebrow: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  greatnessTitle: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 2 },
  greatnessSub: { color: "rgba(255,255,255,0.78)", fontSize: 11, lineHeight: 16, marginTop: 3 },
});
