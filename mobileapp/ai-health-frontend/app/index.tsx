import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useContext } from "react";

import { AuthContext } from "@/src/context/AuthContext";
import AppLoading from "@/src/components/ui/AppLoading";

export default function Index() {
  const { userToken, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <AppLoading />
    );
  }

  if (userToken) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}