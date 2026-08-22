import { useContext, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack, Redirect } from "expo-router";
import { AuthContext } from "@/src/context/AuthContext";
import { registerForPushNotificationsAsync } from "@/src/services/pushNotifications";

export default function AppLayout() {
  const { userToken, loading } = useContext(AuthContext);

  // Register push token once authenticated. Cheap no-op if permission/token
  // are unchanged, safe to re-run on every login.
  useEffect(() => {
    if (userToken) {
      registerForPushNotificationsAsync();
    }
  }, [userToken]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Deep link / stale tab landed on an app screen while signed out.
  if (!userToken) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Persistent bottom-tab shell — Home / Exercise / Camera / Diet / Track */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="profile"
        options={{ animation: "slide_from_right", animationDuration: 180 }}
      />
      <Stack.Screen
        name="coach"
        options={{ animation: "slide_from_bottom", animationDuration: 200 }}
      />
      <Stack.Screen
        name="workout-detail"
        options={{ animation: "slide_from_right", animationDuration: 180 }}
      />
      <Stack.Screen
        name="custom-workout"
        options={{ animation: "slide_from_right", animationDuration: 180 }}
      />
      <Stack.Screen
        name="nutrition/meal-logger"
        options={{ headerShown: true, title: "Log Meal", headerBackTitle: "Home" }}
      />
      <Stack.Screen
        name="nutrition/log-meal"
        options={{ headerShown: true, title: "Add Food", headerBackTitle: "Log Meal" }}
      />
      <Stack.Screen
        name="nutrition/log-meal-photo"
        options={{ headerShown: true, title: "Snap Your Meal", headerBackTitle: "Log Meal" }}
      />
      <Stack.Screen name="nutrition/progress" options={{ title: "Progress" }} />
      <Stack.Screen name="social/index" options={{ animation: "slide_from_right", animationDuration: 180 }} />
      <Stack.Screen name="social/profile" options={{ animation: "slide_from_right", animationDuration: 180 }} />
      <Stack.Screen name="social/friends" options={{ animation: "slide_from_right", animationDuration: 180 }} />
      <Stack.Screen name="social/duels" options={{ animation: "slide_from_right", animationDuration: 180 }} />
      <Stack.Screen name="social/create-duel" options={{ animation: "slide_from_bottom", animationDuration: 200 }} />
      <Stack.Screen name="social/duel-detail" options={{ animation: "slide_from_right", animationDuration: 180 }} />
      <Stack.Screen name="social/achievements" options={{ animation: "slide_from_right", animationDuration: 180 }} />
      <Stack.Screen name="social/gamification" options={{ animation: "slide_from_right", animationDuration: 180 }} />
      <Stack.Screen name="social/streaks" options={{ animation: "slide_from_right", animationDuration: 180 }} />
    </Stack>
  );
}
