export const RUN_LOCATION_TASK_NAME = "fitlip-background-run-location";

export async function isRunLocationTrackingStarted() {
  return false;
}

export async function startRunLocationTracking() {
  throw new Error("GPS run tracking is only available on native devices.");
}

export async function stopRunLocationTracking() {}

export async function recordLocationsForActiveRun() {}
