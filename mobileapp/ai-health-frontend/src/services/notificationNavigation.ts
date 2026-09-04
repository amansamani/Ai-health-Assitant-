import * as Notifications from "expo-notifications";
import type { Href, Router } from "expo-router";

/**
 * Resolve a push notification payload to a real Expo Router route.
 * The backend can supply an explicit `route`, `url`, or `screen` in the
 * future. Existing notifications are also supported through their `moment`
 * and `type` values, so older notifications remain useful.
 */
export function getNotificationRoute(data: Record<string, unknown>): Href | null {
  const explicit = data.route ?? data.url ?? data.screen;
  if (typeof explicit === "string" && explicit.startsWith("/")) {
    return explicit as Href;
  }

  const moment = typeof data.moment === "string" ? data.moment : "";
  const type = typeof data.type === "string" ? data.type : "";

  switch (type || moment) {
    case "duelChallenged":
    case "duelAccepted":
    case "duelWon":
    case "duelLost":
    case "duelTie":
    case "duel":
      return "/(app)/social/duels" as Href;

    case "achievementEarned":
    case "achievement":
      return "/(app)/social/achievements" as Href;

    case "weeklyInsight":
    case "weeklyRecap":
      return "/(app)/weekly-summary" as Href;

    case "morningKickoff":
      return "/(app)/(tabs)/home" as Href;

    case "lunchReminder":
    case "dinnerReminder":
      return "/(app)/(tabs)/diet" as Href;

    case "waterNudge":
      return "/(app)/water-tracking" as Href;

    case "stepNudge":
      return "/(app)/(tabs)/tracking" as Href;

    case "workoutReminder":
      return "/(app)/(tabs)/workout" as Href;

    case "streakAtRisk":
      return "/(app)/social/streaks" as Href;

    case "followRequest":
      return "/(app)/social/follow-requests" as Href;

    case "newFollower":
    case "followAccepted":
      if (typeof data.userId === "string" && data.userId) {
        return { pathname: "/(app)/social/profile", params: { identifier: data.userId } } as Href;
      }
      return "/(app)/social" as Href;


    case "comeback":
      return "/(app)/(tabs)/home" as Href;

    default:
      return "/(app)/(tabs)/home" as Href;
  }
}

export function navigateFromNotification(
  router: Router,
  response: Notifications.NotificationResponse | null | undefined,
) {
  if (!response) return false;

  const rawData = response.notification.request.content.data;
  const data = rawData && typeof rawData === "object"
    ? (rawData as Record<string, unknown>)
    : {};

  const route = getNotificationRoute(data);
  if (!route) return false;

  router.replace(route);
  return true;
}
