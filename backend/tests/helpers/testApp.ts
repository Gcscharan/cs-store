import { createApp } from '../../src/createApp';
import { Application } from 'express';
import { mockPincodeResolution } from './mocks';

// Initialize mocks before creating the app
mockPincodeResolution();

export function createTestApp(): Application {
  // Create app with all external dependencies disabled
  return createApp({
    enableQueues: false,
    enableRedis: false,
    enableExternalAPIs: false,
    enableSentry: false,
    enableAuth: true, // Keep auth for testing user flows
  });
}

export { createTestApp as app };
export default createTestApp;