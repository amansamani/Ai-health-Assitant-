import { useContext, useEffect, useRef, useState } from "react";
import { Stack, useRootNavigationState, useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, AuthContext } from "@/src/context/AuthContext";
import FeedbackToast from "@/src/components/ui/FeedbackToast";
import AppLoading from "@/src/components/ui/AppLoading";
import { navigateFromNotification } from "@/src/services/notificationNavigation";
// Registers the native GPS task at app startup, including headless/background launches.
import "@/src/services/runLocationTask";

SplashScreen.preventAutoHideAsync();

function NotificationTapHandler() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { userToken, loading: authLoading } = useContext(AuthContext);
  const handledId = useRef<string | null>(null);
  const pendingResponse = useRef<Notifications.NotificationResponse | null>(null);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handledId.current === id) return;
      pendingResponse.current = response;
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);

    Notifications.getLastNotificationResponseAsync()
      .then(handleResponse)
      .catch((error) => console.warn("Notification response lookup failed:", error));

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!pendingResponse.current || !navigationState?.key || authLoading) return;

    // If the user has a session, wait until the protected app tree can mount.
    // This prevents a cold-start tap from being redirected away before the
    // AuthContext has restored the stored token.
    if (!userToken) return;

    const response = pendingResponse.current;
    const id = response.notification.request.identifier;
    pendingResponse.current = null;
    handledId.current = id;

    requestAnimationFrame(() => {
      navigateFromNotification(router, response);
      const clearLast = Notifications.clearLastNotificationResponseAsync?.();
      if (clearLast) clearLast.catch(() => {});
    });
  }, [navigationState?.key, authLoading, userToken, router]);

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
        <Stack.Screen name="(app)/notifications" />
      </Stack>
      <FeedbackToast />
    </AuthProvider>
  );
}
