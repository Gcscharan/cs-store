// Jest setup file
import '@testing-library/react-native/extend-expect';

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock Animated
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
