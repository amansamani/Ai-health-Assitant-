import { createContext, useState, useEffect, useCallback } from "react";
import { setLogoutHandler, setTokenCache, clearTokenCache } from "../services/api";
import API from "../services/api";
import { getToken, setToken, removeToken } from "../utils/secureToken";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [userToken, setUserToken] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [userGoal, setUserGoal]   = useState(null);
  const [user, setUser]           = useState(null); // ← stores full profile

  const logout = useCallback(async () => {
    console.log("🚨 logout() triggered");
    await removeToken();
    clearTokenCache();
    setUserToken(null);
    setUserGoal(null);
    setUser(null);
  }, []);

  // ── Fetch profile (goal + name) ───────────────────────────────────────────
  const fetchUserGoal = useCallback(async () => {
    try {
      const res = await API.get("/user/profile");
      const data = res.data ?? {};
      setUserGoal(data.goal ?? "fit");
      setUser(data); // ← save entire profile object
    } catch (err) {
      // not critical
    }
  }, []);

  const login = async (token) => {
    await setToken(token);
    setTokenCache(token);
    setUserToken(token);
    await fetchUserGoal();
    console.log("✅ login() — token cached and state updated");
  };

  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await getToken();
        if (token && token !== "undefined" && token !== "null") {
          setTokenCache(token);
          setUserToken(token);
          fetchUserGoal();
        }
      } catch (err) {
        console.log("Failed to load token:", err);
      } finally {
        setLoading(false);
      }
    };
    loadToken();
    setLogoutHandler(logout);
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{ userToken, token: userToken, login, logout, loading, userGoal, setUserGoal, fetchUserGoal, user }}
    >
      {children}
    </AuthContext.Provider>
  );
}