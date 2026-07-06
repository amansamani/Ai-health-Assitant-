"use strict";

const { Expo } = require("expo-server-sdk");
const logger = require("../config/logger");

const expo = new Expo();

async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken) return { sent: false, reason: "No push token on file" };

  if (!Expo.isExpoPushToken(pushToken)) {
    logger.warn("Invalid Expo push token — skipping notification");
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
      logger.error({ ticketMessage: ticket.message }, "Expo push ticket error");
      return { sent: false, reason: ticket.message };
    }

    return { sent: true, ticket };
  } catch (err) {
    logger.error({ err }, "sendPushNotificationsAsync failed");
    return { sent: false, reason: err.message };
  }
}

module.exports = { sendPushNotification };