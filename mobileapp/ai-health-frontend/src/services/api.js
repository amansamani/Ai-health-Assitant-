import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

let logoutHandler = null;

export const setLogoutHandler = (handler) => {
  logoutHandler = handler;
};

const API = axios.create({
  baseURL: "https://ai-health-assitant-production.up.railway.app/api",
  timeout: 10000, // prevent hanging requests
});

/*
────────────────────────────────────────
 Attach JWT Token Automatically
────────────────────────────────────────
*/
API.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    } catch (err) {
      console.log("Token fetch error:", err);
      return config;
    }
  },
  (error) => Promise.reject(error)
);

/*
────────────────────────────────────────
 Response / Error Handling
────────────────────────────────────────
*/
API.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("token");

    console.log("➡️ API Request:", config.baseURL + config.url);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  } catch (err) {
    console.log("Token fetch error:", err);
    return config;
  }
});

export default API;