/**
 * Database Helpers Tests
 * 
 * Tests for timeout wrapper and circuit breaker functionality
 */

import {
  withTimeout,
  withCircuitBreaker,
  getCircuitBreakerStatus,
  resetCircuitBreaker,
} from '../dbHelpers';

describe('Database Helpers', () => {
  beforeEach(() => {
    resetCircuitBreaker();
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes within timeout', async () => {
      const fastPromise = Promise.resolve('success');
      const result = await withTimeout(fastPromise, 1000, 'Test operation');
      expect(result).toBe('success');
    });

    it('should reject if promise exceeds timeout', async () => {
      const slowPromise = new Promise((resolve) =>
        setTimeout(() => resolve('too late'), 3000)
      );

      await expect(
        withTimeout(slowPromise, 100, 'Slow operation')
      ).rejects.toThrow('Slow operation timeout after 100ms');
    });

    it('should use default timeout of 2000ms', async () => {
      const slowPromise = new Promise((resolve) =>
        setTimeout(() => resolve('done'), 2500)
      );

      await expect(withTimeout(slowPromise)).rejects.toThrow(
        'Operation timeout after 2000ms'
      );
    });
  });

  describe('withCircuitBreaker', () => {
    it('should allow requests when circuit is closed', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const result = await withCircuitBreaker(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should reset failure count on success', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      // Simulate some failures first
      for (let i = 0; i < 3; i++) {
        await withCircuitBreaker(() => Promise.reject(new Error('fail')));
      }

      // Success should reset
      await withCircuitBreaker(mockFn);

      const status = getCircuitBreakerStatus();
      expect(status.failureCount).toBe(0);
      expect(status.isOpen).toBe(false);
    });

    it('should open circuit after 5 consecutive failures', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('DB down'));

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        await withCircuitBreaker(mockFn);
      }

      const status = getCircuitBreakerStatus();
      expect(status.failureCount).toBe(5);
      expect(status.isOpen).toBe(true);
    });

    it('should skip DB calls when circuit is open', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('DB down'));

      // Open the circuit (5 failures)
      for (let i = 0; i < 5; i++) {
        await withCircuitBreaker(mockFn);
      }

      // Reset mock to track new calls
      mockFn.mockClear();

      // Try another call - should NOT call mockFn
      const result = await withCircuitBreaker(mockFn);

      expect(result).toBeNull();
      expect(mockFn).not.toHaveBeenCalled(); // Circuit is open, DB skipped
    });

    it('should return null on timeout', async () => {
      const slowFn = () =>
        new Promise((resolve) => setTimeout(() => resolve('done'), 3000));

      const result = await withCircuitBreaker(slowFn);

      expect(result).toBeNull();
    });

    it('should close circuit after cooldown period', async () => {
      jest.useFakeTimers();

      const mockFn = jest.fn().mockRejectedValue(new Error('DB down'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await withCircuitBreaker(mockFn);
      }

      expect(getCircuitBreakerStatus().isOpen).toBe(true);

      // Fast-forward 30 seconds
      jest.advanceTimersByTime(30000);

      // Circuit should be closed now
      expect(getCircuitBreakerStatus().isOpen).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('should return correct status when circuit is closed', () => {
      const status = getCircuitBreakerStatus();

      expect(status.failureCount).toBe(0);
      expect(status.isOpen).toBe(false);
      expect(status.timeUntilRetry).toBe(0);
    });

    it('should return correct status when circuit is open', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open circuit
      for (let i = 0; i < 5; i++) {
        await withCircuitBreaker(mockFn);
      }

      const status = getCircuitBreakerStatus();

      expect(status.failureCount).toBe(5);
      expect(status.isOpen).toBe(true);
      expect(status.timeUntilRetry).toBeGreaterThan(0);
      expect(status.timeUntilRetry).toBeLessThanOrEqual(30000);
    });
  });

  describe('resetCircuitBreaker', () => {
    it('should reset failure count and close circuit', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

      // Open circuit
      for (let i = 0; i < 5; i++) {
        await withCircuitBreaker(mockFn);
      }

      expect(getCircuitBreakerStatus().isOpen).toBe(true);

      // Reset
      resetCircuitBreaker();

      const status = getCircuitBreakerStatus();
      expect(status.failureCount).toBe(0);
      expect(status.isOpen).toBe(false);
    });
  });
});
