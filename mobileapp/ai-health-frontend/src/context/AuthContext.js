import { createContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setLogoutHandler } from "../services/api";
import API from "../services/api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [userToken, setUserToken] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [userGoal, setUserGoal]   = useState(null);

  const logout = useCallback(async () => {
    console.log("🚨 logout() triggered");
    await AsyncStorage.removeItem("token");
    setUserToken(null);
    setUserGoal(null);
  }, []);

  // ── Fetch goal from health profile (where it's actually stored) ────────────
  const fetchUserGoal = useCallback(async () => {
    try {
      const res = await API.get("/health");
      // goal field: "lose" | "maintain" | "gain"
      const goal = res.data?.goal ?? res.data?.data?.goal ?? null;
      setUserGoal(goal);
    } catch (err) {
      // Not critical — silently ignore, goal just won't be set
    }
  }, []);

  const login = async (token) => {
    await AsyncStorage.setItem("token", token);
    setUserToken(token);
    console.log("✅ login() — userToken set, navigator will swap");
  };

  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (token) {
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
      value={{
        userToken,
        token:        userToken,
        login,
        logout,
        loading,
        userGoal,
        fetchUserGoal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}