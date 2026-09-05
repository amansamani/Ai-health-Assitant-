import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  Image,
  ActivityIndicator,
  AppState,
} from "react-native";
import { useState, useCallback, useContext, useRef, useEffect, useMemo } from "react";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import LucideIcon from "../components/ui/LucideIcon";
import API, { API_BASE_URL } from "../services/api";
import { LinearGradient } from "expo-linear-gradient";
import { AuthContext } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS } from "../constants/theme";
import CircularProgressRing from "../components/CircularProgressRing";
import WeeklyInsightCard from "../components/WeeklyInsightCard";
import { StepsIcon, SleepIcon, ManualLogIcon, MotivationSkyIllustration, getMotivationCopy, SunriseIcon, SunIcon, MoonStarIcon } from "../components/icons/MotionIcons";
import { useReplayOnFocus } from "../hooks/useReplayOnFocus";
import { useActiveCalorieGoal } from "../hooks/useActiveCalorieGoal";
import AiCoachFab from "../components/AiCoachFab";
import { getRunFeed, toggleRunLike, syncPendingRunLikes } from "../services/runService";
import { formatDistanceKm, formatDuration, formatPace, paceSecPerKm } from "../utils/runMath";
import MealCompletionCard from "../components/MealCompletionCard";

const { width } = Dimensions.get("window");

function getHomeProfileImage(user, token) {
  if (!user?.hasProfilePhoto || !user?._id || !token) return null;
  return {
    uri: `${API_BASE_URL}/user/profile/photo/${user._id}?v=${encodeURIComponent(user.profileImageUpdatedAt || "1")}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

// ─── Animated Card Wrapper ────────────────────────────────────────────────────
function FadeSlideIn({ delay = 0, children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 480, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 480, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ─── Stat Square ──────────────────────────────────────────────────────────────
function StatSquare({ icon, renderIcon, label, value, color, progress, onPress }) {
  const scale      = useRef(new Animated.Value(1)).current;
  const onPressIn  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <Pressable
      onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
      style={{ width: (width - 56) / 3 }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. View details`}
    >
      <Animated.View style={[styles.statSquare, { transform: [{ scale }] }]}>
        <View style={styles.ringContainer}>
          <CircularProgressRing
            progress={Math.min(progress, 1)}
            icon={icon}
            renderIcon={renderIcon}
            label=""
            color={color}
            size={72}
            strokeWidth={6}
          />
        </View>
        <Text style={styles.squareValue}>{value}</Text>
        <Text style={[styles.squareLabel, { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── Motivation Card ────────────────────────────────────────────────────────
// A small rotating set of one-liners, deterministically picked by day-of-year
// so it changes daily without needing any backend call or extra state.
const MOTIVATION_QUOTES = [
  "Small steps every day add up to big change.",
  "Discipline is choosing what you want most over what you want now.",
  "Your only competition is who you were yesterday.",
  "Progress, not perfection.",
  "The body achieves what the mind believes.",
  "Consistency beats intensity.",
  "Every workout counts, even the short ones.",
  "Take care of your body — it's the only place you have to live.",
  "Energy and persistence conquer all things.",
  "You don't have to be extreme, just consistent.",
];

function getDailyQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86400000);
  return MOTIVATION_QUOTES[dayOfYear % MOTIVATION_QUOTES.length];
}

function MotivationCard({ iconTrigger }) {
  const quote = useMemo(getDailyQuote, []);
  const { label, hint, Icon } = useMemo(getMotivationCopy, []);
  const shimmer = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    shimmer.setValue(0);
    breathe.setValue(0);

    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(700),
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1800,
          easing: undefined,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ])
    );

    shineLoop.start();
    breatheLoop.start();

    return () => {
      shineLoop.stop();
      breatheLoop.stop();
    };
  }, []);

  const glowStyle = {
    opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.20] }),
    transform: [
      { translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-130, 180] }) },
      { rotate: "-18deg" },
    ],
  };

  const breatheStyle = {
    opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.20] }),
    transform: [{
      scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }),
    }],
  };

  return (
    <View style={styles.motivationCard}>
      <View pointerEvents="none" style={styles.motivationScene}>
        <MotivationSkyIllustration trigger={iconTrigger} width={width - 40} height={172} />
        <Animated.View style={[styles.motivationAtmosphere, breatheStyle]} />
        <Animated.View style={[styles.motivationGlow, glowStyle]}>
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(255,255,255,0)",
              "rgba(255,255,255,0.04)",
              "rgba(255,255,255,0.14)",
              "rgba(255,255,255,0.04)",
              "rgba(255,255,255,0)",
            ]}
            locations={[0, 0.25, 0.5, 0.75, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={styles.motivationScrim} />
        <View pointerEvents="none" style={styles.motivationVignette} />
      </View>

      <View style={styles.motivationContent}>
        <View style={styles.motivationTopRow}>
          <View style={styles.motivationIconWrap}>
            <Icon size={15} color="#FFFFFF" />
          </View>
          <Text style={styles.motivationLabel}>{label}</Text>
        </View>
        <Text style={styles.motivationQuote}>{quote}</Text>
        <View style={styles.motivationHint}>
          <LucideIcon name="sunny-outline" size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.motivationHintText}>{hint}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { updatedToday: updatedTodayParam } = useLocalSearchParams();
  const { token, user } = useContext(AuthContext);
  const firstName = user?.firstName ?? user?.first_name ?? user?.name?.split(" ")[0] ?? null;
  const [today, setToday]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Good Morning");
  const [activityFeed, setActivityFeed] = useState([]);
  const [activityFeedLoading, setActivityFeedLoading] = useState(true);
  const [dietPlan, setDietPlan] = useState(null);

  const STEP_GOAL  = 10000;
  const SLEEP_GOAL = 8;
  const { activeCalorieGoal } = useActiveCalorieGoal();

  const iconTrigger = useReplayOnFocus();

  useEffect(() => {
    const h = new Date().getHours();
    if      (h >= 5  && h < 12) setGreeting("Good Morning");
    else if (h >= 12 && h < 17) setGreeting("Good Afternoon");
    else if (h >= 17 && h < 21) setGreeting("Good Evening");
    else                        setGreeting("Good Night");
  }, []);

  const fetchToday = useCallback(async () => {
    try {
      const res = await API.get("/track/today");
      setToday(res.data);
    } catch {
      setToday(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDietPlan = useCallback(async () => {
    try {
      const res = await API.get("/nutrition/current");
      setDietPlan(res.data || null);
    } catch {
      setDietPlan(null);
    }
  }, []);

  const fetchActivityFeed = useCallback(async () => {
    try {
      setActivityFeedLoading(true);
      const res = await getRunFeed(1, 4);
      const feedRuns = Array.isArray(res.runs) ? res.runs.slice(0, 4) : [];
      const syncedRuns = await syncPendingRunLikes(feedRuns);
      setActivityFeed(syncedRuns);
    } catch {
      setActivityFeed([]);
    } finally {
      setActivityFeedLoading(false);
    }
  }, []);

  const likeInFlightRef = useRef(new Set());

  const handleFeedLike = useCallback(async (run) => {
    if (!run?._id || likeInFlightRef.current.has(run._id)) return;
    likeInFlightRef.current.add(run._id);

    const previousLiked = Boolean(run.likedByMe);
    const previousCount = Number(run.likesCount || 0);

    setActivityFeed((prev) => prev.map((item) => item._id === run._id
      ? { ...item, likedByMe: !previousLiked, likesCount: Math.max(0, previousCount + (previousLiked ? -1 : 1)) }
      : item
    ));

    try {
      const result = await toggleRunLike(run._id, !previousLiked);
      const liked = Boolean(result?.liked);
      const likesCount = Number(result?.likesCount);
      setActivityFeed((prev) => prev.map((item) => item._id === run._id
        ? { ...item, likedByMe: liked, likesCount: Number.isFinite(likesCount) ? likesCount : item.likesCount }
        : item
      ));
    } catch {
      fetchActivityFeed();
    } finally {
      likeInFlightRef.current.delete(run._id);
    }
  }, [fetchActivityFeed]);

  const handleFeedShare = useCallback((run) => {
    router.push({ pathname: "/(app)/share-activity", params: { runId: run._id } });
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      if (updatedTodayParam) {
        try {
          setToday(JSON.parse(updatedTodayParam));
        } catch {
          // malformed param — fall through to a real refetch below
        }
        setLoading(false);
        // Native setParams (not the legacy-nav shim) so `undefined` actually
        // clears the key instead of being silently dropped from the call.
        router.setParams({ updatedToday: undefined });
      } else {
        setLoading(true);
        fetchToday();
      }
      fetchActivityFeed();
      fetchDietPlan();
    }, [updatedTodayParam, token, fetchToday, fetchActivityFeed, fetchDietPlan])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && token) {
        fetchToday();
        fetchActivityFeed();
        fetchDietPlan();
      }
    });
    return () => subscription.remove();
  }, [token, fetchToday, fetchActivityFeed, fetchDietPlan]);

  const steps    = today?.steps ?? 0;
  const calories = today?.caloriesBurned ?? 0;
  const sleep    = today?.sleep ?? 0;
  const stepPct  = Math.round(Math.min(steps / STEP_GOAL, 1) * 100);

  const GreetingIcon =
    greeting === "Good Morning" ? SunriseIcon
    : greeting === "Good Afternoon" ? SunIcon
    : MoonStarIcon;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── HEADER ── */}
        <FadeSlideIn delay={0}>
          <View style={styles.headerRow}>
            <View style={styles.greetingRow}>
              <View style={styles.greetingAccent} />
              <View>
                <Text style={styles.greeting}>
                  {greeting}{firstName ? `, ${firstName}` : ""}!
                </Text>
                <Text style={styles.subtitle}>Let&apos;s crush today&apos;s goals</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={() => router.push("/(app)/notifications")}
                style={styles.notificationButton}
                accessibilityRole="button"
                accessibilityLabel="Open notifications"
              >
                <LucideIcon name="notifications-outline" size={21} color={COLORS.textDark} />
                <View style={styles.notificationDot} />
              </Pressable>
              <Pressable
                onPress={() => router.push("/(app)/profile")}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
              {getHomeProfileImage(user, token) ? (
                <Image
                  source={getHomeProfileImage(user, token)}
                  style={styles.avatar}
                  resizeMode="cover"
                  onError={(event) => {
                    console.log("Home profile image failed:", event.nativeEvent?.error);
                  }}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: COLORS.primaryDark }]}>
                  <Text style={styles.avatarText}>
                    {(firstName ?? "A")[0].toUpperCase()}
                  </Text>
                </View>
              )}
              </Pressable>
            </View>
          </View>
        </FadeSlideIn>

        {/* ── TODAY'S MOTIVATION ── */}
        <FadeSlideIn delay={60}>
          <MotivationCard iconTrigger={iconTrigger} />
        </FadeSlideIn>

        {/* ── TODAY'S FOOD ── */}
        <FadeSlideIn delay={110}>
          <MealCompletionCard plan={dietPlan} readOnly />
        </FadeSlideIn>

        {/* ── TODAY'S STATS ── */}
        <FadeSlideIn delay={160}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today&apos;s Stats</Text>
            <Pressable
              onPress={() => router.push("/(app)/(tabs)/tracking")}
              style={styles.editBtn}
              accessibilityRole="button"
              accessibilityLabel="Edit today's stats"
            >
              <LucideIcon name="create-outline" size={13} color={COLORS.primary} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.statRow}>
            <StatSquare
              icon="footsteps-outline" label="Steps"
              renderIcon={<StepsIcon trigger={iconTrigger} size={24} color="#22C55E" />}
              value={loading ? "—" : steps.toLocaleString()}
              color="#22C55E" progress={Math.min(steps / STEP_GOAL, 1)}
              onPress={() => router.push({ pathname: "/(app)/track-detail", params: { type: "steps" } })}
            />
            <StatSquare
              icon="flame-outline" label="Active Burn"
              value={loading ? "—" : `${calories} kcal`}
              color="#F97316" progress={Math.min(calories / activeCalorieGoal, 1)}
              onPress={() => router.push({ pathname: "/(app)/track-detail", params: { type: "caloriesBurned" } })}
            />
            <StatSquare
              icon="moon-outline" label="Sleep"
              renderIcon={<SleepIcon trigger={iconTrigger} size={24} color={COLORS.primary} />}
              value={loading ? "—" : `${sleep}h`}
              color={COLORS.primary} progress={Math.min(sleep / SLEEP_GOAL, 1)}
              onPress={() => router.push({ pathname: "/(app)/track-detail", params: { type: "sleep" } })}
            />
          </View>
        </FadeSlideIn>

        {/* ── COMPETE WITH FRIENDS ── */}
        <FadeSlideIn delay={160}>
          <Pressable
            onPress={() => router.push("/(app)/social")}
            style={({ pressed }) => [styles.competeCard, pressed && { transform: [{ scale: 0.99 }], opacity: 0.96 }]}
            accessibilityRole="button"
            accessibilityLabel="Open Train Together"
          >
            <LinearGradient
              colors={[COLORS.primaryDark, COLORS.primary, "#7C3AED"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.competeInner}
            >
              <View pointerEvents="none" style={styles.competeGlowOne} />
              <View pointerEvents="none" style={styles.competeGlowTwo} />

              <View style={styles.competeTopRow}>
                <View style={styles.competeBadge}>
                  <LucideIcon name="users-outline" size={17} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.competeEyebrow}>FITNESS TOGETHER</Text>
                  <Text style={styles.competeTitle}>Train Together</Text>
                </View>
                <View style={styles.competeArrow}>
                  <LucideIcon name="chevron-forward" size={18} color="#fff" />
                </View>
              </View>

              <Text style={styles.competeSub}>Turn consistency into friendly competition.</Text>

              <View style={styles.competePills}>
                <View style={styles.competePill}><LucideIcon name="flash-outline" size={13} color="#fff" /><Text style={styles.competePillText}>Duels</Text></View>
                <View style={styles.competePill}><LucideIcon name="flame-outline" size={13} color="#fff" /><Text style={styles.competePillText}>Streaks</Text></View>
                <View style={styles.competePill}><LucideIcon name="trophy-outline" size={13} color="#fff" /><Text style={styles.competePillText}>XP & ranks</Text></View>
              </View>

              <View style={styles.competeCtaRow}>
                <Text style={styles.competeCta}>See your circle</Text>
                <LucideIcon name="arrow-forward" size={15} color="#fff" />
              </View>
            </LinearGradient>
          </Pressable>
        </FadeSlideIn>

        <WeeklyInsightCard />

        {/* ── LOG TODAY'S FOOD (manual entry) ── */}
        <FadeSlideIn delay={200}>
          <Pressable
            onPress={() => router.push("/(app)/nutrition/meal-logger")}
            style={({ pressed }) => [styles.logFoodCard, { opacity: pressed ? 0.93 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Log today's food manually"
          >
            <View style={styles.logFoodAccent} />
            <View style={styles.logFoodIconWrap}>
              <ManualLogIcon trigger={iconTrigger} size={22} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logFoodTitle}>Log Today&apos;s Food</Text>
              <Text style={styles.logFoodSub}>Search & add manually</Text>
            </View>
            <LucideIcon name="chevron-forward" size={18} color={COLORS.textMuted} />
          </Pressable>
        </FadeSlideIn>

        {/* ── FRIEND ACTIVITY FEED ── */}
        <FadeSlideIn delay={190}>
          <View style={styles.feedSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Activity</Text>
                <Text style={styles.feedSubtitle}>See what your fitness circle is doing</Text>
              </View>
              <Pressable onPress={() => router.push("/(app)/run-feed")} style={styles.feedSeeAll}>
                <Text style={styles.feedSeeAllText}>See all</Text>
                <LucideIcon name="chevron-forward" size={15} color={COLORS.primary} />
              </Pressable>
            </View>

            {activityFeedLoading ? (
              <View style={styles.feedLoading}><ActivityIndicator size="small" color={COLORS.primary} /></View>
            ) : activityFeed.length === 0 ? (
              <View style={styles.feedEmpty}>
                <View style={styles.feedEmptyIcon}><LucideIcon name="people-outline" size={20} color={COLORS.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.feedEmptyTitle}>Your activity feed is ready</Text>
                  <Text style={styles.feedEmptyText}>Follow friends to see their runs, walks and rides here.</Text>
                </View>
              </View>
            ) : (
              activityFeed.map((run) => {
                const pace = paceSecPerKm(run.distanceMeters, run.durationSeconds);
                const activityLabel = run.activityType === "cycle" ? "Cycling" : run.activityType === "walk" ? "Walk" : "Run";
                const username = run.user?.username;
                const profileIdentifier = username || run.user?._id;
                return (
                  <View key={run._id} style={styles.feedCard}>
                    <Pressable
                      style={({ pressed }) => [styles.feedMainRow, { opacity: pressed ? 0.92 : 1 }]}
                      onPress={() => profileIdentifier && router.push({ pathname: "/(app)/social/profile", params: { identifier: profileIdentifier } })}
                    >
                    {run.user?.hasProfilePhoto || run.user?.profileImageUpdatedAt || run.user?.profileImageUrl || run.user?.picture ? (
                      <Image
                        source={{
                          uri: run.user?.hasProfilePhoto || run.user?.profileImageUpdatedAt
                            ? `${API_BASE_URL}/user/profile/photo/${run.user._id}?v=${encodeURIComponent(run.user.profileImageUpdatedAt || "1")}`
                            : run.user.profileImageUrl || run.user.picture,
                          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
                        }}
                        style={styles.feedAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.feedAvatar}>
                        <Text style={styles.feedAvatarText}>{String(run.user?.name || "U").trim().charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feedName}>{run.user?.name || "Someone you follow"}</Text>
                      <Text style={styles.feedActivity}>{activityLabel} · {formatDistanceKm(run.distanceMeters)} km · {formatDuration(run.durationSeconds)}</Text>
                      <Text style={styles.feedMetrics}>{pace ? `${formatPace(pace)} /km` : "Activity complete"}{run.caloriesBurned ? ` · ${run.caloriesBurned} kcal` : ""}</Text>
                    </View>
                      <LucideIcon name={run.activityType === "cycle" ? "bicycle-outline" : run.activityType === "walk" ? "walk-outline" : "footsteps-outline"} size={19} color={COLORS.primary} />
                    </Pressable>
                    <View style={styles.feedActions}>
                      <Pressable style={styles.feedAction} onPress={() => handleFeedLike(run)}>
                        <LucideIcon name={run.likedByMe ? "heart" : "heart-outline"} size={16} color={run.likedByMe ? COLORS.error : COLORS.textLight} />
                        <Text style={styles.feedActionText}>{run.likesCount || 0}</Text>
                      </Pressable>
                      <Pressable style={styles.feedAction} onPress={() => handleFeedShare(run)}>
                        <LucideIcon name="share" size={16} color={COLORS.textLight} />
                        <Text style={styles.feedActionText}>Share</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </FadeSlideIn>

        <View style={{ height: 32 }} />
      </ScrollView>
      <AiCoachFab />
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20, paddingTop: 12 },

  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 22,
  },
  greetingRow: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  greetingAccent: { width: 4, height: 40, borderRadius: 999, backgroundColor: COLORS.primary, marginRight: 11 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 9, marginLeft: 12 },
  notificationButton: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  notificationDot: { position: "absolute", top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: COLORS.surface },
  greeting:   { fontSize: 22, fontWeight: "700", color: COLORS.textDark, letterSpacing: -0.5 },
  subtitle:   { fontSize: 14, color: COLORS.textLight, marginTop: 3 },
  avatar: { overflow: "hidden",
    width: 44, height: 44, borderRadius: 16,
    justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 18 },

  heroCard: {
    borderRadius: 16, padding: 20, marginBottom: 22,
    flexDirection: "row", alignItems: "center", overflow: "hidden",
    boxShadow: "0px 6px 16px rgba(73, 34, 91, 0.18)",
  },
  heroDecorRing: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    borderWidth: 40, borderColor: "rgba(255,255,255,0.03)",
    right: -60, top: -60,
  },
  heroLeft:       { flex: 1, paddingRight: 12 },
  heroRight:      { alignItems: "center" },
  heroPctCircle: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 4, borderColor: "#22C55E",
    backgroundColor: "rgba(34,197,94,0.1)",
    justifyContent: "center", alignItems: "center",
  },
  heroPctNum:   { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  heroPctLabel: { fontSize: 11, color: "#22C55E", fontWeight: "700", marginTop: 2 },
  heroBadgeWrap: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(250,204,21,0.15)",
    borderWidth: 1, borderColor: "rgba(250,204,21,0.3)",
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: "flex-start", marginBottom: 10,
  },
  heroBadge:    { color: "#FACC15", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  heroTitle:    { fontSize: 14, color: "#B8AFD6", fontWeight: "600", marginBottom: 4 },
  heroBig:      { fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -1 },
  heroUnit:     { fontSize: 13, color: "#9186B0", marginTop: 2, marginBottom: 14 },
  heroBarBg:    { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: 8, overflow: "hidden" },
  heroBarFill:  { height: "100%", borderRadius: 3, backgroundColor: "#22C55E", maxWidth: "100%" },
  heroBarLabel: { fontSize: 12, color: "#B8AFD6" },

  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.3 },
  feedSubtitle: { marginTop: 3, fontSize: 11.5, color: COLORS.textLight },
  feedSection: { marginTop: 2, marginBottom: 20 },
  feedSeeAll: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 6 },
  feedSeeAllText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  feedLoading: { backgroundColor: COLORS.surface, borderRadius: 18, paddingVertical: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  feedEmpty: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  feedEmptyIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.primary + "18", alignItems: "center", justifyContent: "center" },
  feedEmptyTitle: { color: COLORS.textDark, fontSize: 13, fontWeight: "800" },
  feedEmptyText: { marginTop: 3, color: COLORS.textLight, fontSize: 11.5, lineHeight: 16 },
  feedCard: { backgroundColor: COLORS.surface, borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, padding: 13, marginBottom: 9 },
  feedMainRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  feedActions: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  feedAction: { flexDirection: "row", alignItems: "center", gap: 5, minHeight: 28 },
  feedActionText: { color: COLORS.textLight, fontSize: 10.5, fontWeight: "700" },
  feedAvatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: COLORS.primaryDark, alignItems: "center", justifyContent: "center" },
  feedAvatarText: { color: "#fff", fontSize: 15, fontWeight: "850" },
  feedName: { color: COLORS.textDark, fontSize: 13, fontWeight: "800" },
  feedActivity: { marginTop: 2, color: COLORS.textDark, fontSize: 11.5, fontWeight: "700" },
  feedMetrics: { marginTop: 3, color: COLORS.textLight, fontSize: 10.5, fontWeight: "600" },
  editBtn:      {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceMuted, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 7, minHeight: 30,
  },
  editBtnText:  { fontSize: 13, fontWeight: "700", color: COLORS.primary },

  statRow:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  statSquare: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 8, alignItems: "center",
    boxShadow: "0px 2px 10px rgba(23, 15, 54, 0.08)",
  },
  ringContainer: { marginBottom: 10 },
  squareValue:   { fontSize: 14, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.3 },
  squareLabel:   { fontSize: 11, marginTop: 2, fontWeight: "700" },

  logFoodCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, marginBottom: 14,
    overflow: "hidden",
    boxShadow: "0px 2px 10px rgba(23, 15, 54, 0.06)",
  },
  logFoodAccent: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
    backgroundColor: COLORS.accent,
  },
  logFoodIconWrap: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: COLORS.accent + "18",
    justifyContent: "center", alignItems: "center",
  },
  logFoodTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textDark },
  logFoodSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: "500" },

  competeCard: {
    borderRadius: 20, marginBottom: 14, overflow: "hidden",
    boxShadow: "0px 8px 22px rgba(48, 26, 92, 0.18)",
  },
  competeInner: { position: "relative", padding: 17, minHeight: 168 },
  competeGlowOne: {
    position: "absolute", width: 150, height: 150, borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.07)", right: -54, top: -70,
  },
  competeGlowTwo: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(236,72,153,0.12)", right: 30, bottom: -58,
  },
  competeTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  competeBadge: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.16)",
  },
  competeArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  competeEyebrow: { color: "rgba(255,255,255,0.68)", fontSize: 9.5, fontWeight: "800", letterSpacing: 1 },
  competeTitle: { fontSize: 17, fontWeight: "800", color: "#fff", marginTop: 2 },
  competeSub: { fontSize: 12, color: "rgba(255,255,255,0.78)", marginTop: 12, fontWeight: "600", lineHeight: 17 },
  competePills: { flexDirection: "row", gap: 7, marginTop: 12, flexWrap: "wrap" },
  competePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  competePillText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  competeCtaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 13 },
  competeCta: { color: "#fff", fontSize: 11.5, fontWeight: "800" },

  motivationCard: {
    minHeight: 172,
    borderRadius: 16,
    marginBottom: 22,
    overflow: "hidden",
    position: "relative",
    boxShadow: "0px 10px 26px rgba(23, 15, 54, 0.18)",
  },
  motivationScene: {
    ...StyleSheet.absoluteFillObject,
  },
  motivationAtmosphere: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.16)",
    transform: [{ scale: 1 }],
  },
  motivationGlow: {
    position: "absolute",
    width: 92,
    height: 250,
    top: -38,
    left: "36%",
    opacity: 0.85,
    borderRadius: 46,
    overflow: "hidden",
  },
  motivationScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(23, 15, 54, 0.18)",
  },
  motivationVignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: 16,
  },
  motivationContent: {
    minHeight: 172,
    padding: 18,
    justifyContent: "space-between",
  },
  motivationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  motivationIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    justifyContent: "center",
    alignItems: "center",
  },
  motivationLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.88)",
    letterSpacing: 1,
  },
  motivationQuote: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 27,
    maxWidth: "88%",
    letterSpacing: -0.3,
    marginTop: 8,
  },
  motivationHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
  },
  motivationHintText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.82)",
  },
});