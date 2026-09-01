import AsyncStorage from "@react-native-async-storage/async-storage";

export const ACTIVE_RUN_STORAGE_KEY = "fitlip.activeRun.v2";

let memorySession = null;
let draftRun = null;
let writeQueue = Promise.resolve();

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)));

function enqueueWrite(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

export function createRunSession({ activityType, startedAt, firstPoint = null }) {
  const session = {
    version: 2,
    status: "running",
    activityType,
    startedAt,
    pausedAt: null,
    totalPausedSeconds: 0,
    distanceMeters: 0,
    route: firstPoint ? [firstPoint] : [],
    lastPoint: firstPoint,
    lastUpdatedAt: Date.now(),
  };
  memorySession = session;
  return clone(session);
}

export async function loadRunSession() {
  try {
    // Always read the canonical persisted copy. Background location may run
    // in a separate JS context, so an in-memory value can legitimately be
    // older than AsyncStorage.
    const raw = await AsyncStorage.getItem(ACTIVE_RUN_STORAGE_KEY);
    memorySession = raw ? JSON.parse(raw) : null;
    return clone(memorySession);
  } catch (error) {
    console.error("Failed to load active run session:", error);
    return null;
  }
}

export async function saveRunSession(session) {
  if (!session) return clearRunSession();
  const normalized = {
    ...session,
    lastUpdatedAt: Date.now(),
  };
  memorySession = normalized;
  await enqueueWrite(() =>
    AsyncStorage.setItem(ACTIVE_RUN_STORAGE_KEY, JSON.stringify(normalized))
  );
  return clone(normalized);
}

export async function updateRunSession(mutator) {
  return enqueueWrite(async () => {
    // Read the persisted copy before every mutation so the UI context and the
    // headless/background task never mutate different stale snapshots.
    const raw = await AsyncStorage.getItem(ACTIVE_RUN_STORAGE_KEY);
    const current = raw ? JSON.parse(raw) : null;
    if (!current) return null;

    const next = typeof mutator === "function" ? mutator(clone(current)) : mutator;
    if (!next) return null;

    next.lastUpdatedAt = Date.now();
    memorySession = next;
    await AsyncStorage.setItem(ACTIVE_RUN_STORAGE_KEY, JSON.stringify(next));
    return clone(next);
  });
}

export async function clearRunSession() {
  memorySession = null;
  await enqueueWrite(() => AsyncStorage.removeItem(ACTIVE_RUN_STORAGE_KEY));
}

export function getElapsedSeconds(session, now = Date.now()) {
  if (!session?.startedAt) return 0;
  const started = new Date(session.startedAt).getTime();
  if (!Number.isFinite(started)) return 0;

  const end = session.status === "paused" && session.pausedAt
    ? new Date(session.pausedAt).getTime()
    : now;

  const wallSeconds = Math.max(0, (end - started) / 1000);
  return Math.max(0, wallSeconds - Number(session.totalPausedSeconds || 0));
}

export async function pauseRunSession(at = Date.now()) {
  return updateRunSession((session) => {
    if (session.status !== "running") return session;
    return {
      ...session,
      status: "paused",
      pausedAt: at,
      lastPoint: null,
    };
  });
}


export async function interruptRunSession(at = Date.now()) {
  return updateRunSession((session) => {
    if (session.status !== "running") return session;

    // If native tracking disappeared (for example after an OS process kill),
    // do not count the blind period as active exercise time. The last GPS
    // timestamp is the end of the last verified active segment.
    const lastPointTs = Number(session.lastPoint?.ts);
    const gapSeconds = Number.isFinite(lastPointTs)
      ? Math.max(0, (at - lastPointTs) / 1000)
      : 0;

    return {
      ...session,
      status: "paused",
      pausedAt: at,
      interrupted: true,
      totalPausedSeconds: Number(session.totalPausedSeconds || 0) + gapSeconds,
      lastPoint: null,
    };
  });
}

export async function resumeRunSession(at = Date.now()) {
  return updateRunSession((session) => {
    if (session.status !== "paused") return session;
    const pausedAt = session.pausedAt ? new Date(session.pausedAt).getTime() : at;
    const pausedSeconds = Math.max(0, (at - pausedAt) / 1000);
    return {
      ...session,
      status: "running",
      pausedAt: null,
      totalPausedSeconds: Number(session.totalPausedSeconds || 0) + pausedSeconds,
      // Important: the next GPS point becomes a fresh baseline. We never
      // measure across a pause gap.
      lastPoint: null,
    };
  });
}

export function setDraftRun(run) {
  draftRun = clone(run);
}

export function getDraftRun() {
  return clone(draftRun);
}

export function clearDraftRun() {
  draftRun = null;
}
