import api from "./api";

// ── Diet Plan ──────────────────────────────────────────────────────────────────
export const getCurrentPlan = async () => {
  const res = await api.get("/nutrition/current");
  return res.data;
};

export const generatePlan = async () => {
  const res = await api.post("/nutrition/generate");
  return res.data;
};

// ── Meal Logging ───────────────────────────────────────────────────────────────
export const logMeal = async (mealData) => {
  const res = await api.post("/nutrition/log-meal", mealData);
  return res.data;
};

export const getTodayLog = async () => {
  const res = await api.get("/nutrition/today-log");
  return res.data;
};

export const deleteMealLog = async (mealId) => {
  const res = await api.delete(`/nutrition/meal/${mealId}`);
  return res.data;
};

export const getMealHistory = async (days = 7) => {
  const res = await api.get(`/nutrition/history?days=${days}`);
  return res.data;
};

// ── Health Profile ─────────────────────────────────────────────────────────────
export const getHealthProfile = async () => {
  const res = await api.get("/health");
  return res.data;
};

// ── Food Search from MongoDB ───────────────────────────────────────────────────
// Hits: GET /api/nutrition/foods?search=<query>
// Returns the foods array from { success, count, data: [...] }
export const searchFoodsFromMongo = async (query) => {
  const res = await api.get(`/nutrition/foods?search=${encodeURIComponent(query)}`);
  return res.data.data; // ← .data.data because backend returns { success, count, data: [...] }
};

// ── Food Filter ────────────────────────────────────────────────────────────────
// Hits: GET /api/nutrition/foods?tags=high-protein,balanced&dietType=veg&match=any
export const searchFoodsByFilter = async ({ tags = [], dietType = null, match = "any" } = {}) => {
  const params = new URLSearchParams();
  if (tags.length > 0)  params.append("tags", tags.join(","));
  if (dietType)         params.append("dietType", dietType);
  if (match)            params.append("match", match);

  const res = await api.get(`/nutrition/foods?${params.toString()}`);
  return res.data.data; // ← same shape: { success, count, data: [...] }
};