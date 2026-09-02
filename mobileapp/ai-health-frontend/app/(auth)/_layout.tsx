import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useContext } from "react";

import { AuthContext } from "@/src/context/AuthContext";
import AppLoading from "@/src/components/ui/AppLoading";

export default function AuthLayout() {
  const { userToken, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <AppLoading />
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