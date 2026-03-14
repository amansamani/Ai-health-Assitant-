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

// ── Health Profile (for calorie goal) ─────────────────────────────────────────
export const getHealthProfile = async () => {
  const res = await api.get("/health");
  return res.data;
};