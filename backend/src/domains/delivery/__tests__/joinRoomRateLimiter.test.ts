/**
 * Unit tests for join_room rate limiter
 * Tests the in-memory rate limiting logic (max 10 calls per socket per minute)
 * Requirements: 7.7
 */

describe('join_room rate limiter logic', () => {
  // Replicate the rate limiter logic from index.ts for isolated testing
  function makeRateLimiter() {
    const joinRoomCounts = new Map<string, { count: number; resetAt: number }>();

    function checkRateLimit(socketId: string, now: number): boolean {
      const entry = joinRoomCounts.get(socketId) ?? { count: 0, resetAt: now + 60_000 };
      if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + 60_000;
      }
      entry.count++;
      joinRoomCounts.set(socketId, entry);
      return entry.count > 10; // true = rate limited (should be blocked)
    }

    function onDisconnect(socketId: string) {
      joinRoomCounts.delete(socketId);
    }

    function getEntry(socketId: string) {
      return joinRoomCounts.get(socketId);
    }

    return { checkRateLimit, onDisconnect, getEntry };
  }

  it('allows the first 10 join_room calls per minute', () => {
    const { checkRateLimit } = makeRateLimiter();
    const socketId = 'socket-1';
    const now = Date.now();

    for (let i = 1; i <= 10; i++) {
      const limited = checkRateLimit(socketId, now);
      expect(limited).toBe(false);
    }
  });

  it('silently ignores (rate limits) the 11th call and beyond', () => {
    const { checkRateLimit } = makeRateLimiter();
    const socketId = 'socket-2';
    const now = Date.now();

    // First 10 should pass
    for (let i = 0; i < 10; i++) {
      checkRateLimit(socketId, now);
    }

    // 11th call should be rate limited
    const limited = checkRateLimit(socketId, now);
    expect(limited).toBe(true);

    // 12th call should also be rate limited
    const limited2 = checkRateLimit(socketId, now);
    expect(limited2).toBe(true);
  });

  it('resets counter after 60 seconds', () => {
    const { checkRateLimit } = makeRateLimiter();
    const socketId = 'socket-3';
    const now = Date.now();

    // Exhaust the limit
    for (let i = 0; i < 10; i++) {
      checkRateLimit(socketId, now);
    }
    expect(checkRateLimit(socketId, now)).toBe(true); // 11th is blocked

    // Simulate 61 seconds later
    const later = now + 61_000;
    const limitedAfterReset = checkRateLimit(socketId, later);
    expect(limitedAfterReset).toBe(false); // counter reset, first call allowed
  });

  it('cleans up entry from map on disconnect', () => {
    const { checkRateLimit, onDisconnect, getEntry } = makeRateLimiter();
    const socketId = 'socket-4';
    const now = Date.now();

    checkRateLimit(socketId, now);
    expect(getEntry(socketId)).toBeDefined();

    onDisconnect(socketId);
    expect(getEntry(socketId)).toBeUndefined();
  });

  it('tracks counts independently per socket', () => {
    const { checkRateLimit } = makeRateLimiter();
    const now = Date.now();

    // Exhaust socket-A
    for (let i = 0; i < 10; i++) {
      checkRateLimit('socket-A', now);
    }
    expect(checkRateLimit('socket-A', now)).toBe(true); // A is limited

    // socket-B should still be allowed
    expect(checkRateLimit('socket-B', now)).toBe(false);
  });
});
