import { createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [userToken, setUserToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔹 Load token on app start
  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (token) {
          setUserToken(token);
        }
      } catch (err) {
        console.log("Failed to load token");
      } finally {
        setLoading(false);
      }
    };

    loadToken();
  }, []);

  // 🔹 LOGIN (THIS WAS MISSING)
  const login = async (token) => {
    await AsyncStorage.setItem("token", token);
    setUserToken(token);
  };

  // 🔹 LOGOUT
  const logout = async () => {
    await AsyncStorage.removeItem("token");
    setUserToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        userToken,
        token: userToken, // alias (you use `token` in screens)
        login,            // ✅ NOW EXISTS
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
