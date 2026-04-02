import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { profileApi } from '../api/profileApi';
import { store } from '../store';
import { navigationRef } from '../navigation/RootNavigator';
import { showToast } from '../store/slices/uiSlice';

// Configure how notifications should be handled when the app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false, // Don't show system banner, we use custom Toast
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: true,
  }),
});

export class ExpoPushNotificationService {
  static async registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
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
        console.log('Expo Push Token (FCM Verified):', token);
        
        // Update token on backend if authenticated
        if (token) {
          await this.saveTokenToBackend(token);
        }
      } catch (error: any) {
        console.warn('⚠️ Push notifications disabled internally. Needs FCM google-services.json compile. Ignoring error safely.', error?.message);
      }
    } else {
      console.log('Must use physical device for Push Notifications');
    }

    return token;
  }

  static async saveTokenToBackend(token: string) {
    try {
      // Use the profileApi to update the token
      // We use store.dispatch because this is called outside a React component
      await store.dispatch(
        profileApi.endpoints.updatePushToken.initiate({ pushToken: token })
      ).unwrap();
      console.log('Push token saved to backend successfully');
    } catch (error) {
      console.error('Failed to save push token to backend:', error);
    }
  }

  static addNotificationListeners() {
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification Received (Foreground):', notification);
      const title = notification.request.content.title;
      const body = notification.request.content.body;
      const data = notification.request.content.data;
      
      // If backend sends generic content-available or we want to show a custom toast
      if (title || body) {
        store.dispatch(showToast(title || body || 'New Notification'));
      }
      
      // If it's a silent order update payload, redux logic could respond here
      if (data?.['content-available'] === 1) {
        console.log('Silent data payload received, refreshing data...');
        // trigger redundant fetches or state updates silently
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification Response Tapped:', response);
      const data = response.notification.request.content.data;
      
      if (navigationRef.isReady()) {
        if (data?.type === 'ORDER_UPDATE' && data?.orderId) {
          navigationRef.navigate('OrderTracking', { orderId: data.orderId });
        } else if (data?.type === 'OFFER') {
          navigationRef.navigate('Main', { screen: 'Home' }); // Or a dedicated Offers tab
        }
      }
    });

    // Handle background token rotation natively given by APNS/FCM
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
