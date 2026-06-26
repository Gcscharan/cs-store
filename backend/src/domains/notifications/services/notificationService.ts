// Notification Service — delegates to the Expo push transport.
// Uses the existing PushNotificationService (Expo) which reads the user's
// expoPushToken and notification preferences before sending.
import { PushNotificationService } from "../../../utils/PushNotificationService";
import { logger } from "../../../utils/logger";

export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: any
) => {
  try {
    await PushNotificationService.sendToUser(userId, title, body, data);
  } catch (error) {
    logger.error(`[notificationService] Failed to send push to user ${userId}:`, error);
  }
};

export const triggerCartAbandonmentNotification = async (userId: string) => {
  await sendPushNotification(
    userId,
    "Your items are waiting 🛒",
    "Complete your order now and get fast delivery!"
  );
};

export const triggerPaymentFailureNotification = async (userId: string, orderId: string) => {
  await sendPushNotification(
    userId,
    "Payment failed ⚠️",
    "Your recent payment attempt failed. Tap here to retry and complete your order.",
    { orderId }
  );
};

export const triggerOrderUpdateNotification = async (userId: string, orderId: string, status: string) => {
  let title = "Order Update";
  let body = `Your order status is now: ${status}`;

  if (status === 'OUT_FOR_DELIVERY') {
    title = "Order out for delivery 🚴";
    body = "Your order is on its way and will reach you shortly!";
  } else if (status === 'DELIVERED') {
    title = "Order Delivered 🎉";
    body = "Your order has been delivered. Enjoy!";
  }

  await sendPushNotification(userId, title, body, { orderId });
};
