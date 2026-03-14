import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from './src/store';
import { RootNavigator } from './src/navigation/RootNavigator';
import { initI18n } from '@vyaparsetu/i18n';
import { useAuthBootstrap } from './src/hooks/useAuthBootstrap';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';

initI18n('en');

function AppContent() {
  useAuthBootstrap();
  return (
    <ErrorBoundary>
      <OfflineBanner />
      <RootNavigator />
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <AppContent />
        </SafeAreaProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
