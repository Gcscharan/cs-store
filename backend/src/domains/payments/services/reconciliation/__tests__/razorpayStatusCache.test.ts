import { RazorpayStatusCache, RazorpayPaymentInfo } from '../razorpayStatusCache';

const makeInfo = (overrides: Partial<RazorpayPaymentInfo> = {}): RazorpayPaymentInfo => ({
  status: 'captured',
  captured: true,
  authorized: false,
  paymentId: 'pay_test123',
  capturedAt: new Date('2024-01-01T00:00:00.000Z'),
  amountPaise: 50000,
  ...overrides,
});

describe('RazorpayStatusCache', () => {
  describe('constructor', () => {
    it('creates a cache with the default 5-minute TTL', () => {
      const cache = new RazorpayStatusCache();
      expect(cache.size).toBe(0);
    });

    it('accepts a custom TTL', () => {
      const cache = new RazorpayStatusCache(10_000);
      expect(cache.size).toBe(0);
    });

    it('throws RangeError when ttlMs < 1', () => {
      expect(() => new RazorpayStatusCache(0)).toThrow(RangeError);
      expect(() => new RazorpayStatusCache(-1)).toThrow(RangeError);
    });
  });

  describe('get / set', () => {
    it('returns null for an unknown key', () => {
      const cache = new RazorpayStatusCache();
      expect(cache.get('order_unknown')).toBeNull();
    });

    it('returns the stored value immediately after set', () => {
      const cache = new RazorpayStatusCache();
      const info = makeInfo();
      cache.set('order_abc', info);
      expect(cache.get('order_abc')).toEqual(info);
    });

    it('returns null after the TTL has elapsed', () => {
      jest.useFakeTimers();
      const cache = new RazorpayStatusCache(1_000); // 1 second TTL
      const info = makeInfo();
      cache.set('order_abc', info);

      // Still valid just before expiry
      jest.advanceTimersByTime(999);
      expect(cache.get('order_abc')).toEqual(info);

      // Expired one millisecond past TTL (condition is Date.now() > expiresAt)
      jest.advanceTimersByTime(2);
      expect(cache.get('order_abc')).toBeNull();

      jest.useRealTimers();
    });

    it('evicts the expired entry from the map on access', () => {
      jest.useFakeTimers();
      const cache = new RazorpayStatusCache(500);
      cache.set('order_abc', makeInfo());
      expect(cache.size).toBe(1);

      jest.advanceTimersByTime(501);
      cache.get('order_abc'); // triggers lazy eviction
      expect(cache.size).toBe(0);

      jest.useRealTimers();
    });

    it('overwrites an existing entry for the same key', () => {
      const cache = new RazorpayStatusCache();
      const first = makeInfo({ amountPaise: 10000 });
      const second = makeInfo({ amountPaise: 20000 });

      cache.set('order_abc', first);
      cache.set('order_abc', second);

      expect(cache.get('order_abc')).toEqual(second);
      expect(cache.size).toBe(1);
    });

    it('stores multiple independent keys', () => {
      const cache = new RazorpayStatusCache();
      const a = makeInfo({ paymentId: 'pay_a' });
      const b = makeInfo({ paymentId: 'pay_b', status: 'authorized', captured: false, authorized: true });

      cache.set('order_a', a);
      cache.set('order_b', b);

      expect(cache.get('order_a')).toEqual(a);
      expect(cache.get('order_b')).toEqual(b);
      expect(cache.size).toBe(2);
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      const cache = new RazorpayStatusCache();
      cache.set('order_a', makeInfo());
      cache.set('order_b', makeInfo());
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('order_a')).toBeNull();
      expect(cache.get('order_b')).toBeNull();
    });

    it('is safe to call on an empty cache', () => {
      const cache = new RazorpayStatusCache();
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('size', () => {
    it('reflects the number of stored entries', () => {
      const cache = new RazorpayStatusCache();
      expect(cache.size).toBe(0);
      cache.set('order_1', makeInfo());
      expect(cache.size).toBe(1);
      cache.set('order_2', makeInfo());
      expect(cache.size).toBe(2);
      cache.clear();
      expect(cache.size).toBe(0);
    });
  });
});
