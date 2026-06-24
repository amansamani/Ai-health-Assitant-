"use strict";

const { Expo } = require("expo-server-sdk");

const expo = new Expo();

/**
 * Send a push notification to a single user.
 * Silent-fails (logs only) — push delivery must never break the weekly job.
 *
 * @param {string} pushToken  Expo push token, e.g. "ExponentPushToken[xxxx]"
 * @param {string} title
 * @param {string} body
 * @param {object} data        extra payload for client-side deep-linking
 */
async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken) return { sent: false, reason: "No push token on file" };

  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(`[push] Invalid Expo push token: ${pushToken}`);
    return { sent: false, reason: "Invalid Expo push token" };
  }

  const message = {
    to: pushToken,
    sound: "default",
    title,
    body,
    data,
  };

  try {
    const [ticket] = await expo.sendPushNotificationsAsync([message]);

    if (ticket.status === "error") {
      console.error(`[push] Expo ticket error: ${ticket.message}`);
      return { sent: false, reason: ticket.message };
    }

    return { sent: true, ticket };
  } catch (err) {
    console.error("[push] sendPushNotificationsAsync failed:", err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendPushNotification };
