import API from "./api";

/**
 * Saves a completed GPS activity.
 *
 * @param {object} payload
 * @param {"run"|"walk"|"cycle"} payload.activityType
 * @param {{lat:number,lng:number,ts:number,alt?:number}[]} payload.route
 * @param {number} payload.distanceMeters
 * @param {number} payload.durationSeconds
 * @param {number} payload.caloriesBurned
 * @param {string} payload.startedAt   ISO string
 * @param {string} payload.endedAt     ISO string
 * @param {string} [payload.caption]
 * @param {"public"|"followers"|"private"} [payload.visibility]
 * @param {string|null} [payload.photoBase64]
 */
export const saveRun = (payload) => API.post("/runs", payload).then((r) => r.data);

export const getMyRuns = (page = 1, limit = 20) =>
  API.get("/runs/me", { params: { page, limit } }).then((r) => r.data);

export const getRunFeed = (page = 1, limit = 20) =>
  API.get("/runs/feed", { params: { page, limit } }).then((r) => r.data);

export const getRunById = (id) => API.get(`/runs/${id}`).then((r) => r.data);

export const getUserRuns = (userId, page = 1, limit = 12) =>
  API.get(`/runs/user/${encodeURIComponent(userId)}`, { params: { page, limit } }).then((r) => r.data);

export const toggleRunLike = (id) =>
  API.post(`/runs/${id}/like`).then((r) => r.data);

export const deleteRun = (id) => API.delete(`/runs/${id}`).then((r) => r.data);
