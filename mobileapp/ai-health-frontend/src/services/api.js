import axios from "axios";
import { getToken } from "../utils/secureToken";

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

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const API_URL = API_BASE_URL;

if (!API_URL && __DEV__) {
  console.warn(
    "⚠️ EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and set it, " +
    "then restart Expo (env vars are baked in at start, not hot-reloaded)."
  );
}

const API = axios.create({
  baseURL: API_URL || "http://localhost:5000/api",
  // 45s, not 15s — Render's free tier spins the backend down after idle,
  // and waking it back up (boot + reconnect to MongoDB) can take 30-60s.
  // 15s guaranteed a timeout on every cold-start request; this just tolerates
  // the wake-up instead of giving up right as the backend is booting.
  timeout: 45000,
});

API.interceptors.request.use(
  async (config) => {
    try {
      let token = cachedToken;

      if (!isValidToken(token)) {
        token = await getToken();
        if (isValidToken(token)) {
          cachedToken = token;
        } else {
          cachedToken = null;
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