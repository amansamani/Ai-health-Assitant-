import { useContext } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, Redirect } from "expo-router";
import { AuthContext } from "@/src/context/AuthContext";

export default function AuthLayout() {
  const { userToken, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Deep link / stale tab landed on an auth screen while already logged in.
  if (userToken) {
    return <Redirect href="/(app)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
