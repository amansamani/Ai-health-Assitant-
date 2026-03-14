import api from "./api";

/*
────────────────────────────────────────
 Diet Plan
────────────────────────────────────────
*/

export const getCurrentPlan = async () => {
  try {
    const res = await api.get("/nutrition/current");
    return res.data;
  } catch (err) {
    console.log("Diet fetch error:", err?.response?.data || err.message);
    throw err;
  }
};

export const generatePlan = async () => {
  try {
    const res = await api.post("/nutrition/generate");
    return res.data;
  } catch (err) {
    console.log("Diet generation error:", err?.response?.data || err.message);
    throw err;
  }
};

/*
────────────────────────────────────────
 Meal Logging
────────────────────────────────────────
*/

export const logMeal = async (mealData) => {
  try {
    const res = await api.post("/nutrition/log-meal", mealData);
    return res.data;
  } catch (err) {
    console.log("Meal log error:", err?.response?.data || err.message);
    throw err;
  }
};

export const getTodayLog = async () => {
  try {
    const res = await api.get("/nutrition/today-log");
    return res.data;
  } catch (err) {
    console.log("Today log fetch error:", err?.response?.data || err.message);
    throw err;
  }
};

export const deleteMealLog = async (mealId) => {
  try {
    const res = await api.delete(`/nutrition/meal/${mealId}`);
    return res.data;
  } catch (err) {
    console.log("Delete meal error:", err?.response?.data || err.message);
    throw err;
  }
};

export const getMealHistory = async (days = 7) => {
  try {
    const res = await api.get(`/nutrition/history?days=${days}`);
    return res.data;
  } catch (err) {
    console.log("Meal history error:", err?.response?.data || err.message);
    throw err;
  }
};

/*
────────────────────────────────────────
 Health Profile
────────────────────────────────────────
*/

export const getHealthProfile = async () => {
  try {
    const res = await api.get("/health/profile");
    return res.data;
  } catch (err) {
    console.log("Profile fetch error:", err?.response?.data || err.message);
    throw err;
  }
};