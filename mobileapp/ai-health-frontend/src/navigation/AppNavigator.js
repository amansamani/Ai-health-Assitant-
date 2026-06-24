import { View, ActivityIndicator } from "react-native";
import { useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { registerForPushNotificationsAsync } from "../services/pushNotifications";

import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";

export default function AppNavigator() {
  const { token, loading } = useContext(AuthContext);

  // Register push token once the user is authenticated. Safe to re-run on
  // every login — it's a cheap no-op if permission/token are unchanged.
  useEffect(() => {
    if (token) {
      registerForPushNotificationsAsync();
    }
  }, [token]);

  // ⛔ BLOCK UI until token is checked
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // ✅ Decide navigator AFTER token ready
  return token ? <MainNavigator /> : <AuthNavigator />;
}
