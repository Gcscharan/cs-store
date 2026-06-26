import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { profileApi } from '../api/profileApi';
import { store } from '../store';
import { navigateFromNotification } from './notificationDeepLink';

/**
 * Foreground notification handling.
 *
 * The app shows its own rich in-app toast (driven by the socket `notification:new`
 * event, see socketClient.ts). To avoid a DOUBLE notification when the app is in
 * the foreground (system banner + in-app toast), we suppress the OS banner while
 * foregrounded. Background / terminated delivery still shows the system tray
 * banner normally (this handler only runs for foreground notifications).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,  // in-app toast handles foreground; avoid double-notify
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: false, // SDK 49+
    shouldShowList: true,    // still record it in the notification center/tray
  }),
});

export class ExpoPushNotificationService {
  static async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      // Category-specific channels (match backend pushGateway channelIds)
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Order Updates',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E95C1E',
      });
      await Notifications.setNotificationChannelAsync('payments', {
        name: 'Payments',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
      await Notifications.setNotificationChannelAsync('promotions', {
        name: 'Offers & Promotions',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }

      try {
        const tokenData = await Notifications.getExpoPushTokenAsync();
        token = tokenData.data;
        console.log('✅ [Push] Expo Push Token (FCM Verified):', token);

        if (token) {
          await this.saveTokenToBackend(token);
        }
      } catch (error: any) {
        console.warn(
          '⚠️ [Push] Push notifications disabled: Missing FCM configuration (google-services.json). ' +
          'Complete the setup guide at: https://docs.expo.dev/push-notifications/fcm-credentials/',
          __DEV__ ? '' : error?.message
        );
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  static async saveTokenToBackend(token: string) {
    try {
      const state = store.getState() as any;
      const isAuthenticated = state.auth?.status === 'ACTIVE';

      if (!isAuthenticated) {
        console.log('Skipping push token save: User not authenticated');
        return;
      }

      await store.dispatch(
        profileApi.endpoints.updatePushToken.initiate({
          pushToken: token,
          platform: Platform.OS,
        })
      ).unwrap();
      console.log('Push token saved to backend successfully');
    } catch (error) {
      console.error('Failed to save push token to backend:', error);
    }
  }

  /**
   * Removes this device's push token from the backend (call on logout) so a
   * shared device stops receiving the previous user's notifications.
   */
  static async removeTokenFromBackend() {
    try {
      const token = (await Notifications.getExpoPushTokenAsync().catch(() => null))?.data;
      await store.dispatch(
        profileApi.endpoints.removePushToken.initiate({ pushToken: token || undefined })
      ).unwrap();
      console.log('Push token removed from backend');
    } catch (error) {
      // Non-fatal — logout proceeds regardless.
      console.warn('Failed to remove push token from backend:', error);
    }
  }

  /**
   * Handles the case where the app was launched (cold start) by tapping a
   * notification while it was terminated. Expo buffers that response and exposes
   * it via getLastNotificationResponseAsync(). Must be called once after
   * navigation is ready.
   */
  static async handleTerminatedStateNotification() {
    try {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response) {
        const data = response.notification.request.content.data as any;
        console.log('[Push] Cold-start from notification tap:', data);
        // Small delay to ensure navigation tree is mounted.
        setTimeout(() => navigateFromNotification(data), 300);
      }
    } catch (error) {
      console.warn('[Push] Failed to handle terminated-state notification:', error);
    }
  }

  static addNotificationListeners() {
    // Foreground receipt — the in-app toast (socket-driven) handles display.
    // We still process silent data payloads here.
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data as any;
      if (data?.['content-available'] === 1) {
        console.log('[Push] Silent data payload received');
      }
    });

    // Notification tap (app in foreground or background — NOT terminated).
    // Terminated taps are handled by handleTerminatedStateNotification().
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      console.log('[Push] Notification tapped:', data);
      navigateFromNotification(data);
    });

    // Background token rotation (APNS/FCM).
    const tokenListener = Notifications.addPushTokenListener(token => {
      console.log('Push token rotated, updating backend...');
      this.saveTokenToBackend(token.data);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
      tokenListener.remove();
    };
  }
}
