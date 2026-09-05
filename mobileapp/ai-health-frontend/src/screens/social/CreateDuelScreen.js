import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "../../services/uiFeedback";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import LucideIcon from "../../components/ui/LucideIcon";
import { SafeAreaView } from "react-native-safe-area-context";
import API, { API_BASE_URL } from "../../services/api";
import { COLORS } from "../../constants/theme";
import ScreenHeader from "../../components/ScreenHeader";
import FadeSlideIn from "../../components/FadeSlideIn";
import Avatar from "../../components/Avatar";
import { getToken } from "../../utils/secureToken";

const METRICS = [
  { key: "steps", label: "Steps", icon: "footsteps-outline", color: "#22C55E" },
  { key: "caloriesBurned", label: "Active Burn", icon: "flame-outline", color: "#F97316" },
  { key: "workouts", label: "Workouts", icon: "barbell-outline", color: COLORS.primary },
];
const DURATIONS = [3, 7, 14];
const PAGE_SIZE = 20;

function extractList(payload) {
  if (Array.isArray(payload)) return { items: payload, page: 1, hasMore: false, total: payload.length };
  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    page: Number(payload?.page || 1),
    hasMore: Boolean(payload?.hasMore),
    total: Number(payload?.total || 0),
  };
}

export default function CreateDuelScreen() {
  const router = useRouter();
  const { opponentId: preselectedId, opponentName: preselectedName } = useLocalSearchParams();

  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(!preselectedId);
  const [loadingMore, setLoadingMore] = useState(false);
  const [opponentId, setOpponentId] = useState(preselectedId || null);
  const [metric, setMetric] = useState("steps");
  const [durationDays, setDurationDays] = useState(7);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [token, setToken] = useState(null);
  const searchTimer = useRef(null);

  const buildAvatarSource = useCallback((friend) => {
    if (!friend?._id) return undefined;
    if (token && friend.hasProfilePhoto) {
      return {
        uri: `${API_BASE_URL}/user/profile/photo/${friend._id}?v=${encodeURIComponent(friend.profileImageUpdatedAt || "1")}`,
        headers: { Authorization: `Bearer ${token}` },
      };
    }
    return undefined;
  }, [token]);

  const loadFriends = useCallback(async (targetPage = 1, replace = true, query = search) => {
    if (targetPage === 1) {
      setLoadingFriends(true);
      setErrorMsg("");
    } else {
      setLoadingMore(true);
    }

    try {
      const [response, currentToken] = await Promise.all([
        API.get("/social/friends", {
          params: { page: targetPage, limit: PAGE_SIZE, search: query.trim() },
        }),
        targetPage === 1 ? getToken() : Promise.resolve(token),
      ]);

      if (targetPage === 1 && currentToken) setToken(currentToken);

      const payload = extractList(response.data);
      setFriends((prev) => (replace ? payload.items : [...prev, ...payload.items]));
      setPage(payload.page || targetPage);
      setHasMore(payload.hasMore);
      setTotal(payload.total);
    } catch (err) {
      if (targetPage === 1) {
        setFriends([]);
        setErrorMsg(err.response?.data?.message || "Couldn't load your friends.");
      }
    } finally {
      if (targetPage === 1) setLoadingFriends(false);
      else setLoadingMore(false);
    }
  }, [search, token]);

  useEffect(() => {
    if (!preselectedId) loadFriends(1, true, "");
    return () => searchTimer.current && clearTimeout(searchTimer.current);
  }, [preselectedId, loadFriends]);

  const handleSearchChange = (value) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadFriends(1, true, value), 280);
  };

  const loadMore = () => {
    if (!loadingMore && !loadingFriends && hasMore) loadFriends(page + 1, false, search);
  };

  const handleSend = async () => {
    if (!opponentId) {
      setErrorMsg("Pick a friend to challenge");
      return;
    }
    setErrorMsg("");
    setSending(true);
    try {
      await API.post("/social/duels", { opponentId, metric, durationDays });
      showToast("They'll see it in their Duels list.", { title: "Challenge sent", type: "success", duration: 1800 });
      setTimeout(() => router.replace("/(app)/social/duels"), 450);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Failed to send challenge");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        onScrollEndDrag={loadMore}
      >
        <ScreenHeader title="New Duel" subtitle="Choose a friend and set the rules." />

        <FadeSlideIn delay={0}>
          <Text style={styles.sectionLabel}>CHALLENGE A FRIEND</Text>

          {preselectedId ? (
            <View style={styles.selectedOpponent}>
              <Avatar name={preselectedName} size={44} />
              <View style={styles.selectedCopy}>
                <Text style={styles.selectedEyebrow}>SELECTED OPPONENT</Text>
                <Text style={styles.selectedOpponentName} numberOfLines={1}>{preselectedName || "Friend"}</Text>
              </View>
              <View style={styles.selectedCheck}>
                <LucideIcon name="checkmark" size={16} color="#fff" />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.searchBox}>
                <LucideIcon name="search" size={18} color={COLORS.textLight} />
                <TextInput
                  value={search}
                  onChangeText={handleSearchChange}
                  placeholder="Search friends by name or username"
                  placeholderTextColor={COLORS.textLight}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <Pressable onPress={() => handleSearchChange("")} hitSlop={10}>
                    <LucideIcon name="close-circle" size={18} color={COLORS.textLight} />
                  </Pressable>
                )}
              </View>

              {loadingFriends ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.loadingText}>Finding your friends…</Text>
                </View>
              ) : friends.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <LucideIcon name="people-outline" size={25} color={COLORS.primary} />
                  </View>
                  <Text style={styles.emptyTitle}>{search ? "No friends found" : "No friends yet"}</Text>
                  <Text style={styles.emptyText}>{search ? "Try another name or username." : "Add a friend first, then come back to start a duel."}</Text>
                </View>
              ) : (
                <View style={styles.friendList}>
                  {friends.map((friend, index) => {
                    const selected = opponentId === friend._id;
                    const imageSource = buildAvatarSource(friend);
                    return (
                      <FadeSlideIn key={friend._id} delay={Math.min(index * 18, 180)}>
                        <Pressable
                          onPress={() => setOpponentId(friend._id)}
                          style={({ pressed }) => [styles.friendPick, selected && styles.friendPickSelected, pressed && styles.friendPickPressed]}
                        >
                          <Avatar
                            name={friend.name}
                            size={42}
                            uri={imageSource ? undefined : friend.picture || undefined}
                            imageSource={imageSource}
                          />
                          <View style={styles.friendCopy}>
                            <Text style={styles.friendPickName} numberOfLines={1}>{friend.name || "User"}</Text>
                            {!!friend.username && <Text style={styles.friendUsername} numberOfLines={1}>@{friend.username}</Text>}
                          </View>
                          <View style={[styles.radio, selected && styles.radioSelected]}>
                            {selected && <LucideIcon name="checkmark" size={14} color="#fff" />}
                          </View>
                        </Pressable>
                      </FadeSlideIn>
                    );
                  })}
                  {loadingMore && (
                    <View style={styles.moreLoading}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={styles.moreLoadingText}>Loading more friends…</Text>
                    </View>
                  )}
                  {!loadingMore && !hasMore && total > PAGE_SIZE && (
                    <Text style={styles.endOfList}>{total} friends</Text>
                  )}
                </View>
              )}
            </>
          )}
        </FadeSlideIn>

        <FadeSlideIn delay={70}>
          <Text style={styles.sectionLabel}>TRACK</Text>
          <View style={styles.optionGrid}>
            {METRICS.map((m) => {
              const active = metric === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setMetric(m.key)}
                  style={[styles.metricCard, active && { borderColor: m.color, backgroundColor: `${m.color}12` }]}
                >
                  <View style={[styles.metricIcon, active && { backgroundColor: `${m.color}20` }]}>
                    <LucideIcon name={m.icon} size={18} color={active ? m.color : COLORS.textMuted} />
                  </View>
                  <Text style={[styles.metricChipText, active && { color: m.color }]}>{m.label}</Text>
                  {active && <View style={[styles.activeDot, { backgroundColor: m.color }]} />}
                </Pressable>
              );
            })}
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={120}>
          <Text style={styles.sectionLabel}>DURATION</Text>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => {
              const active = durationDays === d;
              return (
                <Pressable key={d} onPress={() => setDurationDays(d)} style={[styles.durationChip, active && styles.durationChipSelected]}>
                  <Text style={[styles.durationChipText, active && styles.durationChipTextSelected]}>{d}</Text>
                  <Text style={[styles.durationDaysText, active && styles.durationChipTextSelected]}>days</Text>
                </Pressable>
              );
            })}
          </View>
        </FadeSlideIn>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <LucideIcon name="alert-circle" size={16} color={COLORS.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={handleSend}
          disabled={sending || !opponentId}
          style={({ pressed }) => [styles.sendBtn, (!opponentId || sending) && styles.sendBtnDisabled, pressed && !!opponentId && styles.sendBtnPressed]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <View style={styles.sendIcon}>
                <LucideIcon name="flash" size={17} color="#fff" />
              </View>
              <Text style={styles.sendBtnText}>Send Challenge</Text>
              <LucideIcon name="arrow-forward" size={18} color="#fff" />
            </>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 18, paddingBottom: 42 },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: "900",
    color: COLORS.textLight,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 18,
  },
  selectedOpponent: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  selectedCopy: { flex: 1, marginLeft: 12 },
  selectedEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1, color: COLORS.primary, marginBottom: 3 },
  selectedOpponentName: { fontSize: 16, fontWeight: "800", color: COLORS.textDark },
  selectedCheck: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  searchBox: {
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: { flex: 1, color: COLORS.textDark, fontSize: 13.5, fontWeight: "600", paddingVertical: 0 },
  friendList: { marginTop: 10 },
  friendPick: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 17,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  friendPickSelected: { borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}10` },
  friendPickPressed: { transform: [{ scale: 0.985 }] },
  friendCopy: { flex: 1, marginLeft: 12 },
  friendPickName: { fontSize: 14.5, fontWeight: "800", color: COLORS.textDark },
  friendUsername: { fontSize: 11.5, color: COLORS.textMuted, fontWeight: "600", marginTop: 2 },
  radio: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  radioSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  loadingState: { alignItems: "center", justifyContent: "center", paddingVertical: 28, gap: 8 },
  loadingText: { color: COLORS.textMuted, fontSize: 12.5, fontWeight: "600" },
  moreLoading: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, paddingVertical: 14 },
  moreLoadingText: { fontSize: 11.5, color: COLORS.textMuted, fontWeight: "700" },
  endOfList: { textAlign: "center", paddingVertical: 8, color: COLORS.textLight, fontSize: 10.5, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 20 },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: `${COLORS.primary}12`, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark, marginBottom: 4 },
  emptyText: { color: COLORS.textMuted, fontSize: 12.5, lineHeight: 18, textAlign: "center" },
  optionGrid: { flexDirection: "row", gap: 9 },
  metricCard: { flex: 1, minHeight: 92, borderRadius: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, padding: 12, justifyContent: "space-between", position: "relative" },
  metricIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center" },
  metricChipText: { fontSize: 12.5, fontWeight: "800", color: COLORS.textMuted, marginTop: 7 },
  activeDot: { position: "absolute", top: 12, right: 12, width: 7, height: 7, borderRadius: 4 },
  durationRow: { flexDirection: "row", gap: 10 },
  durationChip: { flex: 1, height: 54, borderRadius: 17, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  durationChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  durationChipText: { fontSize: 17, fontWeight: "900", color: COLORS.textDark, lineHeight: 20 },
  durationDaysText: { fontSize: 10.5, fontWeight: "700", color: COLORS.textMuted, marginTop: 1 },
  durationChipTextSelected: { color: "#fff" },
  errorBox: { marginTop: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: `${COLORS.error}10`, flexDirection: "row", alignItems: "center", gap: 8 },
  errorText: { flex: 1, color: COLORS.error, fontSize: 12.5, fontWeight: "700" },
  sendBtn: { marginTop: 22, minHeight: 56, borderRadius: 18, backgroundColor: COLORS.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 18, gap: 10, shadowColor: COLORS.primary, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 5 },
  sendBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  sendBtnPressed: { transform: [{ scale: 0.985 }] },
  sendIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  sendBtnText: { color: "#fff", fontSize: 15, fontWeight: "900", flex: 1 },
});
