import { getApps } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import { Alert, Platform } from 'react-native';
import { logEvent } from './analytics';

/**
 * Service for handling Firebase Cloud Messaging (FCM) push notifications.
 * Implements defensive guards to prevent crashes if Firebase is not initialized.
 */
export class PushNotificationService {
  /**
   * Checks if Firebase is initialized.
   * Uses getApps() to verify if the [DEFAULT] app exists.
   */
  static get isInitialized() {
    try {
      return getApps().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Safely gets the messaging instance.
   * Returns null if Firebase is not initialized.
   */
  private static get messaging() {
    if (!this.isInitialized) return null;
    try {
      return messaging();
    } catch (error) {
      console.warn('[PushNotificationService] Failed to get messaging instance:', error);
      return null;
    }
  }

  static async requestUserPermission() {
    const msg = this.messaging;
    if (!msg) {
      console.warn('Firebase is not initialized. Skipping push permission request.');
      return false;
    }

    try {
      if (Platform.OS === 'ios') {
        const authStatus = await msg.requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('Authorization status:', authStatus);
        }
        return enabled;
      }
      return true; // Android permissions are handled in AndroidManifest or via specific SDK calls
    } catch (error) {
      console.error('[PushNotificationService] Error requesting permission:', error);
      return false;
    }
  }

  static async getToken() {
    const msg = this.messaging;
    if (!msg) return null;
    
    try {
      const token = await msg.getToken();
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  static setupForegroundListener() {
    const msg = this.messaging;
    if (!msg) {
      console.warn('Firebase is not initialized. Skipping foreground listener.');
      return () => {};
    }

    try {
      return msg.onMessage(async remoteMessage => {
        console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));
        logEvent('notification_received_foreground', { 
          title: remoteMessage.notification?.title 
        });
        
        Alert.alert(
          remoteMessage.notification?.title || 'New Notification',
          remoteMessage.notification?.body || ''
        );
      });
    } catch (error) {
      console.error('[PushNotificationService] Error setting up foreground listener:', error);
      return () => {};
    }
  }

  static setupBackgroundListener() {
    const msg = this.messaging;
    if (!msg) {
      console.warn('Firebase is not initialized. Skipping background listener.');
      return;
    }

    try {
      msg.setBackgroundMessageHandler(async remoteMessage => {
        console.log('Message handled in the background!', remoteMessage);
        logEvent('notification_received_background', { 
          title: remoteMessage.notification?.title 
        });
      });
    } catch (error) {
      console.error('[PushNotificationService] Error setting up background listener:', error);
    }
  }
}
