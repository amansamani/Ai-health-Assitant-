import { useEffect, useMemo, useRef, useState, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import API, { API_BASE_URL } from "../services/api";
import { getToken } from "../utils/secureToken";
import { AuthContext } from "../context/AuthContext";
import { COLORS, SHADOW } from "../constants/theme";
import { setUserGoal } from "../context/AuthContext";
import FadeSlideIn from "../components/FadeSlideIn";

const GOALS = [
  { key: "bulk", label: "Bulk", desc: "Build muscle", icon: "barbell-outline", color: "#7C3AED" },
  { key: "lean", label: "Lean", desc: "Burn fat", icon: "flame-outline", color: "#F97316" },
  { key: "fit", label: "Fit", desc: "Stay balanced", icon: "fitness-outline", color: "#16A34A" },
];

function initials(name) {
  return String(name || "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";
}

function profileImageSource(profile, token) {
  if (!profile?.hasProfilePhoto || !profile?._id || !token) return null;
  return {
    uri: `${API_BASE_URL}/user/profile/photo/${profile._id}?v=${encodeURIComponent(profile.profileImageUpdatedAt || "1")}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

async function prepareProfilePhoto(uri) {
  return ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 720, height: 720 } }],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    }
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, userToken } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSocial, setSavingSocial] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savedSocial, setSavedSocial] = useState(false);
  const [savedGoal, setSavedGoal] = useState(false);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [selectedGoal, setSelectedGoal] = useState("fit");
  const [followRequests, setFollowRequests] = useState([]);
  const [token, setToken] = useState(userToken || null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, requestsRes] = await Promise.all([
        API.get("/user/profile"),
        API.get("/social/follow-requests"),
      ]);
      if (!mountedRef.current) return;
      const p = profileRes.data;
      let socialProfile = null;
      try {
        socialProfile = (await API.get(`/social/profile/${encodeURIComponent(p.username)}`)).data;
      } catch (_) {
        // Existing users can still open the profile if social counters are unavailable.
      }
      setProfile({ ...p, ...(socialProfile || {}) });
      setUsername(p.username || "");
      setBio(p.bio || "");
      setVisibility(p.profileVisibility || "private");
      setSelectedGoal(p.goal || "fit");
      setFollowRequests(requestsRes.data || []);
      const currentToken = await getToken();
      if (mountedRef.current) setToken(currentToken);
    } catch (err) {
      console.log("Profile fetch error:", err.response?.data?.message || err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const saveSocialProfile = async () => {
    try {
      setSavingSocial(true);
      const { data } = await API.put("/user/profile", {
        username,
        bio,
        profileVisibility: visibility,
      });
      setProfile((prev) => ({ ...prev, ...data.profile }));
      setSavedSocial(true);
      setTimeout(() => mountedRef.current && setSavedSocial(false), 2200);
    } catch (err) {
      Alert.alert("Couldn't save profile", err.response?.data?.message || "Please try again.");
    } finally {
      setSavingSocial(false);
    }
  };

  const saveGoal = async () => {
    try {
      setSavingGoal(true);
      await API.put("/user/goal", { goal: selectedGoal });
      setProfile((prev) => ({ ...prev, goal: selectedGoal }));
      setUserGoal(selectedGoal);
      setSavedGoal(true);
      setTimeout(() => mountedRef.current && setSavedGoal(false), 2200);
    } catch {
      Alert.alert("Error", "Failed to update goal. Please try again.");
    } finally {
      setSavingGoal(false);
    }
  };

  const choosePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Photo access needed", "Allow photo access in Settings to choose a profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingPhoto(true);
      const prepared = await prepareProfilePhoto(result.assets[0].uri);
      await API.put("/user/profile/photo", {
        imageBase64: prepared.base64,
        contentType: "image/jpeg",
      });

      const fresh = await API.get("/user/profile");
      const currentToken = await getToken();
      setProfile(fresh.data);
      setToken(currentToken);
    } catch (err) {
      Alert.alert("Couldn't update photo", err.response?.data?.message || "Please try another image.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const respondRequest = async (requestId, action) => {
    try {
      await API.post(`/social/follow-requests/${requestId}/respond`, { action });
      setFollowRequests((prev) => prev.filter((item) => item.requestId !== requestId));
    } catch (err) {
      Alert.alert("Couldn't update request", err.response?.data?.message || "Please try again.");
    }
  };

  const activeGoal = useMemo(
    () => GOALS.find((goal) => goal.key === selectedGoal) || GOALS[2],
    [selectedGoal]
  );

  const imageSource = profileImageSource(profile, token);
  const hasSocialChanges = username !== (profile?.username || "") || bio !== (profile?.bio || "") || visibility !== (profile?.profileVisibility || "private");
  const hasGoalChanges = selectedGoal !== (profile?.goal || "fit");

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FadeSlideIn delay={0}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Profile</Text>
              <Text style={styles.headerSubtitle}>Your identity inside FitLip</Text>
            </View>
            <Pressable style={styles.iconBtn} onPress={() => router.push("/(app)/social/index")}>
              <Ionicons name="people-outline" size={21} color={COLORS.primary} />
            </Pressable>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={70}>
          <LinearGradient colors={[COLORS.primaryDark, COLORS.primary, COLORS.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
            <Pressable onPress={choosePhoto} disabled={uploadingPhoto} style={styles.avatarButton}>
              {imageSource ? (
                <Image source={imageSource} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials(profile.name)}</Text>
                </View>
              )}
              <View style={styles.cameraBadge}>
                {uploadingPhoto ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={15} color="#fff" />}
              </View>
            </Pressable>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={styles.heroName}>{profile.name}</Text>
              <Text style={styles.heroHandle}>@{profile.username}</Text>
              <View style={styles.heroPill}>
                <Ionicons name={visibility === "public" ? "globe-outline" : "lock-closed-outline"} size={13} color="#fff" />
                <Text style={styles.heroPillText}>{visibility === "public" ? "Public profile" : "Private profile"}</Text>
              </View>
            </View>
          </LinearGradient>
        </FadeSlideIn>

        <FadeSlideIn delay={120}>
          <View style={styles.statsCard}>
            <Stat value={profile.followerCount ?? 0} label="Followers" />
            <View style={styles.statDivider} />
            <Stat value={profile.followingCount ?? 0} label="Following" />
            <View style={styles.statDivider} />
            <Stat value={followRequests.length} label="Requests" />
          </View>
        </FadeSlideIn>

        {followRequests.length > 0 && (
          <FadeSlideIn delay={150}>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <View>
                  <Text style={styles.cardTitle}>Follow requests</Text>
                  <Text style={styles.cardSubtitle}>People who want to see your activity</Text>
                </View>
                <View style={styles.requestBadge}><Text style={styles.requestBadgeText}>{followRequests.length}</Text></View>
              </View>
              {followRequests.slice(0, 3).map((request) => (
                <View key={request.requestId} style={styles.requestRow}>
                  <View style={styles.miniAvatar}><Text style={styles.miniAvatarText}>{initials(request.name).slice(0, 1)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.requestName}>{request.name}</Text>
                    <Text style={styles.requestHandle}>@{request.username}</Text>
                  </View>
                  <Pressable onPress={() => respondRequest(request.requestId, "accept")} style={styles.acceptBtn}>
                    <Ionicons name="checkmark" size={17} color="#fff" />
                  </Pressable>
                  <Pressable onPress={() => respondRequest(request.requestId, "reject")} style={styles.rejectBtn}>
                    <Ionicons name="close" size={17} color={COLORS.textMuted} />
                  </Pressable>
                </View>
              ))}
            </View>
          </FadeSlideIn>
        )}

        <FadeSlideIn delay={180}>
          <Pressable\n  onPress={() => router.push("/social/gamification")}\n  accessibilityRole="button"\n  accessibilityLabel="Open FitLip identity and XP progress"\n  android_ripple={{ color: "rgba(255,255,255,0.12)" }}\n  style={({ pressed }) => [styles.greatnessCard, pressed && styles.greatnessPressed]}\n>
            <LinearGradient colors={[COLORS.primaryDark, COLORS.primary, COLORS.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.greatnessInner}>
              <View style={styles.greatnessIcon}><Ionicons name="barbell-outline" size={21} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.greatnessEyebrow}>YOUR GREATNESS</Text>
                <Text style={styles.greatnessTitle}>Level up your FitLip identity</Text>
                <Text style={styles.greatnessSub}>Earn XP, unlock Dumbbell ranks and compete with friends.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </LinearGradient>
          </Pressable>
        </FadeSlideIn>

        <FadeSlideIn delay={200}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Social identity</Text>
            <Text style={styles.cardSubtitle}>Choose how people find and recognize you.</Text>

            <Text style={styles.fieldLabel}>USERNAME</Text>
            <View style={styles.inputWrap}>
              <Text style={styles.inputPrefix}>@</Text>
              <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} maxLength={30} style={styles.input} placeholder="your_username" placeholderTextColor={COLORS.textMuted} />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>BIO</Text>
            <TextInput value={bio} onChangeText={setBio} maxLength={160} multiline numberOfLines={3} style={styles.bioInput} placeholder="Train. Eat. Repeat." placeholderTextColor={COLORS.textMuted} />

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>PROFILE VISIBILITY</Text>
            <View style={styles.visibilityRow}>
              <VisibilityOption selected={visibility === "public"} title="Public" subtitle="Anyone can find you" icon="globe-outline" onPress={() => setVisibility("public")} />
              <VisibilityOption selected={visibility === "private"} title="Private" subtitle="Approve follow requests" icon="lock-closed-outline" onPress={() => setVisibility("private")} />
            </View>

            <Pressable onPress={saveSocialProfile} disabled={!hasSocialChanges || savingSocial} style={[styles.primaryBtn, (!hasSocialChanges || savingSocial) && styles.disabledBtn]}>
              {savingSocial ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name={savedSocial ? "checkmark" : "save-outline"} size={17} color="#fff" /><Text style={styles.primaryBtnText}>{savedSocial ? "Saved" : "Save social profile"}</Text></>}
            </Pressable>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={250}>
          <Pressable style={styles.previewCard} onPress={() => router.push({ pathname: "/(app)/social/profile", params: { identifier: profile.username } })}>
            <View style={styles.previewIcon}><Ionicons name="eye-outline" size={19} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Preview public profile</Text>
              <Text style={styles.cardSubtitle}>See what other FitLip users will see</Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={COLORS.textMuted} />
          </Pressable>
        </FadeSlideIn>

        <FadeSlideIn delay={300}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Fitness goal</Text>
            <Text style={styles.cardSubtitle}>This continues to control your workout and diet plans.</Text>
            <View style={styles.goalRow}>
              {GOALS.map((goal) => (
                <Pressable key={goal.key} onPress={() => setSelectedGoal(goal.key)} style={[styles.goalCard, selectedGoal === goal.key && { borderColor: goal.color, backgroundColor: goal.color + "12" }]}>
                  <Ionicons name={goal.icon} size={22} color={selectedGoal === goal.key ? goal.color : COLORS.textMuted} />
                  <Text style={[styles.goalLabel, selectedGoal === goal.key && { color: goal.color }]}>{goal.label}</Text>
                  <Text style={styles.goalDesc}>{goal.desc}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={saveGoal} disabled={!hasGoalChanges || savingGoal} style={[styles.primaryBtn, (!hasGoalChanges || savingGoal) && styles.disabledBtn]}>
              {savingGoal ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name={savedGoal ? "checkmark" : "fitness-outline"} size={17} color="#fff" /><Text style={styles.primaryBtnText}>{savedGoal ? "Goal updated" : "Save fitness goal"}</Text></>}
            </Pressable>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={340}>
          <Pressable onPress={() => router.push("/(app)/edit-health-profile")} style={styles.secondaryCard}>
            <View style={styles.previewIcon}><Ionicons name="body-outline" size={19} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}><Text style={styles.cardTitle}>Health profile</Text><Text style={styles.cardSubtitle}>Update weight, height, activity and nutrition inputs</Text></View>
            <Ionicons name="chevron-forward" size={19} color={COLORS.textMuted} />
          </Pressable>
        </FadeSlideIn>

        <FadeSlideIn delay={380}>
          <Pressable onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </FadeSlideIn>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function VisibilityOption({ selected, title, subtitle, icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.visibilityCard, selected && styles.visibilitySelected]}>
      <Ionicons name={icon} size={19} color={selected ? COLORS.primary : COLORS.textMuted} />
      <Text style={[styles.visibilityTitle, selected && { color: COLORS.primary }]}>{title}</Text>
      <Text style={styles.visibilitySubtitle}>{subtitle}</Text>
      {selected && <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} style={styles.visibilityCheck} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: "600", color: COLORS.textMuted },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  headerTitle: { fontSize: 27, fontWeight: "900", letterSpacing: -0.8, color: COLORS.textDark },
  headerSubtitle: { marginTop: 3, fontSize: 12.5, fontWeight: "600", color: COLORS.textMuted },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  heroCard: { borderRadius: 26, padding: 20, flexDirection: "row", alignItems: "center", marginBottom: 12, ...SHADOW, shadowColor: COLORS.primaryDark, shadowOpacity: 0.25 },
  avatarButton: { width: 86, height: 86, borderRadius: 43, backgroundColor: "rgba(255,255,255,0.18)", padding: 3, position: "relative" },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(23,15,54,0.5)" },
  avatarInitials: { color: "#fff", fontSize: 28, fontWeight: "900" },
  cameraBadge: { position: "absolute", right: -1, bottom: -1, width: 27, height: 27, borderRadius: 14, backgroundColor: COLORS.primaryDark, borderWidth: 2, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  heroName: { fontSize: 23, fontWeight: "900", color: "#fff", letterSpacing: -0.6 },
  heroHandle: { fontSize: 13, color: "rgba(255,255,255,0.78)", fontWeight: "700", marginTop: 3 },
  heroPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  heroPillText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
  statsCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14, marginBottom: 14 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 19, fontWeight: "900", color: COLORS.textDark },
  statLabel: { marginTop: 2, fontSize: 11, fontWeight: "700", color: COLORS.textMuted },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.border },
  card: { backgroundColor: COLORS.surface, borderRadius: 22, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, ...SHADOW },
  previewCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  secondaryCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  previewIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "850", color: COLORS.textDark },
  cardSubtitle: { marginTop: 3, fontSize: 12.5, lineHeight: 18, fontWeight: "600", color: COLORS.textMuted },
  requestBadge: { minWidth: 27, height: 27, paddingHorizontal: 7, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  requestBadgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  requestRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.surfaceMuted },
  miniAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  miniAvatarText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  requestName: { fontSize: 14, fontWeight: "800", color: COLORS.textDark },
  requestHandle: { marginTop: 1, fontSize: 11.5, color: COLORS.textMuted, fontWeight: "600" },
  acceptBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.success, alignItems: "center", justifyContent: "center", marginLeft: 7 },
  rejectBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginLeft: 7 },
  fieldLabel: { fontSize: 10.5, fontWeight: "900", letterSpacing: 0.8, color: COLORS.textMuted, marginBottom: 7 },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.background, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 12 },
  inputPrefix: { fontSize: 16, fontWeight: "900", color: COLORS.primary },
  input: { flex: 1, paddingHorizontal: 6, paddingVertical: 13, color: COLORS.textDark, fontSize: 15, fontWeight: "700" },
  bioInput: { minHeight: 86, textAlignVertical: "top", backgroundColor: COLORS.background, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 13, paddingVertical: 12, color: COLORS.textDark, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  visibilityRow: { flexDirection: "row", gap: 10 },
  visibilityCard: { flex: 1, minHeight: 108, borderRadius: 16, backgroundColor: COLORS.background, borderWidth: 1.5, borderColor: COLORS.border, padding: 13, position: "relative" },
  visibilitySelected: { backgroundColor: COLORS.primary + "10", borderColor: COLORS.primary },
  visibilityTitle: { fontSize: 14, fontWeight: "900", color: COLORS.textDark, marginTop: 10 },
  visibilitySubtitle: { fontSize: 10.5, fontWeight: "600", color: COLORS.textMuted, marginTop: 3, lineHeight: 14 },
  visibilityCheck: { position: "absolute", top: 10, right: 10 },
  primaryBtn: { minHeight: 48, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7, marginTop: 16, ...SHADOW, shadowColor: COLORS.primary, shadowOpacity: 0.23 },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "850" },
  disabledBtn: { backgroundColor: "#CEC8D7", shadowOpacity: 0 },
  goalRow: { flexDirection: "row", gap: 9, marginTop: 14 },
  goalCard: { flex: 1, minHeight: 108, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center", padding: 10 },
  goalLabel: { marginTop: 7, fontSize: 13.5, fontWeight: "900", color: COLORS.textDark },
  goalDesc: { marginTop: 2, fontSize: 10.5, fontWeight: "600", color: COLORS.textMuted, textAlign: "center" },
  greatnessCard: { marginBottom: 16, borderRadius: 24, overflow: "hidden", ...SHADOW },\n  greatnessPressed: { transform: [{ scale: 0.985 }], opacity: 0.96 },
  greatnessInner: { minHeight: 104, padding: 17, flexDirection: "row", alignItems: "center", gap: 12 },
  greatnessIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  greatnessEyebrow: { color: "rgba(255,255,255,0.72)", fontSize: 10, fontWeight: "900", letterSpacing: 1.05 },
  greatnessTitle: { color: "#fff", fontSize: 16, fontWeight: "900", marginTop: 2 },
  greatnessSub: { color: "rgba(255,255,255,0.78)", fontSize: 11, lineHeight: 16, marginTop: 3 },
  logoutBtn: { height: 50, borderRadius: 15, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.error + "35", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  logoutText: { fontSize: 14, fontWeight: "800", color: COLORS.error },
});
