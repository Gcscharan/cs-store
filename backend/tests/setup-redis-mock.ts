/**
 * Redis Mock Initialization
 * 
 * CRITICAL: This file MUST be loaded FIRST before any other test code.
 * It initializes the global Redis mock stores that are used by jest.mock("redis").
 * 
 * Loading order (configured in jest.config.js):
 * 1. setup-redis-mock.ts (this file) - Initialize stores
 * 2. setup.ts - Define jest.mock("redis") using the stores
 * 3. setup-globals.ts - Test helpers and lifecycle hooks
 */

const g = globalThis as any;

// Initialize Redis mock stores IMMEDIATELY
if (!g.__redisKv) {
  g.__redisKv = new Map<string, string>();
}

if (!g.__redisExpiries) {
  g.__redisExpiries = new Map<string, number>();
}

// Reset function for beforeEach cleanup
g.__resetRedisMockStore = () => {
  try {
    (g.__redisKv as Map<string, string>).clear();
    (g.__redisExpiries as Map<string, number>).clear();
  } catch {
    // ignore
  }
};

// Export for use in setup.ts
export const __redisKv = g.__redisKv as Map<string, string>;
export const __redisExpiries = g.__redisExpiries as Map<string, number>;
export const __resetRedisMockStore = g.__resetRedisMockStore;

// Log initialization (helps debug test setup issues)
if (process.env.DEBUG_TESTS) {
  console.log('[Redis Mock] Initialized global stores');
  console.log('[Redis Mock] __redisKv:', typeof g.__redisKv);
  console.log('[Redis Mock] __redisExpiries:', typeof g.__redisExpiries);
}
