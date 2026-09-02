import { useEffect, useRef, useState } from "react";
import { Stack, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "@/src/context/AuthContext";
import FeedbackToast from "@/src/components/ui/FeedbackToast";
import AppLoading from "@/src/components/ui/AppLoading";
import { navigateFromNotification } from "@/src/services/notificationNavigation";
// Registers the native GPS task at app startup, including headless/background launches.
import "@/src/services/runLocationTask";

SplashScreen.preventAutoHideAsync();

function NotificationTapHandler() {
  const router = useRouter();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledId.current === id) return;
      handledId.current = id;
      // Let Expo Router finish mounting before replacing the current route.
      requestAnimationFrame(() => {
        navigateFromNotification(router, response);
      });
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handle);

    Notifications.getLastNotificationResponseAsync()
      .then(handle)
      .catch((error) => console.warn("Notification response lookup failed:", error));

    return () => subscription.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Load fonts, local configuration, etc. here if needed.
      } catch (error) {
        console.error("Startup error:", error);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hide();
    }
  }, [appReady]);

  if (!appReady) {
    return <AppLoading label="Loading FitLip" />;
  }

  return (
    <AuthProvider>
      <NotificationTapHandler />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <FeedbackToast />
    </AuthProvider>
  );
}
