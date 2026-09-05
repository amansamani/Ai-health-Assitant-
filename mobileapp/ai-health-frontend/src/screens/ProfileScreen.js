import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Image } from "react-native";
import LucideIcon from "../components/ui/LucideIcon";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import API, { API_BASE_URL } from "../services/api";
import { getToken } from "../utils/secureToken";
import { AuthContext } from "../context/AuthContext";
import { COLORS, SHADOW } from "../constants/theme";
import FadeSlideIn from "../components/FadeSlideIn";
import ConfirmModal from "../components/ui/ConfirmModal";

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

function ProfileRow({ icon, title, subtitle, onPress, danger = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.rowCard, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <LucideIcon name={icon} size={20} color={danger ? COLORS.error : COLORS.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger && { color: COLORS.error }]}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <LucideIcon name="chevron-forward" size={18} color={COLORS.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { logout, userToken } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [token, setToken] = useState(userToken || null);
  const [loading, setLoading] = useState(true);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, currentToken] = await Promise.all([
        API.get("/user/profile"),
        getToken(),
      ]);
      if (!mountedRef.current) return;
      setProfile(profileRes.data);
      setToken(currentToken);
    } catch (err) {
      console.log("Profile fetch error:", err.response?.data?.message || err.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const imageSource = useMemo(() => profileImageSource(profile, token), [profile, token]);

  const confirmLogout = () => setLogoutConfirmVisible(true);

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <FadeSlideIn delay={0}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Profile</Text>
              <Text style={styles.headerSubtitle}>Your FitLip account</Text>
            </View>
            <Pressable
              style={styles.headerSettings}
              onPress={() => router.push("/(app)/profile-settings")}
              accessibilityRole="button"
              accessibilityLabel="Open settings"
            >
              <LucideIcon name="settings-outline" size={20} color={COLORS.textDark} />
            </Pressable>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={60}>
          <View style={styles.identityCard}>
            <View style={styles.identityAvatarWrap}>
              {imageSource ? (
                <Image source={imageSource} style={styles.identityAvatar} />
              ) : (
                <View style={styles.identityFallback}>
                  <Text style={styles.identityInitials}>{initials(profile.name)}</Text>
                </View>
              )}
            </View>
            <Text style={styles.identityName}>{profile.name || "User"}</Text>
            <Text style={styles.identityUsername}>@{profile.username || "username"}</Text>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={100}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <ProfileRow
            icon="person-outline"
            title="My Account"
            subtitle="Profile, followers, following and posts"
            onPress={() => router.push({ pathname: "/(app)/social/profile", params: { identifier: profile.username } })}
          />
          <ProfileRow
            icon="trophy-outline"
            title="Achievements"
            subtitle="Badges, milestones and your FitLip progress"
            onPress={() => router.push("/(app)/social/achievements")}
          />
        </FadeSlideIn>

        <FadeSlideIn delay={150}>
          <Text style={styles.sectionLabel}>FITNESS</Text>
          <ProfileRow
            icon="heart-outline"
            title="Health Profile"
            subtitle="Body, goals, nutrition and health information"
            onPress={() => router.push("/(app)/edit-health-profile")}
          />
          <ProfileRow
            icon="barbell-outline"
            title="Custom Exercises"
            subtitle="Create and manage your custom workout plans"
            onPress={() => router.push("/(app)/custom-workout")}
          />
        </FadeSlideIn>

        <FadeSlideIn delay={200}>
          <Text style={styles.sectionLabel}>APP</Text>
          <ProfileRow
            icon="settings-outline"
            title="Settings"
            subtitle="Privacy, notifications, appearance and tracking"
            onPress={() => router.push("/(app)/profile-settings")}
          />
        </FadeSlideIn>

        <FadeSlideIn delay={250}>
          <Pressable
            onPress={confirmLogout}
            style={({ pressed }) => [styles.logoutCard, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <View style={styles.logoutIcon}><LucideIcon name="log-out-outline" size={20} color={COLORS.error} /></View>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </FadeSlideIn>

        <Text style={styles.footerText}>FitLip · Your fitness journey, your account</Text>
        </ScrollView>
      </SafeAreaView>
      <ConfirmModal
        visible={logoutConfirmVisible}
        title="Log out?"
        message="You can sign back in any time."
        confirmText="Log Out"
        icon="log-out-outline"
        tone="danger"
        onCancel={() => setLogoutConfirmVisible(false)}
        onConfirm={async () => { setLogoutConfirmVisible(false); await logout(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: 10, color: COLORS.textMuted, fontSize: 12, fontWeight: "700" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  headerTitle: { fontSize: 29, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.7 },
  headerSubtitle: { marginTop: 3, fontSize: 12.5, color: COLORS.textMuted, fontWeight: "600" },
  headerSettings: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  identityCard: { alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 24, paddingHorizontal: 20, ...SHADOW, shadowOpacity: 0.06 },
  identityAvatarWrap: { width: 92, height: 92, borderRadius: 46, padding: 3, backgroundColor: COLORS.surfaceMuted, borderWidth: 1, borderColor: COLORS.border },
  identityAvatar: { width: 84, height: 84, borderRadius: 42 },
  identityFallback: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primaryDark, alignItems: "center", justifyContent: "center" },
  identityInitials: { color: "#fff", fontSize: 28, fontWeight: "800" },
  identityName: { marginTop: 13, fontSize: 22, fontWeight: "800", color: COLORS.textDark },
  identityUsername: { marginTop: 3, fontSize: 13, fontWeight: "700", color: COLORS.primary },
  sectionLabel: { marginTop: 22, marginBottom: 9, paddingHorizontal: 2, color: COLORS.textMuted, fontSize: 10.5, fontWeight: "800", letterSpacing: 1.05 },
  rowCard: { minHeight: 72, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 19, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, ...SHADOW, shadowOpacity: 0.045 },
  rowPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  rowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceMuted, marginRight: 12 },
  rowIconDanger: { backgroundColor: COLORS.errorBg },
  rowCopy: { flex: 1, paddingRight: 8 },
  rowTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark },
  rowSubtitle: { marginTop: 3, fontSize: 11.5, lineHeight: 16, fontWeight: "600", color: COLORS.textMuted },
  logoutCard: { minHeight: 54, marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.error + "35", backgroundColor: COLORS.errorBg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  logoutText: { fontSize: 14, fontWeight: "800", color: COLORS.error },
  footerText: { marginTop: 18, textAlign: "center", fontSize: 10.5, color: COLORS.textMuted, fontWeight: "600" },
});
