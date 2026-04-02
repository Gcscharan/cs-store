import fetch from 'node-fetch';
import { logger } from './logger';
import { User } from '../models/User';

export interface PushNotificationPayload {
  to: string;
  title: string;
  body: string;
  data?: any;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export class PushNotificationService {
  private static EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  /**
   * Send a push notification to a specific user
   */
  static async sendToUser(userId: string, title: string, body: string, data?: any) {
    try {
      const user = await User.findById(userId).select('expoPushToken notificationPreferences');
      if (!user || !user.expoPushToken) {
        logger.debug(`User ${userId} has no push token, skipping notification`);
        return;
      }

      // Check if user has push notifications enabled for "myOrders" category
      const pushEnabled = user.notificationPreferences?.push?.enabled !== false;
      const myOrdersEnabled = user.notificationPreferences?.push?.categories?.myOrders !== false;

      if (!pushEnabled || !myOrdersEnabled) {
        logger.debug(`User ${userId} has disabled push notifications for orders`);
        return;
      }

      await this.sendExpoNotification({
        to: user.expoPushToken,
        title,
        body,
        data,
      });
    } catch (error) {
      logger.error(`Error sending push notification to user ${userId}:`, error);
    }
  }

  /**
   * Internal method to send notification via Expo API
   */
  private static async sendExpoNotification(payload: PushNotificationPayload) {
    try {
      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      
      if (response.ok) {
        logger.info(`Push notification sent successfully to ${payload.to}`);
      } else {
        logger.error(`Failed to send push notification to ${payload.to}:`, result);
      }
    } catch (error) {
      logger.error(`Error in sendExpoNotification:`, error);
    }
  }
}
