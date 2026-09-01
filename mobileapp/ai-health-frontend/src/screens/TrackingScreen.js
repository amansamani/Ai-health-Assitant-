import { useState, useEffect, useCallback, useRef, useContext } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView,
  Platform, ScrollView, Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import API from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { COLORS } from "../constants/theme";
import {
  isHealthSyncAvailable,
  requestHealthSyncPermissions,
  fetchTodayFromDevice,
} from "../services/healthSync";
import { useActiveCalorieGoal } from "../hooks/useActiveCalorieGoal";
import { kcalFromMET, QUICK_ADD_ACTIVITIES } from "../utils/metCalories";
import CircularProgressRing from "../components/CircularProgressRing";

const { width } = Dimensions.get("window");

// ── Fade slide in ─────────────────────────────────────────────────────────────
function FadeSlideIn({ delay = 0, children }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 460, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 460, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ── Track Input Card ──────────────────────────────────────────────────────────
function TrackInputCard({ icon, label, unit, value, onChangeText, color, goal, placeholder, synced, onEditManually }) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const onBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1], outputRange: [COLORS.border, color],
  });

  const numVal   = parseFloat(value) || 0;
  const progress = Math.min(numVal / goal, 1);
  const pct      = Math.round(progress * 100);

  return (
    <Animated.View style={[styles.trackCard, { borderColor: synced ? color + "40" : borderColor }]}>
      <View style={[styles.trackAccent, { backgroundColor: color }]} />

      <View style={styles.trackCardInner}>
        <View style={[styles.trackIconWrap, { backgroundColor: color + "18" }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>

        <View style={styles.trackMid}>
          <View style={styles.trackLabelRow}>
            <Text style={styles.trackLabel}>{label}</Text>
            {synced && (
              <View style={[styles.syncedPill, { backgroundColor: color + "18" }]}>
                <Ionicons name="sync" size={9} color={color} />
                <Text style={[styles.syncedPillText, { color }]}>Synced</Text>
              </View>
            )}
          </View>
          {synced ? (
            <Text style={[styles.trackInput, { color }]}>{value || "0"}</Text>
          ) : (
            <TextInput
              style={[styles.trackInput, focused && { color }]}
              placeholder={placeholder}
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={value}
              onChangeText={onChangeText}
              onFocus={onFocus}
              onBlur={onBlur}
              accessibilityLabel={`${label}, in ${unit}`}
            />
          )}
        </View>

        <View style={styles.trackRight}>
          <Text style={[styles.trackUnit, { color }]}>{unit}</Text>
          {synced && onEditManually ? (
            <Pressable onPress={onEditManually} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Edit ${label} manually`}>
              <Text style={styles.trackEditLink}>Edit</Text>
            </Pressable>
          ) : (
            <Text style={styles.trackPct}>{pct}%</Text>
          )}
        </View>
      </View>

      <View style={styles.trackBarBg}>
        <Animated.View style={[
          styles.trackBarFill,
          { width: `${pct}%`, backgroundColor: color },
        ]} />
      </View>
    </Animated.View>
  );
}

// ── Log Stat Row ──────────────────────────────────────────────────────────────
function LogStat({ icon, label, value, color }) {
  return (
    <View style={styles.logStat}>
      <View style={[styles.logStatIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={styles.logStatText}>
        <Text style={styles.logStatLabel}>{label}</Text>
        <Text style={[styles.logStatValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

// ── Sync Status Banner ────────────────────────────────────────────────────────
function SyncStatusBanner({ status, lastSyncedAt, syncing, onRefresh, onRetry }) {
  if (status === "checking") return null;

  const timeLabel = lastSyncedAt
    ? lastSyncedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  if (status === "synced" || status === "partial") {
    return (
      <View style={styles.syncBanner}>
        <View style={styles.syncBannerLeft}>
          <View style={styles.syncDotWrap}>
            <Ionicons name="watch-outline" size={14} color="#22C55E" />
          </View>
          <Text style={styles.syncBannerText}>
            {status === "synced"
              ? `Synced from your device${timeLabel ? ` · ${timeLabel}` : ""}`
              : `Partially synced — fill in the rest below${timeLabel ? ` · ${timeLabel}` : ""}`}
          </Text>
        </View>
        <Pressable onPress={onRefresh} disabled={syncing} hitSlop={8} accessibilityRole="button" accessibilityLabel="Refresh from device">
          {syncing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="refresh" size={16} color={COLORS.primary} />}
        </Pressable>
      </View>
    );
  }

  if (status === "unavailable") {
    return (
      <View style={[styles.syncBanner, { backgroundColor: COLORS.surfaceMuted }]}>
        <View style={styles.syncBannerLeft}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
          <Text style={[styles.syncBannerText, { color: COLORS.textMuted }]}>
            Auto-sync isn't available on this device — enter your stats below.
          </Text>
        </View>
      </View>
    );
  }

  // denied / error
  return (
    <View style={[styles.syncBanner, { backgroundColor: COLORS.surfaceMuted }]}>
      <View style={styles.syncBannerLeft}>
        <Ionicons name="alert-circle-outline" size={16} color={COLORS.textMuted} />
        <Text style={[styles.syncBannerText, { color: COLORS.textMuted }]}>
          Device sync isn't connected — enter your stats below.
        </Text>
      </View>
      <Pressable onPress={onRetry} disabled={syncing} hitSlop={8} accessibilityRole="button" accessibilityLabel="Try device sync again">
        {syncing ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Text style={styles.syncRetryText}>Try again</Text>}
      </Pressable>
    </View>
  );
}


// ── Active Burn Card ──────────────────────────────────────────────────────────
// The hero treatment for calories — a ring against the personalized goal,
// a source badge for transparency (synced / estimated / manual), and
// quick-add presets for activities a phone/watch can't see on its own.
// The ring is always the primary visual regardless of where the number
// came from; tapping "Edit manually" reveals an inline input rather than
// swapping the whole card to a different layout.
function ActiveBurnCard({ value, goal, source, syncing, onQuickAdd, onManualChange, breakdown, onStartRun }) {
  const [editing, setEditing] = useState(false);
  const numVal = parseFloat(value) || 0;
  const progress = Math.min(numVal / goal, 1);

  const exerciseKcal = Math.round(breakdown?.exercise || 0);
  const stepsKcal = Math.round(breakdown?.steps || 0);
  const activityKcal = Math.round(breakdown?.activity || 0);
  const badge =
    source === "mixed" || (source === "device" && (activityKcal > 0 || exerciseKcal > 0))
      ? { icon: "layers-outline", text: `Synced + activity ${Math.round(activityKcal + exerciseKcal)} kcal`, color: "#6339B8" }
      : source === "estimated"
      ? { icon: "flame-outline", text: "Estimated activity calories", color: "#F97316" }
      : source === "device"
      ? { icon: "watch-outline", text: "Synced from your device", color: "#22C55E" }
      : exerciseKcal > 0 && stepsKcal > 0
      ? { icon: "flame-outline", text: `Workout ${exerciseKcal} · Steps ${stepsKcal} kcal`, color: "#6339B8" }
      : exerciseKcal > 0
      ? { icon: "barbell-outline", text: `Workout ${exerciseKcal} kcal`, color: "#6339B8" }
      : stepsKcal > 0
      ? { icon: "walk-outline", text: `Steps ${stepsKcal} kcal`, color: "#F97316" }
      : activityKcal > 0
      ? { icon: "flame-outline", text: `Activity ${activityKcal} kcal`, color: "#F97316" }
      : { icon: "create-outline", text: "Logged manually", color: COLORS.textMuted };

  return (
    <View style={styles.burnCard}>
      <View style={styles.burnTop}>
        <View style={styles.burnRingWrap}>
          <CircularProgressRing
            size={104} strokeWidth={9}
            progress={progress} color="#F97316"
            valueText={value || "0"} label="kcal"
          />
        </View>

        <View style={styles.burnInfo}>
          <Text style={styles.burnTitle}>Active Burn</Text>
          <Text style={styles.burnGoal}>Goal: {goal.toLocaleString()} kcal · personalized</Text>

          <View style={[styles.burnBadge, { backgroundColor: badge.color + "18" }]}>
            {syncing
              ? <ActivityIndicator size="small" color={badge.color} />
              : <Ionicons name={badge.icon} size={11} color={badge.color} />}
            <Text style={[styles.burnBadgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>

          <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8} style={{ marginTop: 6 }} accessibilityRole="button" accessibilityLabel="Edit active burn manually">
            <Text style={styles.trackEditLink}>{editing ? "Done" : "Edit manually"}</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onStartRun}
        style={({ pressed }) => [styles.runCta, { opacity: pressed ? 0.92 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Start a run"
      >
        <View
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.runCtaGradient}
        >
          <View style={styles.runCtaIcon}>
            <Ionicons name="walk" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.runCtaCopy}>
            <Text style={styles.runCtaTitle}>Start a Run</Text>
            <Text style={styles.runCtaSub}>Track distance, pace & calories</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </View>
      </Pressable>

      {editing ? (
        <View style={styles.burnEditRow}>
          <TextInput
            style={styles.burnEditInput}
            keyboardType="numeric"
            placeholder="e.g. 320"
            placeholderTextColor={COLORS.textLight}
            value={value}
            onChangeText={onManualChange}
            autoFocus
            accessibilityLabel="Active burn, in kcal"
          />
          <Text style={styles.burnEditUnit}>kcal</Text>
        </View>
      ) : (
        <>
          {!!breakdown?.activityEntries?.length && (
            <View style={styles.activityHistory}>
              <Text style={styles.activityHistoryTitle}>TODAY'S ACTIVITIES</Text>
              {breakdown.activityEntries.slice().reverse().slice(0, 4).map((entry, index) => (
                <View key={`${entry.loggedAt || index}-${index}`} style={styles.activityHistoryRow}>
                  <View style={styles.activityHistoryIcon}>
                    <Ionicons name={entry.activityType === "swimming" ? "water-outline" : entry.activityType === "cycling" ? "bicycle-outline" : entry.activityType === "walk" ? "walk-outline" : "body-outline"} size={15} color="#F97316" />
                  </View>
                  <View style={styles.activityHistoryCopy}>
                    <Text style={styles.activityHistoryName}>{entry.label}</Text>
                    <Text style={styles.activityHistoryMeta}>{entry.minutes} min · estimated</Text>
                  </View>
                  <Text style={styles.activityHistoryKcal}>+{Math.round(entry.calories || 0)} kcal</Text>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.burnQuickAddLabel}>LOG AN ACTIVITY</Text>
          <View style={styles.quickAddRow}>
            {QUICK_ADD_ACTIVITIES.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => onQuickAdd(a)}
                style={({ pressed }) => [styles.quickAddChip, { opacity: pressed ? 0.72 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`Log ${a.label}`}
              >
                <Ionicons name={a.icon} size={16} color="#F97316" />
                <Text style={styles.quickAddText}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const STEP_GOAL  = 10000;
const WATER_GOAL = 3;
const SLEEP_GOAL = 8;

export default function TrackingScreen() {
  const router = useRouter();
  const { token } = useContext(AuthContext);
  const { activeCalorieGoal, weightKg } = useActiveCalorieGoal();
  const [steps, setSteps]       = useState("");
  const [water, setWater]       = useState(""); // manual-only — see note below
  const [sleep, setSleep]       = useState("");
  const [calories, setCalories] = useState("");
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [todayLog, setTodayLog] = useState(null);

  // Device sync state. `deviceFields` tracks which of steps/sleep/calories
  // are currently populated from Health Connect / HealthKit (and therefore
  // rendered read-only). Water is intentionally never part of this — almost
  // no wearable logs hydration automatically, so it's always a plain manual
  // field, kept in its own section below.
  const [syncStatus, setSyncStatus]   = useState("checking"); // checking | synced | partial | denied | unavailable
  const [syncing, setSyncing]         = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [deviceFields, setDeviceFields] = useState({ steps: false, sleep: false, calories: false });
  // Calorie source, for the Active Burn card's transparency badge —
  // "device" (Tier 1, real sensor data), "estimated" (Tier 2, derived from
  // steps or a completed workout), or null (Tier 3 / not yet logged today).
  const [caloriesSource, setCaloriesSource] = useState(null);
  const [calorieBreakdown, setCalorieBreakdown] = useState({ steps: 0, exercise: 0, activity: 0, manual: 0, activityEntries: [] });

  const btnScale = useRef(new Animated.Value(1)).current;
  const onBtnIn  = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const onBtnOut = () => Animated.spring(btnScale, { toValue: 1,    useNativeDriver: true }).start();

  const fetchToday = useCallback(async () => {
    try {
      const res = await API.get("/track/today");
      if (res.data) {
        setTodayLog(res.data);
        setSteps(res.data.steps?.toString() || "");
        setWater(res.data.water?.toString() || "");
        setSleep(res.data.sleep?.toString() || "");
        setCalories(res.data.caloriesBurned?.toString() || "");
        setCalorieBreakdown({
          steps: Number(res.data.stepsCaloriesBurned || 0),
          exercise: Number(res.data.exerciseCaloriesBurned || 0),
          activity: Number(res.data.activityCaloriesBurned || 0),
          manual: Number(res.data.manualCaloriesBurned || 0),
          activityEntries: Array.isArray(res.data.activityEntries) ? res.data.activityEntries : [],
        });
        // Whole-document source is a simplification (one field covers all
        // metrics), but it's a reasonable stand-in for the Active Burn
        // badge until device sync (below) sets something more precise.
        if (res.data.caloriesBurned) {
          const nextBreakdown = {
            steps: Number(res.data.stepsCaloriesBurned || 0),
            exercise: Number(res.data.exerciseCaloriesBurned || 0),
            activity: Number(res.data.activityCaloriesBurned || 0),
            manual: Number(res.data.manualCaloriesBurned || 0),
            activityEntries: Array.isArray(res.data.activityEntries) ? res.data.activityEntries : [],
          };
          setCalorieBreakdown(nextBreakdown);
          setCaloriesSource(
            res.data.source === "device"
              ? "device"
              : nextBreakdown.exercise > 0 && nextBreakdown.steps === 0 && nextBreakdown.activity === 0
              ? "exercise"
              : nextBreakdown.steps > 0 && nextBreakdown.exercise === 0 && nextBreakdown.activity === 0
              ? "steps"
              : res.data.source ?? "manual"
          );
        }
      }
    } catch {
      console.log("No tracking data for today");
    } finally {
      setLoading(false);
    }
  }, []);

  // Try Health Connect / HealthKit, fill in whichever of steps/sleep/calories
  // it can give us, and silently push those straight to the backend so
  // Home reflects them without the user touching Save. Water is never part
  // of this — see the note by the state declarations above.
  //
  // Calories specifically has a Tier 1 → Tier 2 fallback baked into
  // fetchTodayFromDevice: if the device gives steps but no direct calorie
  // reading, it estimates walking calories from steps + weight instead of
  // leaving the ring empty (see healthSync.js).
  const runDeviceSync = useCallback(async () => {
    setSyncing(true);
    try {
      const available = await isHealthSyncAvailable();
      if (!available) {
        setSyncStatus("unavailable");
        return;
      }

      const perms = await requestHealthSyncPermissions();
      if (perms.unavailable || (!perms.steps && !perms.sleep && !perms.calories)) {
        setSyncStatus("denied");
        return;
      }

      const device = await fetchTodayFromDevice(weightKg);
      const nextDeviceFields = { steps: false, sleep: false, calories: false };
      const toSave = {};

      if (device.steps != null) {
        setSteps(String(device.steps));
        nextDeviceFields.steps = true;
        toSave.steps = device.steps;
      }
      if (device.sleepHours != null) {
        setSleep(String(device.sleepHours));
        nextDeviceFields.sleep = true;
        toSave.sleep = device.sleepHours;
      }
      if (device.caloriesBurned != null) {
        setCalories(String(device.caloriesBurned));
        nextDeviceFields.calories = true;
        toSave.caloriesBurned = device.caloriesBurned;
        setCaloriesSource(device.caloriesEstimated ? "estimated" : "device");
      }

      setDeviceFields(nextDeviceFields);
      const gotAny = nextDeviceFields.steps || nextDeviceFields.sleep || nextDeviceFields.calories;
      const gotAll = nextDeviceFields.steps && nextDeviceFields.sleep && nextDeviceFields.calories;

      if (!gotAny) {
        setSyncStatus("denied");
        return;
      }

      setSyncStatus(gotAll ? "synced" : "partial");
      setLastSyncedAt(new Date());

      // Push the device-derived fields straight to the backend so Home /
      // Weekly Summary pick them up immediately, without waiting for a
      // manual Save tap. Steps/sleep are real Tier 1 reads whenever either
      // is present, so the doc-level source is "device" even if calories
      // itself was a Tier 2 estimate — falls back to "estimated" only when
      // calories is the *only* thing that synced.
      const overallSource = (nextDeviceFields.steps || nextDeviceFields.sleep) ? "device" : "estimated";
      try {
        const res = await API.post("/track/today", {
          ...toSave,
          source: overallSource,
          caloriesSource: device.caloriesBurned != null
            ? (device.caloriesEstimated ? "estimated" : "device")
            : undefined,
        });
        setTodayLog(res.data);
        setCaloriesSource(res.data?.caloriesSource || (device.caloriesEstimated ? "estimated" : overallSource));
        setCalorieBreakdown({
          steps: Number(res.data?.stepsCaloriesBurned || 0),
          exercise: Number(res.data?.exerciseCaloriesBurned || 0),
          activity: Number(res.data?.activityCaloriesBurned || 0),
          manual: Number(res.data?.manualCaloriesBurned || 0),
          activityEntries: Array.isArray(res.data?.activityEntries) ? res.data.activityEntries : [],
        });
      } catch (err) {
        console.log("Auto-sync save failed:", err.response?.data?.message || err.message);
      }
    } finally {
      setSyncing(false);
    }
  }, [weightKg]);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      setLoading(true);
      fetchToday().then(runDeviceSync);
    }, [token, fetchToday, runDeviceSync])
  );

  // Let the user drop a device-synced field back to manual entry (e.g. the
  // watch's step count looks wrong today) without losing the other synced
  // fields.
  const editManually = (field) => {
    setDeviceFields((prev) => ({ ...prev, [field]: false }));
  };

  // Active Burn card: typing a value directly always means "manual" now.
  const handleCaloriesManualChange = (text) => {
    setCalories(text);
    setCaloriesSource("manual");
  };

  // Tier 3: quick-add presets for activities a phone/watch can't see on
  // its own (swimming, most cycling, off-body yoga). Adds on top of
  // whatever's already logged today rather than overwriting it.
  const handleQuickAdd = async (activity) => {
    const added = kcalFromMET(activity.met, weightKg, activity.minutes);
    Alert.alert(
      `Log ${activity.label}?`,
      `${activity.minutes} min · estimated ${added} kcal.\n\nThis will be added to today's Active Burn.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Log ${activity.label}`,
          onPress: async () => {
            const next = Math.round((parseFloat(calories) || 0) + added);
            setCalories(String(next));
            setCaloriesSource("estimated");
            try {
              const res = await API.post("/track/today", {
                caloriesBurned: added,
                source: "manual",
                activityType: activity.key,
                activityLabel: activity.label,
                activityMinutes: activity.minutes,
                activityMet: activity.met,
              });
              setTodayLog(res.data);
              setCalories(String(res.data.caloriesBurned ?? next));
              setCalorieBreakdown({
                steps: Number(res.data.stepsCaloriesBurned || 0),
                exercise: Number(res.data.exerciseCaloriesBurned || 0),
                activity: Number(res.data.activityCaloriesBurned || 0),
                manual: Number(res.data.manualCaloriesBurned || 0),
                activityEntries: Array.isArray(res.data.activityEntries) ? res.data.activityEntries : [],
              });
            } catch (err) {
              setCalories((parseFloat(calories) || 0).toString());
              console.log("Quick-add save failed:", err.response?.data?.message || err.message);
            }
          },
        },
      ]
    );
  };

  const saveToday = async () => {
    setErrorMsg("");
    try {
      setSaving(true);
      const payload = {
        steps: Number(steps),
        water: Number(water),
        sleep: Number(sleep),
        source: "manual",
      };

      // Persist an explicitly edited Active Burn value as well. The backend
      // stores this as a headline override so later device sync cannot
      // silently replace the user's manual value.
      if (caloriesSource === "manual" && calories.trim() !== "") {
        payload.caloriesBurned = Math.max(0, Number(calories) || 0);
      }
      const res = await API.post("/track/today", payload);
      setSaved(true);
      setTodayLog(res.data);
      setCalories(String(res.data?.caloriesBurned ?? calories ?? "0"));
      setCalorieBreakdown({
        steps: Number(res.data?.stepsCaloriesBurned || 0),
        exercise: Number(res.data?.exerciseCaloriesBurned || 0),
        activity: Number(res.data?.activityCaloriesBurned || 0),
        manual: Number(res.data?.manualCaloriesBurned || 0),
        activityEntries: Array.isArray(res.data?.activityEntries) ? res.data.activityEntries : [],
      });
      setCaloriesSource(
        Number(res.data?.exerciseCaloriesBurned || 0) > 0 && Number(res.data?.stepsCaloriesBurned || 0) === 0
          ? "exercise"
          : Number(res.data?.stepsCaloriesBurned || 0) > 0 && Number(res.data?.exerciseCaloriesBurned || 0) === 0
          ? "steps"
          : res.data?.source || "manual"
      );
      setTimeout(() => setSaved(false), 2500);
      router.push({
        pathname: "/(app)/(tabs)/home",
        params: { updatedToday: JSON.stringify(payload) },
      });
    } catch (err) {
      const backendMsg = err.response?.data?.message;
      setErrorMsg(backendMsg || "Failed to save data. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading today's data…</Text>
      </View>
    );
  }

  // Overall progress — steps, calories, and sleep are the primary (usually
  // device-synced) trio. Water is tracked separately below and doesn't
  // factor into this badge, since it's manual-only for most people.
  const totalPct = Math.round(
    ((Math.min(parseFloat(steps) || 0, STEP_GOAL) / STEP_GOAL +
      Math.min(parseFloat(calories) || 0, activeCalorieGoal) / activeCalorieGoal +
      Math.min(parseFloat(sleep) || 0, SLEEP_GOAL) / SLEEP_GOAL) / 3) * 100
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── HEADER ── */}
          <FadeSlideIn delay={0}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Daily Tracking</Text>
                <Text style={styles.subtitle}>Log your activity for today</Text>
              </View>
              <View style={styles.overallBadge}>
                <Text style={styles.overallNum}>{totalPct}%</Text>
                <Text style={styles.overallLabel}>Overall</Text>
              </View>
            </View>
          </FadeSlideIn>

          {/* ── HERO PROGRESS ── */}
          <FadeSlideIn delay={80}>
            <View style={[styles.heroCard, { backgroundColor: COLORS.primaryDark }]}>
              <View style={styles.heroDecor} />
              <View style={styles.heroBadgeRow}>
                <Ionicons name="calendar-outline" size={12} color="#FACC15" />
                <Text style={styles.heroBadge}>TODAY</Text>
              </View>
              <View style={styles.heroTitleRow}>
                {totalPct === 100 && <Ionicons name="sparkles" size={16} color="#fff" style={{ marginRight: 6 }} />}
                <Text style={styles.heroTitle}>
                  {totalPct === 100 ? "All goals complete!" : `${totalPct}% of daily goals done`}
                </Text>
              </View>
              <View style={styles.heroBarBg}>
                <View style={[styles.heroBarFill, { width: `${totalPct}%` }]} />
              </View>
              <View style={styles.heroStats}>
                <View style={styles.heroStatItem}>
                  <Ionicons name="footsteps-outline" size={13} color="#B8AFD6" />
                  <Text style={styles.heroStat}>{steps || "0"} steps</Text>
                </View>
                <View style={styles.heroStatItem}>
                  <Ionicons name="flame-outline" size={13} color="#B8AFD6" />
                  <Text style={styles.heroStat}>{calories || "0"} kcal</Text>
                </View>
                <View style={styles.heroStatItem}>
                  <Ionicons name="moon-outline" size={13} color="#B8AFD6" />
                  <Text style={styles.heroStat}>{sleep || "0"}h</Text>
                </View>
              </View>
            </View>
          </FadeSlideIn>

          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color={COLORS.error} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* ── SYNC STATUS ── */}
          <FadeSlideIn delay={120}>
            <SyncStatusBanner
              status={syncStatus}
              lastSyncedAt={lastSyncedAt}
              syncing={syncing}
              onRefresh={runDeviceSync}
              onRetry={runDeviceSync}
            />
          </FadeSlideIn>

          {/* ── ACTIVE BURN (hero) ── */}
          <FadeSlideIn delay={160}>
            <Text style={styles.sectionLabel}>ACTIVE BURN</Text>
            <ActiveBurnCard
              value={calories}
              goal={activeCalorieGoal}
              source={caloriesSource}
              syncing={syncing}
              onQuickAdd={handleQuickAdd}
              onManualChange={handleCaloriesManualChange}
              breakdown={calorieBreakdown}
              onStartRun={() => router.push("/run-tracking")}
            />
          </FadeSlideIn>

          {/* ── INPUT CARDS ── */}
          <FadeSlideIn delay={220}>
            <Text style={styles.sectionLabel}>UPDATE TODAY'S DATA</Text>
            <TrackInputCard
              icon="footsteps-outline" label="Steps" unit="steps"
              placeholder="e.g. 8000" value={steps}
              onChangeText={setSteps} color="#22C55E" goal={STEP_GOAL}
              synced={deviceFields.steps} onEditManually={() => editManually("steps")}
            />
          </FadeSlideIn>

          <FadeSlideIn delay={280}>
            <TrackInputCard
              icon="moon-outline" label="Sleep" unit="hours"
              placeholder="e.g. 7.5" value={sleep}
              onChangeText={setSleep} color={COLORS.primary} goal={SLEEP_GOAL}
              synced={deviceFields.sleep} onEditManually={() => editManually("sleep")}
            />
          </FadeSlideIn>

          {/* ── HYDRATION (always manual — no sensor tracks this) ── */}
          <FadeSlideIn delay={320}>
            <Text style={styles.sectionLabel}>HYDRATION · LOGGED MANUALLY</Text>
            <TrackInputCard
              icon="water-outline" label="Water" unit="litres"
              placeholder="e.g. 2.5" value={water}
              onChangeText={setWater} color="#3B82F6" goal={WATER_GOAL}
            />
          </FadeSlideIn>

          {/* ── SAVE BUTTON ── */}
          <FadeSlideIn delay={340}>
            <Pressable onPress={saveToday} onPressIn={onBtnIn}
              onPressOut={onBtnOut} disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving, busy: saving }}
              accessibilityLabel="Save today's data">
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <View style={[styles.saveBtn, { backgroundColor: saved ? COLORS.success : saving ? COLORS.textLight : COLORS.primaryDark }]}>
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : (
                      <View style={styles.saveBtnRow}>
                        <Ionicons name={saved ? "checkmark" : "save-outline"} size={18} color="#fff" />
                        <Text style={styles.saveBtnText}>{saved ? "Saved!" : "Save Today's Data"}</Text>
                      </View>
                    )
                  }
                </View>
              </Animated.View>
            </Pressable>
          </FadeSlideIn>

          {/* ── TODAY'S LOG ── */}
          {todayLog && (
            <FadeSlideIn delay={400}>
              <View style={styles.logCard}>
                <View style={styles.logHeader}>
                  <Text style={styles.logTitle}>Today's Log</Text>
                  <View style={styles.logDot} />
                </View>
                <View style={styles.logRow}>
                  <LogStat icon="footsteps-outline" label="Steps" value={`${todayLog.steps?.toLocaleString() ?? 0}`} color="#22C55E" />
                  <LogStat icon="flame-outline" label="Calories" value={`${todayLog.caloriesBurned ?? 0} kcal`} color="#F97316" />
                  <LogStat icon="moon-outline" label="Sleep" value={`${todayLog.sleep ?? 0} hrs`} color={COLORS.primary} />
                </View>
                <View style={styles.logDivider} />
                <View style={styles.logRow}>
                  <LogStat icon="water-outline" label="Water" value={`${todayLog.water ?? 0} L`} color="#3B82F6" />
                </View>
              </View>
            </FadeSlideIn>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background },
  scroll:      { padding: 20, paddingTop: 10 },
  center:      { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14, fontWeight: "500" },

  // Header
  headerRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 20,
  },
  title:    { fontSize: 26, fontWeight: "800", color: COLORS.textDark, letterSpacing: -0.6 },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 3, fontWeight: "500" },
  overallBadge: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 10,
    alignItems: "center",
    boxShadow: "0px 2px 10px rgba(23,15,54,0.08)",
  },
  overallNum:   { fontSize: 20, fontWeight: "800", color: COLORS.primary, letterSpacing: -0.5 },
  overallLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: "700", textTransform: "uppercase" },

  // Hero
  heroCard: {
    borderRadius: 16, padding: 20,
    marginBottom: 16, overflow: "hidden",
    boxShadow: "0px 6px 20px rgba(23,15,54,0.3)",
  },
  heroDecor: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    borderWidth: 40, borderColor: "rgba(255,255,255,0.03)",
    right: -50, top: -50,
  },
  heroBadgeRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  heroBadge: { color: "#FACC15", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  heroTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  heroTitle: { fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  heroBarBg: {
    height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 14, overflow: "hidden",
  },
  heroBarFill: { height: "100%", borderRadius: 3, backgroundColor: COLORS.primaryLight, maxWidth: "100%" },
  heroStats:     { flexDirection: "row", gap: 16 },
  heroStatItem:  { flexDirection: "row", alignItems: "center", gap: 5 },
  heroStat:      { fontSize: 13, color: "#B8AFD6", fontWeight: "600" },

  // Error banner
  errorBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.errorBg, borderWidth: 1, borderColor: COLORS.errorBorder,
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errorText: { color: COLORS.error, fontSize: 13, fontWeight: "600", flex: 1 },

  // Sync status banner
  syncBanner: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#22C55E14", borderRadius: 12, padding: 12, marginBottom: 16,
    gap: 10,
  },
  syncBannerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  syncDotWrap: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#22C55E20", alignItems: "center", justifyContent: "center" },
  syncBannerText: { fontSize: 12.5, fontWeight: "600", color: COLORS.textDark, flex: 1 },
  syncRetryText: { fontSize: 12.5, fontWeight: "800", color: COLORS.primary },

  // Section label
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: COLORS.textLight,
    letterSpacing: 1.2, marginBottom: 10,
  },

  // Track input card
  trackCard: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    marginBottom: 12, overflow: "hidden",
    borderWidth: 1.5,
    boxShadow: "0px 2px 10px rgba(23,15,54,0.07)",
  },
  trackAccent:    { height: 3 },
  trackCardInner: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  trackIconWrap:  {
    width: 46, height: 46, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  trackMid:   { flex: 1 },
  trackLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  trackLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  syncedPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  syncedPillText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  trackEditLink: { fontSize: 11, color: COLORS.textMuted, fontWeight: "700", textDecorationLine: "underline" },
  trackInput: {
    fontSize: 20, fontWeight: "800", color: COLORS.textDark,
    padding: 0, letterSpacing: -0.5,
  },
  trackRight: { alignItems: "flex-end" },
  trackUnit:  { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  trackPct:   { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  trackBarBg: {
    height: 4, backgroundColor: COLORS.surfaceMuted,
    marginHorizontal: 14, marginBottom: 12, borderRadius: 2, overflow: "hidden",
  },
  trackBarFill: { height: "100%", borderRadius: 2, maxWidth: "100%" },

  // Active Burn card
  burnCard: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: "#F9731630",
    boxShadow: "0px 2px 10px rgba(23,15,54,0.07)",
  },
  burnTop:      { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 14 },
  burnRingWrap: { alignItems: "center", justifyContent: "center" },
  burnInfo:     { flex: 1 },
  burnTitle:    { fontSize: 15, fontWeight: "800", color: COLORS.textDark, marginBottom: 2 },
  burnGoal:     { fontSize: 12, color: COLORS.textMuted, fontWeight: "500", marginBottom: 8 },
  burnBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "flex-start", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  burnBadgeText: { fontSize: 11, fontWeight: "700" },
  burnQuickAddLabel: {
    fontSize: 10, fontWeight: "800", color: COLORS.textLight,
    letterSpacing: 0.8, marginBottom: 10,
  },
  quickAddRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickAddChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#F973160F", borderWidth: 1, borderColor: "#F9731630",
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
  },
  quickAddText: { fontSize: 12.5, fontWeight: "700", color: "#F97316" },
  runCta: {
    marginTop: 4,
    marginBottom: 14,
    borderRadius: 16,
    overflow: "hidden",
  },
  runCtaGradient: {
    backgroundColor: COLORS.textDark,
    minHeight: 74,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  runCtaIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  runCtaCopy: { flex: 1 },
  runCtaTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  runCtaSub: { color: "#D7D7DB", fontSize: 11.5, fontWeight: "600", marginTop: 3 },

  activityHistory: { marginTop: 8, marginBottom: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  activityHistoryTitle: { fontSize: 10, fontWeight: "800", color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8 },
  activityHistoryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  activityHistoryIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#F9731618", alignItems: "center", justifyContent: "center", marginRight: 9 },
  activityHistoryCopy: { flex: 1 },
  activityHistoryName: { fontSize: 12.5, fontWeight: "800", color: COLORS.textDark },
  activityHistoryMeta: { marginTop: 2, fontSize: 10.5, color: COLORS.textMuted, fontWeight: "600" },
  activityHistoryKcal: { fontSize: 12, fontWeight: "800", color: "#F97316" },

  burnEditRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.surfaceMuted, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 4,
  },
  burnEditInput: {
    flex: 1, fontSize: 18, fontWeight: "800", color: COLORS.textDark,
    paddingVertical: 10,
  },
  burnEditUnit: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },

  // Save button
  saveBtn: {
    borderRadius: 16, paddingVertical: 17,
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
    boxShadow: "0px 6px 18px rgba(76,46,150,0.35)",
  },
  saveBtnRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.3 },

  // Log card
  logCard: {
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 18,
    boxShadow: "0px 2px 12px rgba(23,15,54,0.07)",
  },
  logHeader: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 16,
  },
  logTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textDark },
  logDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" },
  logRow:   { flexDirection: "row", justifyContent: "space-between" },
  logDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  logStat:  { flex: 1, alignItems: "center", gap: 8 },
  logStatIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
    marginBottom: 6,
  },
  logStatText:  { alignItems: "center" },
  logStatLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  logStatValue: { fontSize: 16, fontWeight: "800", marginTop: 2, letterSpacing: -0.3 },
});
