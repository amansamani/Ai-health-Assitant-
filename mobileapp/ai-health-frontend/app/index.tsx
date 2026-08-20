import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useContext } from "react";

import { AuthContext } from "@/src/context/AuthContext";

export default function Index() {
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

  if (userToken) {
    return <Redirect href="/(app)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}