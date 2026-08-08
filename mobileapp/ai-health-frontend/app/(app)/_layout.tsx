import { useContext, useEffect } from "react";
import { View, ActivityIndicator, StatusBar } from "react-native";
import { Stack, Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthContext } from "@/src/context/AuthContext";
import { registerForPushNotificationsAsync } from "@/src/services/pushNotifications";
import { COLORS } from "@/src/constants/theme";

export default function AppLayout() {
  const { userToken, loading } = useContext(AuthContext);

  useEffect(() => {
    if (userToken) registerForPushNotificationsAsync();
  }, [userToken]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userToken) return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ animation: "slide_from_right", animationDuration: 180 }} />
        <Stack.Screen name="coach" options={{ animation: "slide_from_bottom", animationDuration: 200 }} />
        <Stack.Screen name="workout-detail" options={{ animation: "slide_from_right", animationDuration: 180 }} />
        <Stack.Screen name="nutrition/meal-logger" options={{ headerShown: true, title: "Log Meal", headerBackTitle: "Home" }} />
        <Stack.Screen name="nutrition/log-meal" options={{ headerShown: true, title: "Add Food", headerBackTitle: "Log Meal" }} />
        <Stack.Screen name="nutrition/log-meal-photo" options={{ headerShown: true, title: "Snap Your Meal", headerBackTitle: "Log Meal" }} />
        <Stack.Screen name="nutrition/progress" options={{ title: "Progress" }} />
      </Stack>
    </SafeAreaView>
  );
}