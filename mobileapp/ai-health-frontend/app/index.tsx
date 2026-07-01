import { View, ActivityIndicator } from "react-native";
import { useContext, useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, AuthContext } from "../src/context/AuthContext";
import AuthNavigator from "../src/navigation/AuthNavigator";
import AppNavigator from "../src/navigation/AppNavigator";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { userToken, loading } = useContext(AuthContext);

  useEffect(() => {
    if (!loading) {
      SplashScreen.hideAsync();
    }
  }, [loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return userToken ? <AppNavigator /> : <AuthNavigator />;
}

export default function Page() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}