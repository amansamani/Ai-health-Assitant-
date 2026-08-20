import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useContext } from "react";

import { AuthContext } from "@/src/context/AuthContext";

export default function AuthLayout() {
  const { userToken, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If the user is already authenticated, don't allow them
  // to remain inside the authentication flow.
  if (userToken) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}