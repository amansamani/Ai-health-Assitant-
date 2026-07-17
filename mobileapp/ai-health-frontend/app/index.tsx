import { View, ActivityIndicator } from "react-native";
import { useContext } from "react";
import { Redirect } from "expo-router";
import { AuthContext } from "@/src/context/AuthContext";

export default function Index() {
  const { userToken, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <Redirect href={userToken ? "/(app)/home" : "/(auth)/login"} />;
}