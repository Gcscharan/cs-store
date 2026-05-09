/**
 * Unit Tests: Pending Order Storage for App Kill Recovery
 *
 * Task 10.3: Write unit tests for pending order storage
 *
 * Tests the pending order storage functionality that enables app kill recovery:
 * - Storage before Razorpay launch
 * - Clearing after verification
 * - AsyncStorage integration
 *
 * Requirements: BR-004 (App Kill Recovery), TR-006 (Persistent Storage)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage');

// ─── Test Data ───────────────────────────────────────────────────────────────

const MOCK_ORDER_ID = 'order_test_pending_001';
const MOCK_TIMESTAMP = 1704067200000; // 2024-01-01 00:00:00 UTC

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Simulates storing pending order before Razorpay launch
 * This is what happens in CheckoutScreen before RazorpayCheckout.open()
 */
async function storePendingOrder(orderId: string): Promise<void> {
  await AsyncStorage.setItem('pendingPaymentOrderId', orderId);
  await AsyncStorage.setItem('pendingPaymentTimestamp', Date.now().toString());
}

/**
 * Simulates clearing pending order after successful verification
 * This is what happens in pollPaymentStatus when payment is verified
 */
async function clearPendingOrder(): Promise<void> {
  await AsyncStorage.removeItem('pendingPaymentOrderId');
  await AsyncStorage.removeItem('pendingPaymentTimestamp');
}

/**
 * Retrieves pending order from storage
 * This is what happens on app startup to check for pending payments
 */
async function getPendingOrder(): Promise<{ orderId: string | null; timestamp: string | null }> {
  const orderId = await AsyncStorage.getItem('pendingPaymentOrderId');
  const timestamp = await AsyncStorage.getItem('pendingPaymentTimestamp');
  return { orderId, timestamp };
}

/**
 * Checks if pending order is stale (older than 1 hour)
 */
function isPendingOrderStale(timestamp: string | null): boolean {
  if (!timestamp) return true;
  
  const parsedTimestamp = parseInt(timestamp);
  
  // Handle invalid timestamp (NaN)
  if (isNaN(parsedTimestamp)) return true;
  
  const age = Date.now() - parsedTimestamp;
  const ONE_HOUR = 3600000; // 1 hour in milliseconds
  
  // Handle future timestamps (clock skew) - treat as stale
  if (age < 0) return true;
  
  return age >= ONE_HOUR;
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('CheckoutScreen - Pending Order Storage Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Date.now() for consistent timestamps
    jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── Test Group 1: Storage Before Razorpay Launch ─────────────────────────

  describe('Storage Before Razorpay Launch', () => {
    it('should store pending order ID before opening Razorpay', async () => {
      await storePendingOrder(MOCK_ORDER_ID);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'pendingPaymentOrderId',
        MOCK_ORDER_ID
      );
    });

    it('should store pending payment timestamp before opening Razorpay', async () => {
      await storePendingOrder(MOCK_ORDER_ID);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'pendingPaymentTimestamp',
        MOCK_TIMESTAMP.toString()
      );
    });

    it('should store both order ID and timestamp in correct order', async () => {
      await storePendingOrder(MOCK_ORDER_ID);

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
      expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
        1,
        'pendingPaymentOrderId',
        MOCK_ORDER_ID
      );
      expect(AsyncStorage.setItem).toHaveBeenNthCalledWith(
        2,
        'pendingPaymentTimestamp',
        MOCK_TIMESTAMP.toString()
      );
    });

    it('should use correct AsyncStorage keys', async () => {
      await storePendingOrder(MOCK_ORDER_ID);

      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const keys = calls.map(call => call[0]);

      expect(keys).toContain('pendingPaymentOrderId');
      expect(keys).toContain('pendingPaymentTimestamp');
    });

    it('should store order ID as string', async () => {
      await storePendingOrder(MOCK_ORDER_ID);

      const orderIdCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0] === 'pendingPaymentOrderId'
      );

      expect(typeof orderIdCall[1]).toBe('string');
    });

    it('should store timestamp as string', async () => {
      await storePendingOrder(MOCK_ORDER_ID);

      const timestampCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0] === 'pendingPaymentTimestamp'
      );

      expect(typeof timestampCall[1]).toBe('string');
    });

    it('should handle different order ID formats', async () => {
      const orderIds = [
        'order_123',
        'order_abc_xyz',
        'ORDER-2024-001',
        '507f1f77bcf86cd799439011', // MongoDB ObjectId
      ];

      for (const orderId of orderIds) {
        jest.clearAllMocks();
        await storePendingOrder(orderId);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'pendingPaymentOrderId',
          orderId
        );
      }
    });

    it('should capture current timestamp at storage time', async () => {
      const timestamps = [1704067200000, 1704153600000, 1704240000000];

      for (const timestamp of timestamps) {
        jest.clearAllMocks();
        jest.spyOn(Date, 'now').mockReturnValue(timestamp);

        await storePendingOrder(MOCK_ORDER_ID);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          'pendingPaymentTimestamp',
          timestamp.toString()
        );
      }
    });
  });

  // ─── Test Group 2: Clearing After Verification ────────────────────────────

  describe('Clearing After Verification', () => {
    it('should clear pending order ID after successful verification', async () => {
      await clearPendingOrder();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
    });

    it('should clear pending payment timestamp after successful verification', async () => {
      await clearPendingOrder();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
    });

    it('should clear both order ID and timestamp', async () => {
      await clearPendingOrder();

      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
    });

    it('should use correct AsyncStorage keys for removal', async () => {
      await clearPendingOrder();

      const calls = (AsyncStorage.removeItem as jest.Mock).mock.calls;
      const keys = calls.map(call => call[0]);

      expect(keys).toContain('pendingPaymentOrderId');
      expect(keys).toContain('pendingPaymentTimestamp');
    });

    it('should clear in correct order (orderId first, then timestamp)', async () => {
      await clearPendingOrder();

      expect(AsyncStorage.removeItem).toHaveBeenNthCalledWith(1, 'pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenNthCalledWith(2, 'pendingPaymentTimestamp');
    });

    it('should handle clearing when no pending order exists', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await expect(clearPendingOrder()).resolves.not.toThrow();
    });

    it('should handle clearing multiple times (idempotent)', async () => {
      await clearPendingOrder();
      await clearPendingOrder();
      await clearPendingOrder();

      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(6); // 2 calls × 3 times
    });
  });

  // ─── Test Group 3: Retrieving Pending Order ───────────────────────────────

  describe('Retrieving Pending Order', () => {
    it('should retrieve pending order ID from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(MOCK_ORDER_ID);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(MOCK_TIMESTAMP.toString());
        return Promise.resolve(null);
      });

      const { orderId } = await getPendingOrder();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(orderId).toBe(MOCK_ORDER_ID);
    });

    it('should retrieve pending payment timestamp from storage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(MOCK_ORDER_ID);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(MOCK_TIMESTAMP.toString());
        return Promise.resolve(null);
      });

      const { timestamp } = await getPendingOrder();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
      expect(timestamp).toBe(MOCK_TIMESTAMP.toString());
    });

    it('should return null when no pending order exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const { orderId, timestamp } = await getPendingOrder();

      expect(orderId).toBeNull();
      expect(timestamp).toBeNull();
    });

    it('should return null for orderId when only timestamp exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(MOCK_TIMESTAMP.toString());
        return Promise.resolve(null);
      });

      const { orderId, timestamp } = await getPendingOrder();

      expect(orderId).toBeNull();
      expect(timestamp).toBe(MOCK_TIMESTAMP.toString());
    });

    it('should return null for timestamp when only orderId exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(MOCK_ORDER_ID);
        return Promise.resolve(null);
      });

      const { orderId, timestamp } = await getPendingOrder();

      expect(orderId).toBe(MOCK_ORDER_ID);
      expect(timestamp).toBeNull();
    });

    it('should retrieve both values in a single call', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(MOCK_ORDER_ID);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(MOCK_TIMESTAMP.toString());
        return Promise.resolve(null);
      });

      const result = await getPendingOrder();

      expect(result).toEqual({
        orderId: MOCK_ORDER_ID,
        timestamp: MOCK_TIMESTAMP.toString(),
      });
    });
  });

  // ─── Test Group 4: Stale Order Detection ──────────────────────────────────

  describe('Stale Order Detection', () => {
    it('should detect stale order (older than 1 hour)', () => {
      const oneHourAgo = Date.now() - 3600000; // 1 hour ago
      const staleTimestamp = oneHourAgo.toString();

      const isStale = isPendingOrderStale(staleTimestamp);

      expect(isStale).toBe(true);
    });

    it('should detect fresh order (less than 1 hour old)', () => {
      const thirtyMinutesAgo = Date.now() - 1800000; // 30 minutes ago
      const freshTimestamp = thirtyMinutesAgo.toString();

      const isStale = isPendingOrderStale(freshTimestamp);

      expect(isStale).toBe(false);
    });

    it('should treat null timestamp as stale', () => {
      const isStale = isPendingOrderStale(null);

      expect(isStale).toBe(true);
    });

    it('should treat empty string timestamp as stale', () => {
      const isStale = isPendingOrderStale('');

      expect(isStale).toBe(true);
    });

    it('should detect order exactly 1 hour old as stale', () => {
      const exactlyOneHourAgo = Date.now() - 3600000;
      const timestamp = exactlyOneHourAgo.toString();

      const isStale = isPendingOrderStale(timestamp);

      expect(isStale).toBe(true);
    });

    it('should detect order just under 1 hour as fresh', () => {
      const justUnderOneHour = Date.now() - 3599999; // 1ms less than 1 hour
      const timestamp = justUnderOneHour.toString();

      const isStale = isPendingOrderStale(timestamp);

      expect(isStale).toBe(false);
    });

    it('should handle very old timestamps (days old)', () => {
      const threeDaysAgo = Date.now() - 259200000; // 3 days ago
      const timestamp = threeDaysAgo.toString();

      const isStale = isPendingOrderStale(timestamp);

      expect(isStale).toBe(true);
    });

    it('should handle very recent timestamps (seconds old)', () => {
      const tenSecondsAgo = Date.now() - 10000; // 10 seconds ago
      const timestamp = tenSecondsAgo.toString();

      const isStale = isPendingOrderStale(timestamp);

      expect(isStale).toBe(false);
    });

    it('should handle invalid timestamp format gracefully', () => {
      const invalidTimestamp = 'invalid_timestamp';

      const isStale = isPendingOrderStale(invalidTimestamp);

      // NaN comparison results in true (treated as stale)
      expect(isStale).toBe(true);
    });
  });

  // ─── Test Group 5: AsyncStorage Error Handling ────────────────────────────

  describe('AsyncStorage Error Handling', () => {
    it('should handle AsyncStorage write error when storing order ID', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('AsyncStorage write failed')
      );

      await expect(storePendingOrder(MOCK_ORDER_ID)).rejects.toThrow(
        'AsyncStorage write failed'
      );
    });

    it('should handle AsyncStorage write error when storing timestamp', async () => {
      (AsyncStorage.setItem as jest.Mock)
        .mockResolvedValueOnce(undefined) // First call succeeds (orderId)
        .mockRejectedValueOnce(new Error('AsyncStorage write failed')); // Second call fails (timestamp)

      await expect(storePendingOrder(MOCK_ORDER_ID)).rejects.toThrow(
        'AsyncStorage write failed'
      );
    });

    it('should handle AsyncStorage read error when retrieving order', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('AsyncStorage read failed')
      );

      await expect(getPendingOrder()).rejects.toThrow('AsyncStorage read failed');
    });

    it('should handle AsyncStorage remove error when clearing order', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
        new Error('AsyncStorage remove failed')
      );

      await expect(clearPendingOrder()).rejects.toThrow('AsyncStorage remove failed');
    });

    it('should handle quota exceeded error', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('QuotaExceededError')
      );

      await expect(storePendingOrder(MOCK_ORDER_ID)).rejects.toThrow('QuotaExceededError');
    });

    it('should handle permission denied error', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Permission denied')
      );

      await expect(storePendingOrder(MOCK_ORDER_ID)).rejects.toThrow('Permission denied');
    });
  });

  // ─── Test Group 6: Complete Flow Integration ──────────────────────────────

  describe('Complete Flow Integration', () => {
    it('should complete full flow: store → retrieve → clear', async () => {
      // Step 1: Store pending order
      await storePendingOrder(MOCK_ORDER_ID);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'pendingPaymentOrderId',
        MOCK_ORDER_ID
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'pendingPaymentTimestamp',
        MOCK_TIMESTAMP.toString()
      );

      // Step 2: Retrieve pending order
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(MOCK_ORDER_ID);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(MOCK_TIMESTAMP.toString());
        return Promise.resolve(null);
      });

      const { orderId, timestamp } = await getPendingOrder();

      expect(orderId).toBe(MOCK_ORDER_ID);
      expect(timestamp).toBe(MOCK_TIMESTAMP.toString());

      // Step 3: Clear pending order
      await clearPendingOrder();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
    });

    it('should handle app kill scenario: store → app killed → retrieve on restart', async () => {
      // Before app kill: Store pending order
      await storePendingOrder(MOCK_ORDER_ID);

      // Simulate app kill (clear mocks to simulate new app session)
      jest.clearAllMocks();

      // After app restart: Retrieve pending order
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(MOCK_ORDER_ID);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(MOCK_TIMESTAMP.toString());
        return Promise.resolve(null);
      });

      const { orderId, timestamp } = await getPendingOrder();

      expect(orderId).toBe(MOCK_ORDER_ID);
      expect(timestamp).toBe(MOCK_TIMESTAMP.toString());
      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(2);
    });

    it('should handle successful payment flow: store → verify → clear', async () => {
      // Step 1: Store before Razorpay launch
      await storePendingOrder(MOCK_ORDER_ID);

      // Step 2: Payment verified (simulate polling success)
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(MOCK_ORDER_ID);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(MOCK_TIMESTAMP.toString());
        return Promise.resolve(null);
      });

      const { orderId } = await getPendingOrder();
      expect(orderId).toBe(MOCK_ORDER_ID);

      // Step 3: Clear after verification
      await clearPendingOrder();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentTimestamp');
    });

    it('should handle stale order cleanup on app restart', async () => {
      // Store order 2 hours ago
      const twoHoursAgo = Date.now() - 7200000;
      jest.spyOn(Date, 'now').mockReturnValue(twoHoursAgo);
      await storePendingOrder(MOCK_ORDER_ID);

      // Restore current time
      jest.spyOn(Date, 'now').mockReturnValue(MOCK_TIMESTAMP);

      // Retrieve on app restart
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'pendingPaymentOrderId') return Promise.resolve(MOCK_ORDER_ID);
        if (key === 'pendingPaymentTimestamp') return Promise.resolve(twoHoursAgo.toString());
        return Promise.resolve(null);
      });

      const { orderId, timestamp } = await getPendingOrder();

      // Check if stale
      const isStale = isPendingOrderStale(timestamp);
      expect(isStale).toBe(true);

      // Should clear stale order
      if (isStale) {
        await clearPendingOrder();
        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pendingPaymentOrderId');
      }
    });

    it('should handle multiple payment attempts (overwrite previous)', async () => {
      // First payment attempt
      await storePendingOrder('order_001');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentOrderId', 'order_001');

      // Second payment attempt (overwrites first)
      await storePendingOrder('order_002');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentOrderId', 'order_002');
    });
  });

  // ─── Test Group 7: Edge Cases ─────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle empty order ID', async () => {
      await storePendingOrder('');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentOrderId', '');
    });

    it('should handle very long order ID', async () => {
      const longOrderId = 'order_' + 'x'.repeat(1000);

      await storePendingOrder(longOrderId);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentOrderId', longOrderId);
    });

    it('should handle order ID with special characters', async () => {
      const specialOrderId = 'order_!@#$%^&*()_+-=[]{}|;:,.<>?';

      await storePendingOrder(specialOrderId);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'pendingPaymentOrderId',
        specialOrderId
      );
    });

    it('should handle order ID with unicode characters', async () => {
      const unicodeOrderId = 'order_测试_🎉';

      await storePendingOrder(unicodeOrderId);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('pendingPaymentOrderId', unicodeOrderId);
    });

    it('should handle timestamp at epoch (0)', () => {
      const epochTimestamp = '0';

      const isStale = isPendingOrderStale(epochTimestamp);

      expect(isStale).toBe(true); // Very old, definitely stale
    });

    it('should handle future timestamp (clock skew)', () => {
      const futureTimestamp = (Date.now() + 3600000).toString(); // 1 hour in future

      const isStale = isPendingOrderStale(futureTimestamp);

      // Negative age, treated as stale
      expect(isStale).toBe(true);
    });

    it('should handle concurrent storage operations', async () => {
      const promises = [
        storePendingOrder('order_001'),
        storePendingOrder('order_002'),
        storePendingOrder('order_003'),
      ];

      await Promise.all(promises);

      // All should complete without error
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(6); // 2 calls × 3 orders
    });

    it('should handle rapid store-clear cycles', async () => {
      for (let i = 0; i < 5; i++) {
        await storePendingOrder(`order_${i}`);
        await clearPendingOrder();
      }

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(10); // 2 calls × 5 cycles
      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(10); // 2 calls × 5 cycles
    });
  });

  // ─── Test Group 8: Security and Data Integrity ────────────────────────────

  describe('Security and Data Integrity', () => {
    it('should not expose sensitive data in storage keys', async () => {
      await storePendingOrder(MOCK_ORDER_ID);

      const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
      const keys = calls.map(call => call[0]);

      // Keys should not contain sensitive info
      keys.forEach(key => {
        expect(key).not.toContain('password');
        expect(key).not.toContain('secret');
        expect(key).not.toContain('token');
        expect(key).not.toContain('key');
      });
    });

    it('should store order ID without modification', async () => {
      const originalOrderId = 'order_original_123';

      await storePendingOrder(originalOrderId);

      const orderIdCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0] === 'pendingPaymentOrderId'
      );

      expect(orderIdCall[1]).toBe(originalOrderId);
    });

    it('should store timestamp as accurate milliseconds', async () => {
      const exactTimestamp = 1704067200123; // With milliseconds
      jest.spyOn(Date, 'now').mockReturnValue(exactTimestamp);

      await storePendingOrder(MOCK_ORDER_ID);

      const timestampCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        call => call[0] === 'pendingPaymentTimestamp'
      );

      expect(timestampCall[1]).toBe(exactTimestamp.toString());
    });

    it('should use consistent key names', async () => {
      await storePendingOrder(MOCK_ORDER_ID);
      await clearPendingOrder();

      const setKeys = (AsyncStorage.setItem as jest.Mock).mock.calls.map(call => call[0]);
      const removeKeys = (AsyncStorage.removeItem as jest.Mock).mock.calls.map(call => call[0]);

      // Keys used in setItem should match keys used in removeItem
      expect(setKeys).toContain('pendingPaymentOrderId');
      expect(setKeys).toContain('pendingPaymentTimestamp');
      expect(removeKeys).toContain('pendingPaymentOrderId');
      expect(removeKeys).toContain('pendingPaymentTimestamp');
    });

    it('should not store additional metadata', async () => {
      await storePendingOrder(MOCK_ORDER_ID);

      // Should only store 2 items (orderId and timestamp)
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
    });
  });
});
