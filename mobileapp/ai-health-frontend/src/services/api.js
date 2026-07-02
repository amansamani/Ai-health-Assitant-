import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
const API_URL = process.env.EXPO_PUBLIC_API_URL;

let logoutHandler = null;
let cachedToken   = null;

export const setLogoutHandler = (handler) => {
  logoutHandler = handler;
};

export const setTokenCache = (token) => {
  cachedToken = token;
};

export const clearTokenCache = () => {
  cachedToken = null;
};

const isValidToken = (token) =>
  token && token !== "undefined" && token !== "null";

if (!API_URL && __DEV__) {
  console.warn(
    "⚠️ EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and set it, " +
    "then restart Expo (env vars are baked in at start, not hot-reloaded)."
  );
}

const API = axios.create({
  baseURL: API_URL || "http://localhost:5000/api",
  timeout: 15000,
});

// ── Request interceptor ───────────────────────────────────────────────────────
API.interceptors.request.use(
  async (config) => {
    try {
      let token = cachedToken;

      if (!isValidToken(token)) {
        token = await AsyncStorage.getItem("token");
        if (isValidToken(token)) {
          cachedToken = token;
        } else {
          cachedToken = null; // clear bad cached value
        }
      }

      if (isValidToken(token)) {
        config.headers.Authorization = `Bearer ${token}`;
      }

    } catch (err) {
      console.log("Token fetch error:", err.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ──────────────────────────────────────────────────────
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log("🔒 401 — logging out");
      cachedToken = null;
      if (logoutHandler) logoutHandler();
    }
    return Promise.reject(error);
  }
);

export default API;