import axios from "axios";
import { getToken, getRefreshToken, setToken, setRefreshToken, getDeviceId } from "../utils/secureToken";

let logoutHandler = null;
let accessTokenUpdatedHandler = null;
let cachedToken = null;
let refreshPromise = null;

export const setLogoutHandler = (handler) => { logoutHandler = handler; };
export const setAccessTokenUpdatedHandler = (handler) => { accessTokenUpdatedHandler = handler; };
export const setTokenCache = (token) => { cachedToken = token; };
export const clearTokenCache = () => { cachedToken = null; };

const isValidToken = (token) => token && token !== "undefined" && token !== "null";
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const API_URL = API_BASE_URL;

const API = axios.create({ baseURL: API_URL, timeout: 45000 });

API.interceptors.request.use(async (config) => {
  try {
    const deviceId = await getDeviceId();
    config.headers["X-Device-ID"] = deviceId;

    let token = cachedToken;
    if (!isValidToken(token)) {
      token = await getToken();
      if (isValidToken(token)) cachedToken = token;
      else cachedToken = null;
    }
    if (isValidToken(token) && !config.skipAuthHeader) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    if (__DEV__) console.log("Auth request setup error:", err.message);
  }
  return config;
}, (error) => Promise.reject(error));

const refreshAccessToken = async () => {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error("No refresh session");

  const deviceId = await getDeviceId();
  const response = await axios.post(
    `${API_URL}/auth/refresh`,
    { refreshToken },
    { timeout: 30000, headers: { "X-Device-ID": deviceId } }
  );

  const nextAccessToken = response.data?.accessToken || response.data?.token;
  const nextRefreshToken = response.data?.refreshToken;
  if (!isValidToken(nextAccessToken) || !nextRefreshToken) {
    throw new Error("Invalid refresh response");
  }

  await setToken(nextAccessToken);
  await setRefreshToken(nextRefreshToken);
  cachedToken = nextAccessToken;
  if (accessTokenUpdatedHandler) accessTokenUpdatedHandler(nextAccessToken);
  return nextAccessToken;
};

const getFreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
};

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    const url = String(original?.url || "");
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/register") || url.includes("/auth/google") || url.includes("/auth/forgot-password") || url.includes("/auth/verify-otp") || url.includes("/auth/reset-password") || url.includes("/auth/refresh") || url.includes("/auth/logout");

    if (status === 401 && original && !original._retry && !original.skipAuthRefresh && !isAuthEndpoint) {
      original._retry = true;
      try {
        const newToken = await getFreshAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return API(original);
      } catch {
        cachedToken = null;
        if (logoutHandler) logoutHandler();
      }
    }

    return Promise.reject(error);
  }
);

export default API;
