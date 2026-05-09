// Jest setup file
import '@testing-library/react-native/extend-expect';
import { configure } from '@testing-library/react-native';

// Configure @testing-library/react-native to skip host component detection
// (required when using jsdom environment instead of react-native environment)
configure({
  hostComponentNames: {
    text: 'Text',
    textInput: 'TextInput',
    image: 'Image',
    switch: 'Switch',
    scrollView: 'ScrollView',
    modal: 'Modal',
  },
});

// Polyfill TextEncoder/TextDecoder for Node.js environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock Platform (must be before React Navigation)
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj) => obj.ios || obj.default),
  Version: 14,
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    setOptions: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
    key: 'test-route',
    name: 'TestScreen',
  }),
  useFocusEffect: jest.fn(),
  useIsFocused: jest.fn(() => true),
  NavigationContainer: ({ children }) => children,
  createNavigationContainerRef: jest.fn(),
}));

// Mock Socket.IO
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
    id: 'mock-socket-id',
  })),
}));

// Mock Expo modules
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Dimensions
jest.mock('react-native/Libraries/Utilities/Dimensions', () => ({
  get: jest.fn(() => ({ width: 375, height: 812 })),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock PixelRatio (required for StyleSheet.create in jsdom environment)
jest.mock('react-native/Libraries/Utilities/PixelRatio', () => {
  const pixelRatio = {
    get: jest.fn(() => 2),
    getFontScale: jest.fn(() => 1),
    getPixelSizeForLayoutSize: jest.fn((size) => size * 2),
    roundToNearestPixel: jest.fn((size) => Math.round(size * 2) / 2),
  };
  return { default: pixelRatio, ...pixelRatio };
});

// Mock Firebase
jest.mock('@react-native-firebase/app', () => ({
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
  firebase: {
    app: jest.fn(),
  },
  utils: {},
  default: jest.fn(),
}));

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => ({
    logEvent: jest.fn(),
  })),
  logEvent: jest.fn(),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: jest.fn(),
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
  brand: 'Apple',
  manufacturer: 'Apple',
  modelName: 'iPhone',
  osName: 'iOS',
  osVersion: '14.0',
  deviceYearClass: 2020,
}));

// Mock expo-modules-core
jest.mock('expo-modules-core', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default),
  },
  requireNativeModule: jest.fn(),
  requireOptionalNativeModule: jest.fn(),
  NativeModulesProxy: {},
}));

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: {
      latitude: 37.78825,
      longitude: -122.4324,
      altitude: 0,
      accuracy: 5,
      altitudeAccuracy: 5,
      heading: 0,
      speed: 0,
    },
    timestamp: Date.now(),
  })),
  reverseGeocodeAsync: jest.fn(() => Promise.resolve([{
    city: 'San Francisco',
    country: 'United States',
    district: 'CA',
    isoCountryCode: 'US',
    name: 'San Francisco',
    postalCode: '94102',
    region: 'CA',
    street: 'Market St',
    subregion: 'San Francisco County',
    timezone: 'America/Los_Angeles',
  }])),
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
}));
