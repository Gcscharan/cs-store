import './src/utils/sentryPolyfill';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Provider, useSelector } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Sentry } from './src/utils/sentry';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { PersistGate } from 'redux-persist/integration/react';
import { enableScreens } from 'react-native-screens';
import { store, persistor, RootState } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useAuthBootstrap } from './src/hooks/useAuthBootstrap';
import LoadingScreen from './src/screens/common/LoadingScreen';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import OfflineBanner from './src/components/common/OfflineBanner';
import { PendingPaymentTracker } from './src/components/common/PendingPaymentTracker';
import { Toast } from './src/components/common/Toast';
import { ExpoPushNotificationService } from './src/utils/ExpoPushNotificationService';
import { socketClient } from './src/services/socketClient';
import { useDispatch } from 'react-redux';
import { AppDispatch } from './src/store';
import { featureFlags } from './src/config/featureFlags';
import './src/i18n';

// Optimize performance: Enable native screens
enableScreens(true);

// Initialize Sentry (must be before any React rendering)
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN && !__DEV__) {
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: 'production',
      tracesSampleRate: 0.2,
      enableAutoSessionTracking: true,
      attachStacktrace: true,
    });
  } catch (e) {
    console.error('Sentry initialization failed', e);
  }
}

// Disable console logs in production for performance
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}

// Configure Google Sign-In
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
if (GOOGLE_WEB_CLIENT_ID) {
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
  });
}

function AppContent() {
  useAuthBootstrap();
  const dispatch = useDispatch<AppDispatch>();

  // ── Socket.IO lifecycle: connect on auth, disconnect on logout ──
  const { status } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    socketClient.init(dispatch);
  }, [dispatch]);

  useEffect(() => {
    if (status === 'ACTIVE') {
      // Refresh feature flags on auth
      featureFlags.init().then(() => {
        // Only connect socket if flag enabled (kill-switch support)
        if (featureFlags.get('socketEnabled')) {
          socketClient.connect();
        }
      });
      // Set Sentry user context on auth
      const userId = (store.getState() as RootState).auth.user?._id;
      if (userId && SENTRY_DSN && !__DEV__) {
        Sentry.setUser({ id: userId });
      }
    } else {
      socketClient.disconnect();
      if (SENTRY_DSN && !__DEV__) {
        Sentry.setUser(null);
      }
    }
    return () => { socketClient.disconnect(); };
  }, [status]);

  useEffect(() => {
    const initPushNotifications = async () => {
      await ExpoPushNotificationService.registerForPushNotificationsAsync();
    };

    initPushNotifications();
    const unsubscribe = ExpoPushNotificationService.addNotificationListeners();

    return () => {
      unsubscribe();
    };
  }, []);

  if (status === 'LOADING') {
    return <LoadingScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <RootNavigator />
      <OfflineBanner />
      <PendingPaymentTracker />
      <Toast />
    </View>
  );
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<LoadingScreen />} persistor={persistor}>
        <SafeAreaProvider>
          <ErrorBoundary>
            <AppContent />
          </ErrorBoundary>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
}

export default __DEV__ ? App : Sentry.wrap(App);
