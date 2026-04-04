/**
 * Test App Configuration
 * 
 * This file provides a test-specific app instance with:
 * - Queues disabled (prevents setInterval hanging)
 * - Redis disabled (graceful fallback to in-memory)
 * - External APIs disabled (no real API calls)
 * - Sentry disabled (no error tracking in tests)
 * - Auth enabled (for authentication tests)
 * 
 * This prevents tests from hanging due to open handles from:
 * - Queue workers with setInterval
 * - Redis connections
 * - Background jobs
 */

import { createApp } from "../../src/createApp";

const testApp = createApp({
  enableQueues: false,
  enableRedis: false,
  enableExternalAPIs: false,
  enableSentry: false,
  enableAuth: true,
});

export default testApp;
