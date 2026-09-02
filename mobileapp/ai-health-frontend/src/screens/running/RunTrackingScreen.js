// Strava/Adidas-style run recorder.
//
// Native devices use expo-location's background task so recording continues
// while the screen is locked or another app is open. The task persists the
// active session in AsyncStorage, while this screen polls that session to keep
// the UI current. When background permission is declined, we gracefully fall
// back to foreground GPS and clearly tell the user that lock-screen tracking
// is unavailable.

import { useState, useRef, useEffect, useCallback } from "react";
import { showToast } from "../../services/uiFeedback";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Dimensions,
  AppState,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import LucideIcon from "../../components/ui/LucideIcon";
import * as Location from "expo-location";
import RunRouteMap from "../../components/RunRouteMap";
import ConfirmModal from "../../components/ui/ConfirmModal";

import { COLORS, SHADOW } from "../../constants/theme";
import { useActiveCalorieGoal } from "../../hooks/useActiveCalorieGoal";
import {
  createRunSession,
  getElapsedSeconds,
  loadRunSession,
  pauseRunSession,
  resumeRunSession,
  clearRunSession,
  setDraftRun,
  interruptRunSession,
  saveRunSession,
} from "../../services/runSessionStore";
import {
  isRunLocationTrackingStarted,
  recordLocationsForActiveRun,
  startRunLocationTracking,
  stopRunLocationTracking,
} from "../../services/runLocationTask";
import {
  formatDuration,
  formatDistanceKm,
  formatPace,
  paceSecPerKm,
  estimateActivityCalories,
} from "../../utils/runMath";

const { width } = Dimensions.get("window");

const ACTIVITIES = [
  { key: "run", label: "Run", icon: "walk" },
  { key: "walk", label: "Walk", icon: "footsteps-outline" },
  { key: "cycle", label: "Cycle", icon: "bicycle" },
];

function locationToPoint(loc) {
  if (!loc?.coords) return null;
  const { latitude, longitude, altitude, accuracy, speed } = loc.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    lat: latitude,
    lng: longitude,
    ts: Number(loc.timestamp) || Date.now(),
    alt: Number.isFinite(altitude) ? altitude : null,
    accuracy: Number.isFinite(accuracy) ? accuracy : null,
    speed: Number.isFinite(speed) ? speed : null,
  };
}

export default function RunTrackingScreen() {
  const router = useRouter();
  const { weightKg } = useActiveCalorieGoal();
  const mapRef = useRef(null);
  const foregroundWatchRef = useRef(null);
  const tickerRef = useRef(null);
  const hydratingRef = useRef(true);

  const [phase, setPhase] = useState("loading"); // loading | idle | running | paused | finishing
  const phaseRef = useRef("loading");
  const [activityType, setActivityType] = useState("run");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [backgroundTracking, setBackgroundTracking] = useState(false);
  const [wasInterrupted, setWasInterrupted] = useState(false);
  const [route, setRoute] = useState([]);
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentRegion, setCurrentRegion] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [backgroundConfirm, setBackgroundConfirm] = useState(false);
  const [shortRunConfirm, setShortRunConfirm] = useState(false);

  const applySession = useCallback((session) => {
    if (!session) return;
    routeRef.current = session.route || [];
    setRoute(routeRef.current);
    distanceRef.current = Number(session.distanceMeters || 0);
    setDistanceMeters(distanceRef.current);
    setElapsedSeconds(getElapsedSeconds(session));
    if (session.activityType) setActivityType(session.activityType);

    const last = session.lastPoint || routeRef.current[routeRef.current.length - 1];
    if (last) {
      const region = {
        latitude: last.lat,
        longitude: last.lng,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      };
      setCurrentRegion(region);
      mapRef.current?.animateCamera(
        { center: { latitude: last.lat, longitude: last.lng } },
        { duration: 350 }
      );
    }

    const nextPhase = session.status === "paused" ? "paused" : "running";
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const routeRef = useRef([]);
  const distanceRef = useRef(0);
  const startedAtRef = useRef(null);

  const stopForegroundWatcher = useCallback(() => {
    if (foregroundWatchRef.current) {
      foregroundWatchRef.current.remove();
      foregroundWatchRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const session = await loadRunSession();
      if (!mounted) return;
      hydratingRef.current = false;

      if (!session) {
        phaseRef.current = "idle";
        setPhase("idle");
        setMapReady(false);
        return;
      }

      startedAtRef.current = session.startedAt;
      applySession(session);

      const registered = await isRunLocationTrackingStarted();
      if (!registered && session.status === "running") {
        const recovered = await interruptRunSession(Date.now());
        if (mounted && recovered) {
          setWasInterrupted(true);
          applySession(recovered);
        }
      } else if (mounted) {
        setBackgroundTracking(registered);
      }
    })();

    return () => {
      mounted = false;
      stopForegroundWatcher();
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [applySession, stopForegroundWatcher]);

  // Background task writes the canonical session. Poll while foregrounded so
  // the map/stats immediately reflect points captured by the OS task.
  useEffect(() => {
    if (phase !== "running" && phase !== "paused") return undefined;

    const interval = setInterval(async () => {
      const session = await loadRunSession();
      if (phaseRef.current === "finishing" || !session) return;
      applySession(session);
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, applySession]);

  useEffect(() => {
    tickerRef.current && clearInterval(tickerRef.current);
    if (phase !== "running" && phase !== "paused") return undefined;

    tickerRef.current = setInterval(async () => {
      const session = await loadRunSession();
      if (session) setElapsedSeconds(getElapsedSeconds(session));
    }, 1000);

    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [phase]);

  const handleForegroundLocation = useCallback(async (loc) => {
    const point = locationToPoint(loc);
    if (!point) return;

    await recordLocationsForActiveRun([point]);
  }, []);

  const startForegroundFallback = useCallback(async () => {
    stopForegroundWatcher();
    foregroundWatchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 4,
      },
      handleForegroundLocation
    );
    setBackgroundTracking(false);
  }, [handleForegroundLocation, stopForegroundWatcher]);

  const requestPermissionsAndLocation = async () => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) {
      setPermissionDenied(true);
      return null;
    }
    setPermissionDenied(false);

    let bgGranted = false;
    try {
      const bg = await Location.requestBackgroundPermissionsAsync();
      bgGranted = bg.granted;
    } catch (error) {
      console.warn("Background location permission request failed:", error);
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
      mayShowUserSettingsDialog: true,
    });

    return { current, bgGranted };
  };

  const ensureTrackingMode = async (bgGranted) => {
    if (bgGranted) {
      await startRunLocationTracking();
      stopForegroundWatcher();
      setBackgroundTracking(true);
      return;
    }

    await startForegroundFallback();
    setBackgroundConfirm(true);
  };

  const handleStart = async () => {
    try {
      const result = await requestPermissionsAndLocation();
      if (!result) {
        showToast(
          "Fitlip needs precise location access to record your route.",
          { title: "Location permission needed", type: "warning", duration: 4000 }
        );
        return;
      }

      const firstPoint = locationToPoint(result.current);
      const startedAt = new Date().toISOString();
      const session = createRunSession({
        activityType,
        startedAt,
        firstPoint,
      });

      await saveRunSession(session);
      startedAtRef.current = startedAt;
      phaseRef.current = "running";
      setPhase("running");
      setMapReady(false);
      applySession(session);

      await ensureTrackingMode(result.bgGranted);
    } catch (error) {
      console.error("Failed to start run:", error);
      await clearRunSession();
      phaseRef.current = "idle";
      setPhase("idle");
      showToast(
        error?.message || "Please check Location Services and try again.",
        { title: "Couldn't start GPS", type: "error", duration: 4000 }
      );
    }
  };


  const handlePause = async () => {
    await stopRunLocationTracking();
    stopForegroundWatcher();
    await pauseRunSession(Date.now());
    phaseRef.current = "paused";
    setPhase("paused");
    setBackgroundTracking(false);
  };

  const handleResume = async () => {
    try {
      const session = await resumeRunSession(Date.now());
      if (!session) return;

      const fg = await Location.getForegroundPermissionsAsync();
      if (!fg.granted) {
        showToast("Enable location to resume this run.", { title: "Location permission needed", type: "warning" });
        return;
      }

      let bgGranted = false;
      try {
        const bg = await Location.getBackgroundPermissionsAsync();
        bgGranted = bg.granted;
      } catch {
        // Some web/test shims do not expose this method; foreground fallback
        // still works.
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      await handleForegroundLocation(current);

      await ensureTrackingMode(bgGranted);
      setWasInterrupted(false);
      phaseRef.current = "running";
      setPhase("running");
    } catch (error) {
      console.error("Failed to resume run:", error);
      await pauseRunSession(Date.now());
      phaseRef.current = "paused";
      setPhase("paused");
      showToast("Please make sure Location Services are enabled and try again.", { title: "Couldn't resume GPS", type: "error", duration: 4000 });
    }
  };

  const confirmDiscardShortRun = () => { setShortRunConfirm(false); handleDiscard(); };
  const openBackgroundSettings = () => { setBackgroundConfirm(false); Linking.openSettings().catch(() => {}); };

  const handleFinish = async () => {
    const session = await loadRunSession();
    if (!session) return;

    const finalElapsedSeconds = Math.round(getElapsedSeconds(session));
    const finalDistanceMeters = Number(session.distanceMeters || 0);

    if (finalDistanceMeters < 20 && finalElapsedSeconds < 30) {
      setShortRunConfirm(true);
      return;
    }

    await stopRunLocationTracking();
    stopForegroundWatcher();
    if (tickerRef.current) clearInterval(tickerRef.current);

    phaseRef.current = "finishing";
    setPhase("finishing");

    const calories = estimateActivityCalories({
      activityType: session.activityType,
      distanceMeters: finalDistanceMeters,
      durationSeconds: finalElapsedSeconds,
      weightKg,
    });

    setDraftRun({
      activityType: session.activityType,
      route: session.route || [],
      distanceMeters: finalDistanceMeters,
      durationSeconds: finalElapsedSeconds,
      caloriesBurned: calories,
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
      avgPaceSecPerKm: paceSecPerKm(finalDistanceMeters, finalElapsedSeconds),
    });

    await clearRunSession();
    router.replace("/run-summary");
  };

  const handleDiscard = async () => {
    await stopRunLocationTracking();
    stopForegroundWatcher();
    if (tickerRef.current) clearInterval(tickerRef.current);
    await clearRunSession();
    phaseRef.current = "finishing";
    setPhase("finishing");
    router.back();
  };

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextState) => {
      // A Strava-style recorder must NOT pause just because the UI went to the
      // background. The native location task keeps recording and persists the
      // route independently of this component's lifecycle.
      if (nextState !== "active") return;

      const session = await loadRunSession();
      if (!session || hydratingRef.current) return;

      const registered = await isRunLocationTrackingStarted();
      if (session.status === "running" && registered) {
        setBackgroundTracking(true);
        setWasInterrupted(false);
        applySession(session);
      } else if (session.status === "running") {
        // Background permission may have been declined. Recreate the native
        // foreground watcher when the app comes back into view.
        try {
          const fg = await Location.getForegroundPermissionsAsync();
          if (fg.granted) {
            await startForegroundFallback();
            setBackgroundTracking(false);
            applySession(session);
          } else {
            const recovered = await interruptRunSession(Date.now());
            setWasInterrupted(true);
            applySession(recovered || session);
          }
        } catch {
          const recovered = await interruptRunSession(Date.now());
          setWasInterrupted(true);
          applySession(recovered || session);
        }
      } else {
        applySession(session);
      }
    });

    return () => subscription.remove();
  }, [applySession]);

  const calories = estimateActivityCalories({
    activityType,
    distanceMeters,
    durationSeconds: elapsedSeconds,
    weightKg,
  });

  if (phase === "loading") {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.loadingText}>Restoring your run…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.mapWrap}>
        {currentRegion && mapReady ? (
          <RunRouteMap
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            route={route}
            initialRegion={currentRegion}
            showUserLocation
            showStartMarker
            showEndMarker={false}
            strokeWidth={5}
            onMapReady={() => setMapReady(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.mapFallback]}>
            <View style={styles.mapFallbackIcon}>
              <LucideIcon name="map" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.mapFallbackTitle}>
              {permissionDenied ? "Location access needed" : phase === "idle" ? "Ready to start" : "Preparing your route"}
            </Text>
            <Text style={styles.mapFallbackText}>
              {permissionDenied
                ? "Enable precise location access in Settings to track your route."
                : phase === "idle"
                ? "Choose an activity and tap Start to begin tracking."
                : "Your route map is loading. Your distance and time are still being recorded."}
            </Text>
            {currentRegion && !mapReady ? (
              <Pressable
                style={styles.mapRetryBtn}
                onPress={() => setMapReady(true)}
              >
                <Text style={styles.mapRetryText}>Show route</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <Pressable style={styles.closeBtn} onPress={handleDiscard}>
          <LucideIcon name="close" size={24} color={COLORS.textDark} />
        </Pressable>

        {phase === "idle" && (
          <View style={styles.activityPicker}>
            {ACTIVITIES.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => setActivityType(a.key)}
                style={[
                  styles.activityChip,
                  activityType === a.key && styles.activityChipActive,
                ]}
              >
                <LucideIcon
                  name={a.icon}
                  size={16}
                  color={activityType === a.key ? COLORS.onPrimary : COLORS.textDark}
                />
                <Text
                  style={[
                    styles.activityChipText,
                    activityType === a.key && styles.activityChipTextActive,
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {(phase === "running" || phase === "paused") && (
          <View style={styles.recordingBadge}>
            <View style={[styles.recordingDot, phase === "paused" && styles.recordingDotPaused]} />
            <Text style={styles.recordingText}>
              {phase === "paused"
                ? wasInterrupted
                  ? "Paused • tracking interrupted"
                  : "Paused"
                : backgroundTracking
                ? "GPS recording"
                : "GPS recording • foreground"}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.statsSheet}>
        <View style={styles.statsRow}>
          <Stat label="km" value={formatDistanceKm(distanceMeters)} big />
          <Stat label="time" value={formatDuration(elapsedSeconds)} big />
        </View>
        <View style={styles.statsRow}>
          <Stat
            label="pace /km"
            value={
              paceSecPerKm(distanceMeters, elapsedSeconds)
                ? formatPace(paceSecPerKm(distanceMeters, elapsedSeconds))
                : "Building…"
            }
          />
          <Stat label="kcal" value={String(calories)} />
        </View>

        <View style={styles.controls}>
          {phase === "idle" && (
            <Pressable style={[styles.controlBtn, styles.startBtn]} onPress={handleStart}>
              <LucideIcon name="play" size={26} color={COLORS.onPrimary} />
              <Text style={styles.controlBtnText}>Start</Text>
            </Pressable>
          )}

          {phase === "running" && (
            <>
              <Pressable style={[styles.controlBtn, styles.pauseBtn]} onPress={handlePause}>
                <LucideIcon name="pause" size={24} color={COLORS.textDark} />
              </Pressable>
              <Pressable style={[styles.controlBtn, styles.finishBtn]} onPress={handleFinish}>
                <LucideIcon name="stop" size={24} color={COLORS.onPrimary} />
                <Text style={styles.controlBtnText}>Finish</Text>
              </Pressable>
            </>
          )}

          {phase === "paused" && (
            <>
              <Pressable style={[styles.controlBtn, styles.startBtn]} onPress={handleResume}>
                <LucideIcon name="play" size={24} color={COLORS.onPrimary} />
                <Text style={styles.controlBtnText}>Resume</Text>
              </Pressable>
              <Pressable style={[styles.controlBtn, styles.finishBtn]} onPress={handleFinish}>
                <LucideIcon name="stop" size={24} color={COLORS.onPrimary} />
                <Text style={styles.controlBtnText}>Finish</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    <ConfirmModal visible={backgroundConfirm} title="Background tracking is off" message="FitLip can still record while the app is open. Allow background location in Settings to keep the run going when your phone is locked or you switch apps." confirmText="Open Settings" cancelText="Continue Here" icon="location-outline" onCancel={() => setBackgroundConfirm(false)} onConfirm={openBackgroundSettings} />
    <ConfirmModal visible={shortRunConfirm} title="Run too short" message="Track a bit more before finishing, or discard this run." confirmText="Discard" cancelText="Keep Going" tone="danger" icon="trash-outline" onCancel={() => setShortRunConfirm(false)} onConfirm={confirmDiscardShortRun} />
    </SafeAreaView>
  );
}

function Stat({ label, value, big }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, big && styles.statValueBig]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  loadingText: { color: COLORS.textDark, fontSize: 16, fontWeight: "600" },
  mapWrap: { flex: 1, backgroundColor: COLORS.primaryDark },
  mapFallback: { alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#F4F0F6" },
  mapFallbackIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: "#EEE6F2", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  mapFallbackTitle: { color: COLORS.textDark, textAlign: "center", fontSize: 17, fontWeight: "800" },
  mapFallbackText: { marginTop: 7, color: COLORS.textMuted, textAlign: "center", fontSize: 13, lineHeight: 19, maxWidth: 310 },
  mapRetryBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.primaryDark },
  mapRetryText: { color: COLORS.onPrimary, fontSize: 12, fontWeight: "800" },
  closeBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },
  activityPicker: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 4,
    ...SHADOW,
  },
  activityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  activityChipActive: { backgroundColor: COLORS.primary },
  activityChipText: { color: COLORS.textDark, fontWeight: "600", fontSize: 13 },
  activityChipTextActive: { color: COLORS.onPrimary },
  recordingBadge: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    ...SHADOW,
  },
  recordingDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.error },
  recordingDotPaused: { backgroundColor: COLORS.textLight },
  recordingText: { color: COLORS.textDark, fontWeight: "700", fontSize: 12 },
  statsSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    ...SHADOW,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 12 },
  statBox: { alignItems: "center", minWidth: width * 0.35 },
  statValue: { fontSize: 20, fontWeight: "700", color: COLORS.textDark },
  statValueBig: { fontSize: 34 },
  statLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  controls: { flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 12 },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 32,
  },
  startBtn: { backgroundColor: COLORS.primary },
  finishBtn: { backgroundColor: COLORS.error },
  pauseBtn: { backgroundColor: COLORS.surfaceMuted, paddingHorizontal: 20 },
  controlBtnText: { color: COLORS.onPrimary, fontWeight: "700", fontSize: 16 },
});
