import { getApps } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import { Alert, Platform } from 'react-native';
import { logEvent } from './analytics';

export class PushNotificationService {
  static get isInitialized() {
    return getApps().length > 0;
  }

  static async requestUserPermission() {
    if (!this.isInitialized) {
      console.warn('Firebase is not initialized. Skipping push permission request.');
      return false;
    }
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Authorization status:', authStatus);
      }
      return enabled;
    }
    return true; // Android permissions are handled in AndroidManifest
  }

  static async getToken() {
    if (!this.isInitialized) return null;
    
    try {
      const token = await messaging().getToken();
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  static setupForegroundListener() {
    if (!this.isInitialized) {
      console.warn('Firebase is not initialized. Skipping foreground listener.');
      return () => {};
    }

    return messaging().onMessage(async remoteMessage => {
      console.log('A new FCM message arrived!', JSON.stringify(remoteMessage));
      logEvent('notification_received_foreground', { 
        title: remoteMessage.notification?.title 
      });
      
      Alert.alert(
        remoteMessage.notification?.title || 'New Notification',
        remoteMessage.notification?.body || ''
      );
    });
  }

  static setupBackgroundListener() {
    if (!this.isInitialized) {
      console.warn('Firebase is not initialized. Skipping background listener.');
      return;
    }

    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Message handled in the background!', remoteMessage);
      logEvent('notification_received_background', { 
        title: remoteMessage.notification?.title 
      });
    });
  }
}
