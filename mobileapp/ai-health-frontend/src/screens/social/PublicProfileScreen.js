import { useCallback, useEffect, useState } from "react";
import { showToast } from "../../services/uiFeedback";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import LucideIcon from "../../components/ui/LucideIcon";
import { LinearGradient } from "expo-linear-gradient";
import API, { API_BASE_URL } from "../../services/api";
import { getMyRuns } from "../../services/runService";
import { formatDistanceKm, formatDuration, formatPace, paceSecPerKm } from "../../utils/runMath";
import { getToken } from "../../utils/secureToken";
import { COLORS, SHADOW } from "../../constants/theme";
import FadeSlideIn from "../../components/FadeSlideIn";

function initials(name) {
  return String(name || "User").split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}

function Stat({ value, label }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const { identifier } = useLocalSearchParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [myRuns, setMyRuns] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [profileRes, currentToken] = await Promise.all([
        API.get(`/social/profile/${encodeURIComponent(identifier)}`),
        getToken(),
      ]);
      const data = profileRes.data;
      setProfile(data);
      setToken(currentToken);
      if (data.isSelf) {
        try {
          const runs = await getMyRuns(1, 12);
          setMyRuns(runs.runs || []);
        } catch (_) { setMyRuns([]); }
      } else {
        setMyRuns([]);
      }
    } catch (err) {
      showToast(err.response?.data?.message || "This profile could not be loaded.", { title: "Profile unavailable", type: "error", duration: 3500 });
      setTimeout(() => router.back(), 400);
    } finally {
      setLoading(false);
    }
  }, [identifier, router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFollow = async () => {
    if (!profile || profile.isSelf) return;
    try {
      setBusy(true);
      if (profile.followStatus) {
        await API.delete(`/social/follow/${profile._id}`);
        setProfile((prev) => ({ ...prev, isFollowing: false, followStatus: null, followerCount: Math.max(0, (prev.followerCount || 0) - (prev.isFollowing ? 1 : 0)) }));
      } else {
        const { data } = await API.post(`/social/follow/${profile._id}`);
        setProfile((prev) => ({
          ...prev,
          followStatus: data.status,
          isFollowing: data.status === "accepted",
          followerCount: data.status === "accepted" ? (prev.followerCount || 0) + 1 : prev.followerCount,
        }));
      }
    } catch (err) {
      showToast(err.response?.data?.message || "Please try again.", { title: "Couldn't update follow", type: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !profile) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const imageSource = profile.hasProfilePhoto && token ? {
    uri: `${API_BASE_URL}/user/profile/photo/${profile._id}?v=${encodeURIComponent(profile.profileImageUpdatedAt || "1")}`,
    headers: { Authorization: `Bearer ${token}` },
  } : null;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <Pressable style={styles.topBtn} onPress={() => router.back()}><LucideIcon name="chevron-back" size={22} color={COLORS.textDark} /></Pressable>
          <Text style={styles.topTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>

        <FadeSlideIn delay={0}>
          <LinearGradient colors={[COLORS.primaryDark, COLORS.primary, COLORS.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroAvatarWrap}>
              {imageSource ? <Image source={imageSource} style={styles.heroAvatar} /> : <View style={styles.heroFallback}><Text style={styles.heroInitials}>{initials(profile.name)}</Text></View>}
            </View>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.username}>@{profile.username}</Text>
            {!!profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

            {!profile.isSelf && (
              <Pressable onPress={toggleFollow} disabled={busy} style={[styles.followBtn, profile.followStatus && styles.followBtnSecondary]}>
                {busy ? <ActivityIndicator size="small" color={profile.followStatus ? COLORS.primary : "#fff"} /> : <>
                  <LucideIcon name={profile.isFollowing ? "checkmark" : profile.followStatus === "pending" ? "time-outline" : "person-add-outline"} size={16} color={profile.followStatus ? COLORS.primary : "#fff"} />
                  <Text style={[styles.followBtnText, profile.followStatus && { color: COLORS.primary }]}>
                    {profile.isFollowing ? "Following" : profile.followStatus === "pending" ? "Requested" : profile.profileVisibility === "private" ? "Request to follow" : "Follow"}
                  </Text>
                </>}
              </Pressable>
            )}
          </LinearGradient>
        </FadeSlideIn>

        <FadeSlideIn delay={70}>
          <View style={styles.rankStrip}>
            <View style={styles.rankStripIcon}><LucideIcon name={profile.rankIcon || "barbell-outline"} size={19} color={COLORS.primary} /></View>
            <View style={{ flex: 1 }}><Text style={styles.rankStripTitle}>{profile.rankTitle || "Bronze Dumbbell"}</Text><Text style={styles.rankStripMeta}>Level {profile.level || 1} · {profile.totalXp || 0} XP</Text></View>
            <View style={styles.rankPill}><Text style={styles.rankPillText}>{profile.levelTitle || "Rookie"}</Text></View>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={90}>
          <View style={styles.statsCard}>
            <Stat value={profile.followerCount ?? 0} label="Followers" />
            <View style={styles.divider} />
            <Stat value={profile.followingCount ?? 0} label="Following" />
            <View style={styles.divider} />
            <Stat value={profile.profileVisibility === "public" ? "Public" : "Private"} label="Visibility" />
          </View>
        </FadeSlideIn>
        <FadeSlideIn delay={105}>
          {profile.isSelf && (
            <Pressable style={styles.editProfileBtn} onPress={() => router.push("/(app)/social/profile-settings")}>
              <LucideIcon name="create-outline" size={16} color="#fff" />
              <Text style={styles.editProfileBtnText}>Edit Profile</Text>
            </Pressable>
          )}
        </FadeSlideIn>

        <FadeSlideIn delay={125}>
          <View style={styles.postsCard}>
            <View style={styles.postsHeader}>
              <View><Text style={styles.postsTitle}>Posts</Text><Text style={styles.postsSubtitle}>{myRuns.length ? `${myRuns.length} recent activities` : "Your shared running activities"}</Text></View>
              {myRuns.length > 0 && <Pressable onPress={() => router.push("/(app)/run-feed")}><Text style={styles.seeAll}>See all</Text></Pressable>}
            </View>
            {profile.isSelf && myRuns.length === 0 ? (
              <View style={styles.emptyPosts}><LucideIcon name="walk-outline" size={28} color={COLORS.textLight} /><Text style={styles.emptyPostsText}>Your running posts will appear here after you finish and save a run.</Text></View>
            ) : profile.isSelf ? (
              myRuns.map((run) => {
                const pace = paceSecPerKm(run.durationSeconds, run.distanceMeters);
                const date = run.startedAt ? new Date(run.startedAt) : null;
                const timeLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
                return (
                  <Pressable key={run._id} onPress={() => router.push("/(app)/run-feed")} style={styles.postRow}>
                    <View style={styles.postIcon}><LucideIcon name={run.activityType === "cycle" ? "bicycle-outline" : run.activityType === "walk" ? "walk-outline" : "footsteps-outline"} size={19} color={COLORS.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postActivity}>{run.activityType === "cycle" ? "Cycling" : run.activityType === "walk" ? "Walk" : "Run"}</Text>
                      <Text style={styles.postMeta}>{formatDistanceKm(run.distanceMeters)} km · {formatDuration(run.durationSeconds)}{pace ? ` · ${formatPace(pace)} /km` : ""}</Text>
                      <Text style={styles.postTime}>{timeLabel}</Text>
                      {!!run.caption && <Text style={styles.postCaption} numberOfLines={2}>{run.caption}</Text>}
                    </View>
                    <LucideIcon name="chevron-forward" size={16} color={COLORS.textLight} />
                  </Pressable>
                );
              })
            ) : null}
          </View>
        </FadeSlideIn>

        {profile.canView ? (
          <FadeSlideIn delay={130}>
            <View style={styles.infoCard}>
              <LucideIcon name="fitness-outline" size={24} color={COLORS.primary} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.infoTitle}>{profile.isSelf ? "Your public identity" : "FitLip profile"}</Text>
                <Text style={styles.infoText}>{profile.isSelf ? "This is how other FitLip users can recognize you." : "Fitness activity can be shared here as you build your FitLip identity."}</Text>
              </View>
            </View>
          </FadeSlideIn>
        ) : (
          <FadeSlideIn delay={130}>
            <View style={styles.privateCard}>
              <View style={styles.lockCircle}><LucideIcon name="lock-closed" size={22} color={COLORS.primary} /></View>
              <Text style={styles.privateTitle}>Private profile</Text>
              <Text style={styles.privateText}>Follow this account and wait for approval to see their shared activity.</Text>
            </View>
          </FadeSlideIn>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  topBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textDark },
  hero: { borderRadius: 28, alignItems: "center", paddingHorizontal: 24, paddingTop: 26, paddingBottom: 28, ...SHADOW, shadowColor: COLORS.primaryDark, shadowOpacity: 0.25 },
  heroAvatarWrap: { width: 102, height: 102, borderRadius: 51, padding: 3, backgroundColor: "rgba(255,255,255,0.22)", marginBottom: 13 },
  heroAvatar: { width: 96, height: 96, borderRadius: 48 },
  heroFallback: { width: 96, height: 96, borderRadius: 48, backgroundColor: "rgba(23,15,54,0.5)", alignItems: "center", justifyContent: "center" },
  heroInitials: { color: "#fff", fontSize: 32, fontWeight: "800" },
  name: { fontSize: 25, fontWeight: "800", color: "#fff" },
  username: { marginTop: 2, color: "rgba(255,255,255,0.76)", fontSize: 13, fontWeight: "700" },
  bio: { marginTop: 12, maxWidth: 290, color: "rgba(255,255,255,0.9)", fontSize: 13, lineHeight: 19, fontWeight: "500", textAlign: "center" },
  followBtn: { minWidth: 132, minHeight: 44, paddingHorizontal: 18, borderRadius: 15, backgroundColor: COLORS.primaryDark, marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  followBtnSecondary: { backgroundColor: "#fff" },
  followBtnText: { color: "#fff", fontSize: 13.5, fontWeight: "850" },
  rankStrip: { marginTop: 10, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  rankStripIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginRight: 10 },
  rankStripTitle: { fontSize: 14, fontWeight: "800", color: COLORS.textDark },
  rankStripMeta: { marginTop: 2, fontSize: 11, color: COLORS.textMuted, fontWeight: "700" },
  rankPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: COLORS.surfaceMuted },
  rankPillText: { color: COLORS.primary, fontSize: 10.5, fontWeight: "800" },
  statsCard: { marginTop: 12, flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 14 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 17, fontWeight: "800", color: COLORS.textDark },
  statLabel: { marginTop: 2, fontSize: 10.5, color: COLORS.textMuted, fontWeight: "700" },
  divider: { width: 1, height: 28, backgroundColor: COLORS.border },
  infoCard: { marginTop: 12, backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, padding: 18, flexDirection: "row" },
  infoTitle: { fontSize: 15, fontWeight: "850", color: COLORS.textDark },
  infoText: { marginTop: 5, color: COLORS.textMuted, fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
  editProfileBtn:{alignSelf:"center",marginTop:10,minHeight:42,paddingHorizontal:16,borderRadius: 12,backgroundColor:COLORS.primary,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7},editProfileBtnText:{color:"#fff",fontSize:12.5,fontWeight: "800"},postsCard:{marginTop:14,backgroundColor:COLORS.surface,borderRadius: 20,borderWidth:1,borderColor:COLORS.border,padding:16},postsHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:8},postsTitle:{fontSize:16,fontWeight: "800",color:COLORS.textDark},postsSubtitle:{marginTop:3,fontSize:11.5,color:COLORS.textMuted,fontWeight:"600"},seeAll:{fontSize:11.5,fontWeight: "800",color:COLORS.primary},emptyPosts:{alignItems:"center",paddingVertical:24,gap:8},emptyPostsText:{maxWidth:290,textAlign:"center",fontSize:12,color:COLORS.textMuted,lineHeight:17,fontWeight:"600"},postRow:{flexDirection:"row",alignItems:"center",paddingVertical:12,borderTopWidth:1,borderTopColor:COLORS.border},postIcon:{width:40,height:40,borderRadius: 12,backgroundColor:COLORS.surfaceMuted,alignItems:"center",justifyContent:"center",marginRight:11},postActivity:{fontSize:14,fontWeight: "800",color:COLORS.textDark},postMeta:{marginTop:3,fontSize:11.5,color:COLORS.textLight,fontWeight:"700"},postTime:{marginTop:2,fontSize:10.5,color:COLORS.textMuted,fontWeight:"600"},postCaption:{marginTop:5,fontSize:11.5,color:COLORS.textLight,lineHeight:16,fontWeight:"600"},  privateCard: { marginTop: 12, backgroundColor: COLORS.surface, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", padding: 28 },
  lockCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.surfaceMuted, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  privateTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textDark },
  privateText: { marginTop: 6, maxWidth: 290, textAlign: "center", color: COLORS.textMuted, fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
});
