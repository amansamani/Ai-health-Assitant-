import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

let logoutHandler = null;

export const setLogoutHandler = (handler) => {
  logoutHandler = handler;
};

const API = axios.create({
  baseURL: "https://ai-health-assitant-production.up.railway.app/api",
});

API.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const url = err.config?.url ?? "";

    // Only logout on 401 for auth-critical routes.
    // Routes like /track/today, /user/profile, /log return 401
    // simply because no data exists yet for new users — do NOT logout for these.
    const safeRoutes = ["/track", "/user/profile", "/log", "/nutrition", "/health"];
    const isSafeRoute = safeRoutes.some((route) => url.includes(route));

    if (status === 401 && !isSafeRoute && logoutHandler) {
      console.log("🚨 401 on auth route, logging out:", url);
      logoutHandler();
    }

    return Promise.reject(err);
  }
);

export default API;