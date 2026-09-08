import { createContext, useState, useEffect, useCallback } from "react";
import { setLogoutHandler, setAccessTokenUpdatedHandler, setTokenCache, clearTokenCache } from "../services/api";
import API from "../services/api";
import { getToken, getRefreshToken, setToken, setRefreshToken, removeToken, getDeviceId, clearPendingSession } from "../utils/secureToken";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [userToken, setUserToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userGoal, setUserGoal] = useState(null);
  const [user, setUser] = useState(null);

  const logout = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    try {
      if (refreshToken) {
        await API.post("/auth/logout", { refreshToken }, { skipAuthRefresh: true });
      }
    } catch (_) {
      // Local logout still succeeds if the server is unreachable.
    } finally {
      await removeToken();
      await clearPendingSession();
      clearTokenCache();
      setUserToken(null);
      setUserGoal(null);
      setUser(null);
    }
  }, []);

  const fetchUserGoal = useCallback(async () => {
    try {
      const res = await API.get("/user/profile");
      const data = res.data ?? {};
      setUserGoal(data.goal ?? "fit");
      setUser(data);
    } catch (_) {}
  }, []);

  const login = useCallback(async (accessToken, refreshToken) => {
    if (!accessToken) throw new Error("Access token is required");
    await setToken(accessToken);
    if (refreshToken) await setRefreshToken(refreshToken);
    setTokenCache(accessToken);
    setUserToken(accessToken);
    await clearPendingSession();
    await fetchUserGoal();
  }, [fetchUserGoal]);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await getToken();
        const refreshToken = await getRefreshToken();
        if (token && refreshToken) {
          setTokenCache(token);
          setUserToken(token);
          fetchUserGoal();
        } else if (token && !refreshToken) {
          await removeToken();
        }
      } catch (err) {
        if (__DEV__) console.log("Failed to load session:", err);
      } finally {
        setLoading(false);
      }
    };
    loadToken();
    setLogoutHandler(logout);
    setAccessTokenUpdatedHandler((nextToken) => setUserToken(nextToken));
  }, [logout, fetchUserGoal]);

  return (
    <AuthContext.Provider value={{ userToken, token: userToken, login, logout, loading, userGoal, setUserGoal, fetchUserGoal, user }}>
      {children}
    </AuthContext.Provider>
  );
}
