// ─────────────────────────────────────────────────────────────────────────
// Live GPS activity tracker (run/walk/cycle) — Strava/Adidas-Running style.
//
// Requires two native modules that are NOT in package.json yet:
//   npx expo install expo-location react-native-maps
//
// Both ship native code, so after installing you need a fresh dev-client
// build (this will NOT work in plain Expo Go):
//   npx expo prebuild --clean   (if you don't already have /android /ios)
//   eas build --profile development --platform android
//
// Also add to app.json:
//   "plugins": ["expo-router", ["expo-location", {
//     "locationAlwaysAndWhenInUsePermission": "Allow Fitlip to track your run."
//   }]]
//
// LIMITATION (intentional for v1): this tracks in the FOREGROUND only —
// the run pauses if the OS backgrounds the app (e.g. screen lock on some
// Android OEMs). True lock-screen tracking needs expo-task-manager +
// Location.startLocationUpdatesAsync with the "always" permission, which
// is a bigger, harder-to-verify-without-a-device change — worth doing as
// a v2 once this flow is working end to end.
// ─────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Polyline, Marker } from "react-native-maps";

import { COLORS, SHADOW } from "../../constants/theme";
import { useActiveCalorieGoal } from "../../hooks/useActiveCalorieGoal";
import { setDraftRun } from "../../services/runSessionStore";
import {
  distanceDelta,
  formatDuration,
  formatDistanceKm,
  formatPace,
  paceSecPerKm,
  estimateActivityCalories,
} from "../../utils/runMath";

const { width, height } = Dimensions.get("window");

const ACTIVITIES = [
  { key: "run", label: "Run", icon: "walk" },
  { key: "walk", label: "Walk", icon: "footsteps-outline" },
  { key: "cycle", label: "Cycle", icon: "bicycle" },
];

export default function RunTrackingScreen() {
  const router = useRouter();
  const { weightKg } = useActiveCalorieGoal();
  const mapRef = useRef(null);

  const [phase, setPhase] = useState("idle"); // idle | running | paused | finishing
  const [activityType, setActivityType] = useState("run");
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [route, setRoute] = useState([]); // [{lat,lng,ts,alt}]
  const [distanceMeters, setDistanceMeters] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentRegion, setCurrentRegion] = useState(null);

  const watchSubscription = useRef(null);
  const tickInterval = useRef(null);
  const startedAtRef = useRef(null);
  const pausedAccumRef = useRef(0); // seconds spent paused, subtracted from wall clock
  const pausedAtRef = useRef(null);
  const lastPointRef = useRef(null);
  const routeRef = useRef([]);
  const distanceRef = useRef(0);

  useEffect(() => {
    return () => {
      stopWatching();
      if (tickInterval.current) clearInterval(tickInterval.current);
    };
  }, []);

  const stopWatching = () => {
    if (watchSubscription.current) {
      watchSubscription.current.remove();
      watchSubscription.current = null;
    }
  };

  const handlePosition = useCallback((loc) => {
    const point = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      ts: loc.timestamp,
      alt: loc.coords.altitude ?? null,
    };

    setCurrentRegion((prev) => ({
      latitude: point.lat,
      longitude: point.lng,
      latitudeDelta: prev?.latitudeDelta ?? 0.004,
      longitudeDelta: prev?.longitudeDelta ?? 0.004,
    }));

    mapRef.current?.animateCamera(
      { center: { latitude: point.lat, longitude: point.lng } },
      { duration: 500 }
    );

    const previous = lastPointRef.current;
    const delta = distanceDelta(previous, point);
    lastPointRef.current = point;

    if (!previous) {
      routeRef.current = [point];
      setRoute(routeRef.current);
      return;
    }

    routeRef.current = [...routeRef.current, point];
    setRoute(routeRef.current);

    if (delta > 0) {
      distanceRef.current += delta;
      setDistanceMeters(distanceRef.current);
    }
  }, []);

  const requestPermissionAndLocate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setPermissionDenied(true);
      return null;
    }
    setPermissionDenied(false);
    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
  };

  // Show the map centered on the user before they hit Start.
  useEffect(() => {
    if (phase !== "idle") return;
    requestPermissionAndLocate().then((loc) => {
      if (!loc) return;
      setCurrentRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      });
    });
  }, [phase]);

  const startTicker = () => {
    if (tickInterval.current) clearInterval(tickInterval.current);
    tickInterval.current = setInterval(() => {
      if (!startedAtRef.current) return;
      const wallSeconds = (Date.now() - startedAtRef.current) / 1000;
      setElapsedSeconds(Math.max(0, wallSeconds - pausedAccumRef.current));
    }, 1000);
  };

  const handleStart = async () => {
    const loc = await requestPermissionAndLocate();
    if (!loc) {
      Alert.alert(
        "Location permission needed",
        "Fitlip needs location access to track your route."
      );
      return;
    }

    startedAtRef.current = Date.now();
    pausedAccumRef.current = 0;
    lastPointRef.current = null;

    setRoute([]);
    setDistanceMeters(0);
    setElapsedSeconds(0);
    setPhase("running");
    startTicker();

    watchSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 4, // meters
      },
      handlePosition
    );
  };

  const handlePause = () => {
    stopWatching();
    pausedAtRef.current = Date.now();
    setPhase("paused");
  };

  const handleResume = async () => {
    if (pausedAtRef.current) {
      pausedAccumRef.current += (Date.now() - pausedAtRef.current) / 1000;
      pausedAtRef.current = null;
    }
    setPhase("running");
    watchSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 4,
      },
      handlePosition
    );
  };

  const handleFinish = () => {
    if (distanceMeters < 20 && elapsedSeconds < 30) {
      Alert.alert(
        "Run too short",
        "Track a bit more before finishing, or discard this run.",
        [
          { text: "Keep going", style: "cancel" },
          { text: "Discard", style: "destructive", onPress: handleDiscard },
        ]
      );
      return;
    }

    stopWatching();
    if (tickInterval.current) clearInterval(tickInterval.current);

    const durationSeconds = Math.round(elapsedSeconds);
    const calories = estimateActivityCalories({
      activityType,
      distanceMeters,
      durationSeconds,
      weightKg,
    });

    setDraftRun({
      activityType,
      route,
      distanceMeters,
      durationSeconds,
      caloriesBurned: calories,
      startedAt: new Date(startedAtRef.current).toISOString(),
      endedAt: new Date().toISOString(),
      avgPaceSecPerKm: paceSecPerKm(distanceMeters, durationSeconds),
    });

    router.replace("/run-summary");
  };

  const handleDiscard = () => {
    stopWatching();
    if (tickInterval.current) clearInterval(tickInterval.current);
    router.back();
  };

  const calories = estimateActivityCalories({
    activityType,
    distanceMeters,
    durationSeconds: elapsedSeconds,
    weightKg,
  });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.mapWrap}>
        {currentRegion ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={currentRegion}
            showsUserLocation
            showsMyLocationButton={false}
          >
            {route.length > 1 && (
              <Polyline
                coordinates={route.map((p) => ({
                  latitude: p.lat,
                  longitude: p.lng,
                }))}
                strokeColor={COLORS.primary}
                strokeWidth={5}
              />
            )}
            {route.length > 0 && (
              <Marker
                coordinate={{
                  latitude: route[0].lat,
                  longitude: route[0].lng,
                }}
                pinColor={COLORS.success}
                title="Start"
              />
            )}
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.mapFallback]}>
            <Text style={styles.mapFallbackText}>
              {permissionDenied
                ? "Location permission is off — enable it in Settings to track a run."
                : "Getting your location…"}
            </Text>
          </View>
        )}

        <Pressable style={styles.closeBtn} onPress={handleDiscard}>
          <Ionicons name="close" size={24} color={COLORS.textDark} />
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
                <Ionicons
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
      </View>

      <View style={styles.statsSheet}>
        <View style={styles.statsRow}>
          <Stat label="km" value={formatDistanceKm(distanceMeters)} big />
          <Stat label="time" value={formatDuration(elapsedSeconds)} big />
        </View>
        <View style={styles.statsRow}>
          <Stat
            label="pace /km"
            value={paceSecPerKm(distanceMeters, elapsedSeconds) ? formatPace(paceSecPerKm(distanceMeters, elapsedSeconds)) : "Building…"}
          />
          <Stat label="kcal" value={String(calories)} />
        </View>

        <View style={styles.controls}>
          {phase === "idle" && (
            <Pressable
              style={[styles.controlBtn, styles.startBtn]}
              onPress={handleStart}
            >
              <Ionicons name="play" size={26} color={COLORS.onPrimary} />
              <Text style={styles.controlBtnText}>Start</Text>
            </Pressable>
          )}

          {phase === "running" && (
            <>
              <Pressable
                style={[styles.controlBtn, styles.pauseBtn]}
                onPress={handlePause}
              >
                <Ionicons name="pause" size={24} color={COLORS.textDark} />
              </Pressable>
              <Pressable
                style={[styles.controlBtn, styles.finishBtn]}
                onPress={handleFinish}
              >
                <Ionicons name="stop" size={24} color={COLORS.onPrimary} />
                <Text style={styles.controlBtnText}>Finish</Text>
              </Pressable>
            </>
          )}

          {phase === "paused" && (
            <>
              <Pressable
                style={[styles.controlBtn, styles.startBtn]}
                onPress={handleResume}
              >
                <Ionicons name="play" size={24} color={COLORS.onPrimary} />
                <Text style={styles.controlBtnText}>Resume</Text>
              </Pressable>
              <Pressable
                style={[styles.controlBtn, styles.finishBtn]}
                onPress={handleFinish}
              >
                <Ionicons name="stop" size={24} color={COLORS.onPrimary} />
                <Text style={styles.controlBtnText}>Finish</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
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
  mapWrap: { flex: 1, backgroundColor: COLORS.surfaceMuted },
  mapFallback: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  mapFallbackText: {
    color: COLORS.textLight,
    textAlign: "center",
    fontSize: 15,
  },
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
    borderRadius: 24,
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
  statsSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    ...SHADOW,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  statBox: { alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700", color: COLORS.textDark },
  statValueBig: { fontSize: 34 },
  statLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
  },
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
