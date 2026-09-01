import { useState, useCallback } from "react";
import { showToast } from "../../services/uiFeedback";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, ScrollView, Share, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../../services/api";
import { COLORS } from "../../constants/theme";
import ScreenHeader from "../../components/ScreenHeader";
import FadeSlideIn from "../../components/FadeSlideIn";
import Avatar from "../../components/Avatar";

export default function FriendsScreen() {
  const router = useRouter();
  const [code, setCode] = useState(null);
  const [codeLoading, setCodeLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addCodeInput, setAddCodeInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      const [codeRes, friendsRes] = await Promise.all([
        API.get("/social/friends/code"),
        API.get("/social/friends"),
      ]);
      setCode(codeRes.data.friendCode);
      setFriends(friendsRes.data);
    } catch (err) {
      console.log("Failed to load friends:", err.response?.data?.message || err.message);
    } finally {
      setCodeLoading(false);
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

  const handleShareCode = () => {
    if (!code) return;
    Share.share({
      message: `Add me on FitLip! My friend code is ${code} — enter it in the Friends tab to connect.`,
    });
  };

  const handleAddFriend = async () => {
    const trimmed = addCodeInput.trim().toUpperCase();
    if (!trimmed) return;
    setErrorMsg("");
    setAdding(true);
    try {
      await API.post("/social/friends", { code: trimmed });
      setAddCodeInput("");
      fetchAll();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Couldn't add that friend");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = (friend) => {
    Alert.alert(
      "Remove friend?",
      `${friend.name} will be removed from your friends list.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: async () => {
            try {
              await API.delete(`/social/friends/${friend._id}`);
              setFriends((prev) => prev.filter((f) => f._id !== friend._id));
            } catch (err) {
              showToast(err.response?.data?.message || "Failed to remove friend", { title: "Couldn't remove friend", type: "error" });
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <ScreenHeader title="Friends" subtitle={`${friends.length} connected`} />

        {/* My code */}
        <FadeSlideIn delay={0}>
          <View style={styles.codeCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.codeLabel}>YOUR FRIEND CODE</Text>
              {codeLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 6 }} />
              ) : (
                <Text style={styles.codeValue}>{code}</Text>
              )}
            </View>
            <Pressable onPress={handleShareCode} style={styles.shareBtn} accessibilityRole="button" accessibilityLabel="Share your friend code">
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
          </View>
        </FadeSlideIn>

        {/* Add a friend */}
        <FadeSlideIn delay={60}>
          <Text style={styles.sectionLabel}>ADD A FRIEND</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder="Enter their code"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="characters"
              value={addCodeInput}
              onChangeText={setAddCodeInput}
              maxLength={12}
            />
            <Pressable
              onPress={handleAddFriend}
              disabled={adding || !addCodeInput.trim()}
              style={[styles.addBtn, (adding || !addCodeInput.trim()) && { opacity: 0.5 }]}
            >
              {adding ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={20} color="#fff" />}
            </Pressable>
          </View>
          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
        </FadeSlideIn>

        {/* Friends list */}
        <Text style={styles.sectionLabel}>YOUR CIRCLE</Text>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
        ) : friends.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={32} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No friends yet — share your code to get started</Text>
          </View>
        ) : (
          friends.map((f, i) => (
            <FadeSlideIn key={f._id} delay={100 + i * 40}>
              <View style={styles.friendRow}>
                <Pressable
                  onPress={() => router.push({ pathname: "/(app)/social/profile", params: { identifier: f.username || f._id } })}
                  style={({ pressed }) => [styles.friendMain, pressed && { opacity: 0.82 }]}
                >
                  <Avatar name={f.name} size={42} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.friendName}>{f.name}</Text>
                    {!!f.username && <Text style={styles.friendHandle}>@{f.username}</Text>}
                    <Text style={styles.friendSince}>
                      Friends since {new Date(f.since).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={COLORS.textMuted} />
                </Pressable>
                <Pressable
                  onPress={() => router.push({ pathname: "/(app)/social/create-duel", params: { opponentId: f._id, opponentName: f.name } })}
                  style={styles.friendActionBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Challenge ${f.name} to a duel`}
                >
                  <Ionicons name="flash-outline" size={16} color="#F97316" />
                </Pressable>
                <Pressable
                  onPress={() => handleRemove(f)}
                  style={styles.friendActionBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${f.name}`}
                >
                  <Ionicons name="close" size={16} color={COLORS.textMuted} />
                </Pressable>
              </View>
            </FadeSlideIn>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  codeCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
  },
  codeLabel: { fontSize: 10.5, fontWeight: "800", color: COLORS.textLight, letterSpacing: 0.6, marginBottom: 4 },
  codeValue: { fontSize: 22, fontWeight: "800", color: COLORS.textDark, letterSpacing: 2 },
  shareBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textLight,
    letterSpacing: 0.6, marginBottom: 10, marginTop: 4,
  },
  addRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  addInput: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontWeight: "700", color: COLORS.textDark, letterSpacing: 1,
  },
  addBtn: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center",
  },
  errorText: { color: COLORS.error, fontSize: 12.5, fontWeight: "600", marginTop: 8 },

  emptyState: { alignItems: "center", paddingVertical: 30, gap: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: 30 },

  friendRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 12,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  friendMain: { flex: 1, flexDirection: "row", alignItems: "center" },
  friendName: { fontSize: 15, fontWeight: "700", color: COLORS.textDark },
  friendHandle: { fontSize: 11, color: COLORS.primary, marginTop: 1, fontWeight: "700" },
  friendSince: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 2 },
  friendActionBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surfaceMuted,
    alignItems: "center", justifyContent: "center", marginLeft: 6,
  },
});
