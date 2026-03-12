import api from "./api";

// log meal
export const logMeal = async (mealData) => {
const response = await api.post("/nutrition/log-meal", mealData);
return response.data;
};

// get today's meal log
export const getTodayLog = async () => {
const response = await api.get("/nutrition/today-log");
return response.data;
};
