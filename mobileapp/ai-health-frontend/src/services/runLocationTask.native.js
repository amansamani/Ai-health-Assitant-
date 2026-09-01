import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { distanceDelta } from "../utils/runMath";
import {
  updateRunSession,
} from "./runSessionStore";

export const RUN_LOCATION_TASK_NAME = "fitlip-background-run-location";

const MAX_ROUTE_POINTS = 20000;

function normalizeLocation(location) {
  if (!location) return null;

  if (location.coords) {
    const { latitude, longitude, altitude, accuracy, speed } = location.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      lat: latitude,
      lng: longitude,
      ts: Number(location.timestamp) || Date.now(),
      alt: Number.isFinite(altitude) ? altitude : null,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      speed: Number.isFinite(speed) ? speed : null,
    };
  }

  if (Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
    return {
      lat: location.lat,
      lng: location.lng,
      ts: Number(location.ts) || Date.now(),
      alt: Number.isFinite(location.alt) ? location.alt : null,
      accuracy: Number.isFinite(location.accuracy) ? location.accuracy : null,
      speed: Number.isFinite(location.speed) ? location.speed : null,
    };
  }

  return null;
}

export async function recordLocationsForActiveRun(locations) {
  if (!Array.isArray(locations) || locations.length === 0) return;

  await updateRunSession((session) => {
    if (!session || session.status !== "running") return session;

    let route = Array.isArray(session.route) ? session.route : [];
    let lastPoint = session.lastPoint || null;
    let distanceMeters = Number(session.distanceMeters || 0);
    const speedLimit = session.activityType === "cycle" ? 35 : 12;

    const ordered = locations
      .map(normalizeLocation)
      .filter(Boolean)
      .sort((a, b) => a.ts - b.ts);

    for (const point of ordered) {
      // Consumer GPS can occasionally report very poor fixes. Keep the first
      // point to establish the route, but don't let a bad fix change distance.
      if (lastPoint && point.accuracy != null && point.accuracy > 50) continue;

      const delta = lastPoint
        ? distanceDelta(lastPoint, point, speedLimit)
        : 0;

      route = [...route, point];
      if (route.length > MAX_ROUTE_POINTS) {
        // Keep the newest points; the server also downsamples at save time.
        route = route.slice(route.length - MAX_ROUTE_POINTS);
      }

      if (delta > 0) distanceMeters += delta;
      lastPoint = point;
    }

    return {
      ...session,
      route,
      lastPoint,
      distanceMeters,
      lastUpdatedAt: Date.now(),
    };
  });
}

if (!TaskManager.isTaskDefined(RUN_LOCATION_TASK_NAME)) {
  TaskManager.defineTask(RUN_LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error("Fitlip background location error:", error);
      return;
    }

    const locations = data?.locations || [];
    await recordLocationsForActiveRun(locations);
  });
}

export async function isRunLocationTrackingStarted() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK_NAME);
  } catch {
    return false;
  }
}

export async function startRunLocationTracking() {
  if (await isRunLocationTrackingStarted()) return;

  await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 2000,
    distanceInterval: 4,
    deferredUpdatesInterval: 5000,
    deferredUpdatesDistance: 10,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Fitness,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Fitlip is recording your run",
      notificationBody: "GPS tracking is active. Tap to return to Fitlip.",
      notificationColor: "#29195A",
      killServiceOnDestroy: true,
    },
  });
}

export async function stopRunLocationTracking() {
  try {
    if (await isRunLocationTrackingStarted()) {
      await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK_NAME);
    }
  } catch (error) {
    console.warn("Failed to stop Fitlip background location:", error);
  }
}

