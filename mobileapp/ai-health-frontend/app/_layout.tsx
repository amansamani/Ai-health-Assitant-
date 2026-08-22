import { useEffect } from "react";
import { Stack } from "expo-router";
import * as Updates from "expo-updates";
import { AuthProvider } from "@/src/context/AuthContext";

// Single provider for the whole app. index.tsx and both (auth)/(app) route
// groups read auth state from here, so login state stays in sync no matter
// which URL/screen the user is on.
export default function RootLayout() {
  useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const res = await Updates.checkForUpdateAsync();
        if (res.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log("update check fail", e);
      }
    })();
  }, []);

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </AuthProvider>
  );
}