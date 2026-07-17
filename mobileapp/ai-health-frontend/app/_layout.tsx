import { Stack } from "expo-router";
import { AuthProvider } from "@/src/context/AuthContext";

// Single provider for the whole app. index.tsx and both (auth)/(app) route
// groups read auth state from here, so login state stays in sync no matter
// which URL/screen the user is on.
export default function RootLayout() {
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
