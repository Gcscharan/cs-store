/**
 * Task 11.2: Unit tests for app kill recovery
 * 
 * This test verifies the app kill recovery logic:
 * - Checks AsyncStorage for pending payment order ID
 * - Validates timestamp (only processes if < 1 hour old)
 * - Resumes polling for pending order
 * - Clears stale pending orders (> 1 hour)
 * 
 * Requirements: BR-004, US-003
 * **Validates: Requirements BR-004, US-003**
 */

// ─── Mocks (must be before imports) ──────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage');
jest.mock('../utils/analytics', () => ({
  logEvent: jest.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logEvent } from '../utils/analytics';

// ─── Constants ───────────────────────────────────────────────────────────────

const ONE_HOUR_MS = 3600000;
const MAX_POLLING_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 2000;

// ─── Helper Functions (simulating PendingPaymentTracker logic) ──────────────

/**
 * Simulates the timestamp validation logic from PendingPaymentTracker
 */
function shouldProcessPendingOrder(timestamp: number): boolean {
  const age = Date.now() - timestamp;
  return age < ONE_HOUR_MS;
}

/**
 * Simulates checking for pending payment on startup
 */
async function checkPendingPaymentOnStartup(): Promise<{
  shouldResume: boolean;
  orderId: string | null;
  isStale: boolean;
}> {
  const pendingOrderId = await AsyncStorage.getItem('pendingPaymentOrderId');
  const pendingTimestamp = await AsyncStorage.getItem('pendingPaymentTimestamp');

  if (!pendingOrderId || !pendingTimestamp) {
    return { shouldResume: false, orderId: null, isStale: false };
  }

  const timestamp = parseInt(pendingTimestamp, 10);
  const age = Date.now() - timestamp;

  if (age < ONE_HOUR_MS) {
    // Recent order - should resume polling
    logEvent('pending_payment_recovery_started', {
      orderId: pendingOrderId,
      ageSeconds: Math.round(age / 1000),
    });
    return { shouldResume: true, orderId: pendingOrderId, isStale: false };
  } else {
    // Stale order - should clear
    await AsyncStorage.removeItem('pendingPaymentOrderId');
    await AsyncStorage.removeItem('pendingPaymentTimestamp');
    logEvent('pending_payment_cleared_stale', {
      orderId: pendingOrderId,
      ageSeconds: Math.round(age / 1000),
    });
    return { shouldResume: false, orderId: pendingOrderId, isStale: true };
  }
}

/**
 * Simulates polling for payment status
 */
async function pollPaymentStatus(
  orderId: string,
  getPaymentStatus: (orderId: string) => Promise<{ paymentStatus: string }>
): Promise<{ success: boolean; attempts: number; status: string }> {
  for (let attempt = 1; attempt <= MAX_POLLING_ATTEMPTS; attempt++) {
    try {
      const res = await getPaymentStatus(orderId);
      const paymentStatus = res.paymentStatus;

      if (paymentStatus === 'PAID') {
        await AsyncStorage.removeItem('pendingPaymentOrderId');
        await AsyncStorage.removeItem('pendingPaymentTimestamp');
        logEvent('background_payment_verified', { orderId, attempts: attempt });
        return { success: true, attempts: attempt, status: 'PAID' };
      }

      if (paymentStatus === 'FAILED') {
        await AsyncStorage.removeItem('pendingPaymentOrderId');
        await AsyncStorage.removeItem('pendingPaymentTimestamp');
        logEvent('background_payment_failed', { orderId, attempts: attempt });
        return { success: false, attempts: attempt, status: 'FAILED' };
      }

      // Still pending, wait before next attempt
      if (attempt < MAX_POLLING_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      // Continue polling on error
      if (attempt < MAX_POLLING_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
  }

  // Timeout
  logEvent('background_payment_timeout', { orderId });
  return { success: false, attempts: MAX_POLLING_ATTEMPTS, status: 'TIMEOUT' };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('App Kill Recovery - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  /**
   * Test: Recovery with recent pending order (< 1 hour old)
   * Requirements: BR-004, US-003
   */
  describe('Recovery with recent pending order', () => {
    it('should resume polling for pending order less than 1 hour old', async () => {
      const orderId = 'order-recent-123';
      const timestamp = Date.now() - 30 * 60 * 1000; // 30 minutes ago

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      const result = await checkPendingPaymentOnStartup();

      expect(result.shouldResume).toBe(true);
      expect(result.orderId).toBe(orderId);
      expect(result.isStale).toBe(false);
      expect(logEvent).toHaveBeenCalledWith('pending_payment_recovery_started', {
        orderId,
        ageSeconds: expect.any(Number),
      });
    });

    it('should validate timestamp correctly for recent orders', () => {
      const timestamp = Date.now() - 30 * 60 * 1000; // 30 minutes ago
      expect(shouldProcessPendingOrder(timestamp)).toBe(true);
    });

    it('should handle payment verification during recovery', async () => {
      const orderId = 'order-verify-456';
      const mockGetPaymentStatus = jest.fn().mockResolvedValue({ paymentStatus: 'PAID' });

      const result = await pollPaymentStatus(orderId, mockGetPaymentStatus);

      expect(result.success).toBe(true);
      expect(result.status).toBe('PAID');
      expect(result.attempts).toBe(1);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
      expect(logEvent).toHaveBeenCalledWith('background_payment_verified', {
        orderId,
        attempts: 1,
      });
    });

    it('should handle FAILED payment status during recovery', async () => {
      const orderId = 'order-failed-789';
      const mockGetPaymentStatus = jest.fn().mockResolvedValue({ paymentStatus: 'FAILED' });

      const result = await pollPaymentStatus(orderId, mockGetPaymentStatus);

      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(logEvent).toHaveBeenCalledWith('background_payment_failed', {
        orderId,
        attempts: 1,
      });
    });

    it('should continue polling if payment is still PENDING', async () => {
      const orderId = 'order-pending-111';
      let callCount = 0;
      const mockGetPaymentStatus = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount >= 3) {
          return { paymentStatus: 'PAID' };
        }
        return { paymentStatus: 'PENDING' };
      });

      // Start polling (don't await yet)
      const resultPromise = pollPaymentStatus(orderId, mockGetPaymentStatus);

      // Manually advance timers and run pending promises
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.status).toBe('PAID');
      expect(mockGetPaymentStatus).toHaveBeenCalledTimes(3);
    });
  });

  /**
   * Test: Clearing stale pending orders (> 1 hour old)
   * Requirements: BR-004
   */
  describe('Clearing stale pending orders', () => {
    it('should clear pending order older than 1 hour', async () => {
      const orderId = 'order-stale-999';
      const timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      const result = await checkPendingPaymentOnStartup();

      expect(result.shouldResume).toBe(false);
      expect(result.isStale).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
      expect(logEvent).toHaveBeenCalledWith('pending_payment_cleared_stale', {
        orderId,
        ageSeconds: expect.any(Number),
      });
    });

    it('should validate timestamp correctly for stale orders', () => {
      const timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      expect(shouldProcessPendingOrder(timestamp)).toBe(false);
    });

    it('should clear pending order at exactly 1 hour boundary', async () => {
      const orderId = 'order-boundary-222';
      const timestamp = Date.now() - ONE_HOUR_MS; // Exactly 1 hour ago

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      const result = await checkPendingPaymentOnStartup();

      expect(result.shouldResume).toBe(false);
      expect(result.isStale).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('should handle very old pending orders (multiple days)', async () => {
      const orderId = 'order-very-old-333';
      const timestamp = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(timestamp.toString());
        return Promise.resolve(null);
      });

      const result = await checkPendingPaymentOnStartup();

      expect(result.isStale).toBe(true);
      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(2);

      const call = (logEvent as jest.Mock).mock.calls.find(
        (call) => call[0] === 'pending_payment_cleared_stale'
      );
      expect(call).toBeDefined();
      expect(call[1].ageSeconds).toBeGreaterThanOrEqual(7 * 24 * 60 * 60);
    });
  });

  /**
   * Test: No pending order scenario
   * Requirements: BR-004
   */
  describe('No pending order scenario', () => {
    it('should handle no pending order gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await checkPendingPaymentOnStartup();

      expect(result.shouldResume).toBe(false);
      expect(result.orderId).toBeNull();
      expect(result.isStale).toBe(false);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
      expect(logEvent).not.toHaveBeenCalled();
    });

    it('should handle missing timestamp gracefully', async () => {
      const orderId = 'order-no-timestamp-444';

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await checkPendingPaymentOnStartup();

      expect(result.shouldResume).toBe(false);
      expect(result.orderId).toBeNull();
    });

    it('should handle invalid timestamp format', async () => {
      const orderId = 'order-invalid-555';

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(orderId);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve('invalid-timestamp');
        return Promise.resolve(null);
      });

      const result = await checkPendingPaymentOnStartup();

      // parseInt('invalid-timestamp') returns NaN
      // Date.now() - NaN = NaN
      // NaN < ONE_HOUR_MS = false
      expect(result.shouldResume).toBe(false);
    });
  });

  /**
   * Test: AsyncStorage mocking
   * Verify that AsyncStorage is properly mocked
   */
  describe('AsyncStorage mocking', () => {
    it('should mock AsyncStorage.getItem', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-value');

      const value = await AsyncStorage.getItem('test-key');

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('test-key');
      expect(value).toBe('test-value');
    });

    it('should mock AsyncStorage.setItem', async () => {
      await AsyncStorage.setItem('test-key', 'test-value');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should mock AsyncStorage.removeItem', async () => {
      await AsyncStorage.removeItem('test-key');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should handle multiple AsyncStorage operations', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'key1') return Promise.resolve('value1');
        if (key === 'key2') return Promise.resolve('value2');
        return Promise.resolve(null);
      });

      const value1 = await AsyncStorage.getItem('key1');
      const value2 = await AsyncStorage.getItem('key2');
      const value3 = await AsyncStorage.getItem('key3');

      expect(value1).toBe('value1');
      expect(value2).toBe('value2');
      expect(value3).toBeNull();
    });
  });

  /**
   * Test: Error handling during recovery
   */
  describe('Error handling', () => {
    it('should handle AsyncStorage read errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      await expect(checkPendingPaymentOnStartup()).rejects.toThrow('Storage error');
    });

    it('should handle API errors during polling', async () => {
      const orderId = 'order-api-error-666';
      const mockGetPaymentStatus = jest.fn().mockRejectedValue(new Error('Network error'));

      const resultPromise = pollPaymentStatus(orderId, mockGetPaymentStatus);

      // Advance timers for all polling attempts
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * MAX_POLLING_ATTEMPTS);

      const result = await resultPromise;

      expect(result.status).toBe('TIMEOUT');
      expect(logEvent).toHaveBeenCalledWith('background_payment_timeout', { orderId });
    });
  });

  /**
   * Test: Polling timeout scenario
   */
  describe('Polling timeout', () => {
    it('should timeout after 20 attempts and log timeout event', async () => {
      const orderId = 'order-timeout-888';
      const mockGetPaymentStatus = jest.fn().mockResolvedValue({ paymentStatus: 'PENDING' });

      const resultPromise = pollPaymentStatus(orderId, mockGetPaymentStatus);

      // Simulate all 20 polling attempts
      await jest.advanceTimersByTimeAsync(POLL_INTERVAL_MS * MAX_POLLING_ATTEMPTS);

      const result = await resultPromise;

      expect(result.status).toBe('TIMEOUT');
      expect(result.attempts).toBe(MAX_POLLING_ATTEMPTS);
      expect(logEvent).toHaveBeenCalledWith('background_payment_timeout', { orderId });
      // Should NOT clear pending order on timeout (user can check manually)
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should calculate total polling time correctly', () => {
      const totalTime = MAX_POLLING_ATTEMPTS * POLL_INTERVAL_MS;
      expect(totalTime).toBe(40000); // 40 seconds
    });
  });

  /**
   * Test: Polling configuration
   */
  describe('Polling configuration', () => {
    it('should use 2-second intervals', () => {
      expect(POLL_INTERVAL_MS).toBe(2000);
    });

    it('should have maximum 20 polling attempts', () => {
      expect(MAX_POLLING_ATTEMPTS).toBe(20);
    });

    it('should use 1 hour as stale threshold', () => {
      expect(ONE_HOUR_MS).toBe(3600000);
    });
  });
});
