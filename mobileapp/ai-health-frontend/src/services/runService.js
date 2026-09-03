import API from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_LIKES_KEY = "@fitlip/pending-run-likes";

async function readPendingLikes() {
  try {
    const raw = await AsyncStorage.getItem(PENDING_LIKES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writePendingLikes(pending) {
  try {
    if (!Object.keys(pending).length) {
      await AsyncStorage.removeItem(PENDING_LIKES_KEY);
      return;
    }
    await AsyncStorage.setItem(PENDING_LIKES_KEY, JSON.stringify(pending));
  } catch {
    // Local persistence is a resilience layer; the server remains authoritative.
  }
}

async function rememberPendingLike(runId, desiredLiked) {
  const pending = await readPendingLikes();
  pending[String(runId)] = Boolean(desiredLiked);
  await writePendingLikes(pending);
}

async function forgetPendingLike(runId) {
  const pending = await readPendingLikes();
  delete pending[String(runId)];
  await writePendingLikes(pending);
}

/**
 * Reconciles a small local queue of like intentions after an app restart.
 * This protects the user's tap if the app is killed/backgrounded before the
 * network request finishes. The server is always the source of truth.
 */
export const syncPendingRunLikes = async (runs = []) => {
  const pending = await readPendingLikes();
  const ids = Object.keys(pending);
  if (!ids.length) return runs;

  const nextRuns = Array.isArray(runs) ? runs.map((run) => ({ ...run })) : [];

  for (const runId of ids) {
    const desired = Boolean(pending[runId]);
    let serverLiked = null;
    let serverCount = null;

    const visibleRun = nextRuns.find((run) => String(run._id) === runId);
    if (visibleRun) {
      serverLiked = Boolean(visibleRun.likedByMe);
      serverCount = Number(visibleRun.likesCount);
    } else {
      try {
        const response = await API.get(`/runs/${encodeURIComponent(runId)}`);
        serverLiked = Boolean(response.data?.likedByMe);
        serverCount = Number(response.data?.likesCount);
      } catch {
        continue;
      }
    }

    if (serverLiked !== desired) {
      try {
        const response = await API.post(`/runs/${encodeURIComponent(runId)}/like`);
        serverLiked = Boolean(response.data?.liked);
        serverCount = Number(response.data?.likesCount);
      } catch {
        continue;
      }
    }

    const updatedCount = Number.isFinite(serverCount) ? serverCount : null;
    for (let i = 0; i < nextRuns.length; i += 1) {
      if (String(nextRuns[i]._id) !== runId) continue;
      nextRuns[i] = {
        ...nextRuns[i],
        likedByMe: serverLiked,
        ...(updatedCount !== null ? { likesCount: updatedCount } : {}),
      };
    }

    await forgetPendingLike(runId);
  }

  return nextRuns;
};

/**
 * Saves a completed GPS activity.
 */
export const saveRun = (payload) => API.post("/runs", payload).then((r) => r.data);

export const getMyRuns = (page = 1, limit = 20) =>
  API.get("/runs/me", { params: { page, limit } }).then((r) => r.data);

export const getRunFeed = (page = 1, limit = 20) =>
  API.get("/runs/feed", { params: { page, limit } }).then((r) => ({
    ...r.data,
    runs: (r.data?.runs || []).map((run) => ({
      ...run,
      likesCount: Number.isFinite(Number(run.likesCount))
        ? Number(run.likesCount)
        : Array.isArray(run.likes)
          ? run.likes.length
          : 0,
      likedByMe: Boolean(run.likedByMe),
    })),
  }));

export const getRunById = (id) => API.get(`/runs/${id}`).then((r) => r.data);

export const getUserRuns = (userId, page = 1, limit = 12) =>
  API.get(`/runs/user/${encodeURIComponent(userId)}`, { params: { page, limit } }).then((r) => ({
    ...r.data,
    runs: (r.data?.runs || []).map((run) => ({
      ...run,
      likesCount: Number.isFinite(Number(run.likesCount))
        ? Number(run.likesCount)
        : Array.isArray(run.likes)
          ? run.likes.length
          : 0,
      likedByMe: Boolean(run.likedByMe),
    })),
  }));

export const toggleRunLike = async (id, desiredLiked) => {
  if (desiredLiked !== undefined) {
    await rememberPendingLike(id, desiredLiked);
  }

  try {
    const response = await API.post(`/runs/${id}/like`);
    const data = response.data;
    await forgetPendingLike(id);
    return data;
  } catch (error) {
    // Keep the desired state on-device so a later app foreground/reload can
    // reconcile it with the server instead of silently losing the user's tap.
    throw error;
  }
};

export const deleteRun = (id) => API.delete(`/runs/${id}`).then((r) => r.data);
