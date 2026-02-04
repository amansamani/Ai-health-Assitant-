import { View, ActivityIndicator } from "react-native";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";

export default function AppNavigator() {
  const { token, loading } = useContext(AuthContext);

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
