import { Redirect, Stack } from "expo-router";
import { useContext } from "react";
import { AuthContext } from "../../src/context/AuthContext";
import AppLoading from "../../src/components/ui/AppLoading";

// App-level navigation shell.
//
// The five primary sections live inside (tabs), which owns the persistent
// bottom tab bar. Everything else (coach, profile, nutrition flows, workouts,
// tracking details, social screens, etc.) is pushed above that tab shell as a
// normal Stack screen. This keeps the tab bar completely out of nested flows.
export default function AppLayout() {
  const { userToken, loading } = useContext(AuthContext);

  if (loading) {
    return <AppLoading label="Loading FitLip" />;
  }

  if (!userToken) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
