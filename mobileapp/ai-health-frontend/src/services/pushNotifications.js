import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import API from "./api";

// Foreground behavior: show banner + sound even while app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permission, fetch Expo push token, and sync it to the backend.
 * NOTE: push notifications require a development or production build —
 * they will NOT work in Expo Go on Android (SDK 53+), and never work on
 * a simulator/emulator (only physical devices get a push token).
 *
 * Safe to call repeatedly (e.g. on every app open) — it's a cheap no-op
 * if permission was already granted and the token hasn't changed.
 */
export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log("[push] Skipping — simulators/emulators can't receive push.");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[push] Permission not granted — skipping token registration.");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.warn("[push] No EAS projectId found in app config.");
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    await API.post("/user/push-token", { pushToken: token });
    console.log("[push] Token registered:", token);

    return token;
  } catch (err) {
    console.log("[push] Registration failed:", err.message);
    return null;
  }
}
