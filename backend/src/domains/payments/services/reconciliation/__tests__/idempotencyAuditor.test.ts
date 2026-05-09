/**
 * Unit tests for the Idempotency Auditor
 *
 * Tests missing/malformed key detection, duplicate idempotency key detection,
 * cart-hash duplicate detection (within and beyond 5 min), and idempotency
 * via dedupeKey.
 *
 * Order.find, Order.aggregate, applyFix, and dbWriteLimiter are mocked —
 * no real MongoDB connection needed.
 *
 * Requirements: 4.3, 4.5, 4.7, 4.8, 4.9
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports
// ---------------------------------------------------------------------------

jest.mock('../../../../../models/Order');
jest.mock('../fixEngine');
jest.mock('../concurrencyLimiter', () => ({
  dbWriteLimiter: {
    run: jest.fn((fn) => fn()),
  },
  razorpayLimiter: {
    run: jest.fn((fn) => fn()),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import mongoose from 'mongoose';
import { Order } from '../../../../../models/Order';
import { applyFix } from '../fixEngine';
import { runIdempotencyAuditor } from '../idempotencyAuditor';

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockOrderFind = Order.find as jest.MockedFunction<typeof Order.find>;
const mockOrderAggregate = Order.aggregate as jest.MockedFunction<typeof Order.aggregate>;
const mockApplyFix = applyFix as jest.MockedFunction<typeof applyFix>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Valid UUID v4 for use in tests */
const VALID_UUID_V4 = '550e8400-e29b-41d4-a716-446655440000';

/** Build a minimal Order document with a missing/null idempotencyKey */
function makeOrderMissingKey(overrides: Partial<{
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  idempotencyKey: string | null | undefined;
  createdAt: Date;
}> = {}) {
  return {
    _id: overrides._id ?? new mongoose.Types.ObjectId(),
    userId: overrides.userId ?? new mongoose.Types.ObjectId(),
    idempotencyKey: overrides.idempotencyKey !== undefined ? overrides.idempotencyKey : null,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

/** Build a minimal Order document with a malformed (non-UUID-v4) idempotencyKey */
function makeOrderMalformedKey(overrides: Partial<{
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  idempotencyKey: string;
  createdAt: Date;
}> = {}) {
  return {
    _id: overrides._id ?? new mongoose.Types.ObjectId(),
    userId: overrides.userId ?? new mongoose.Types.ObjectId(),
    idempotencyKey: overrides.idempotencyKey ?? 'not-a-uuid',
    createdAt: overrides.createdAt ?? new Date(),
  };
}

/**
 * Build a chainable find mock that returns the given docs.
 */
function makeFindChain(docs: any[]) {
  return {
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(docs),
  };
}

/**
 * Set up Order.find to return the given results.
 *
 * The idempotencyAuditor calls Order.find twice:
 *   1. For missing/null/empty keys
 *   2. For non-empty keys (to filter malformed ones in-memory)
 *
 * Uses mockImplementation with a call counter so each call gets the right data.
 */
function mockOrderFindCalls(missingOrders: any[], ordersWithKeys: any[]) {
  let callCount = 0;
  mockOrderFind.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return makeFindChain(missingOrders) as any;
    }
    return makeFindChain(ordersWithKeys) as any;
  });
}

/**
 * Set up Order.aggregate to return the given results for each call.
 *
 * The auditor calls aggregate twice:
 *   1. Duplicate idempotency key scan
 *   2. Cart-hash duplicate scan
 *
 * Uses mockImplementation with a call counter.
 */
function mockOrderAggregateCalls(dupKeyGroups: any[], dupCartGroups: any[]) {
  let callCount = 0;
  mockOrderAggregate.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(dupKeyGroups) as any;
    }
    return Promise.resolve(dupCartGroups) as any;
  });
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Default: Order.find returns empty results for both calls
  mockOrderFindCalls([], []);

  // Default: Order.aggregate returns empty results for both calls
  mockOrderAggregateCalls([], []);

  // Default: applyFix succeeds
  mockApplyFix.mockResolvedValue({ applied: true });
});

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('IdempotencyAuditor', () => {

  // ── 1. Missing key ─────────────────────────────────────────────────────────

  describe('Missing key scan', () => {
    it('creates an audit entry for an order with a null idempotencyKey', async () => {
      const order = makeOrderMissingKey({ idempotencyKey: null });
      mockOrderFindCalls([order], []);
      mockOrderAggregateCalls([], []);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'IDEMPOTENCY_VIOLATION',
          action: 'FLAGGED_FOR_REVIEW',
          entityId: String(order._id),
        })
      );
    });

    it('creates an audit entry for an order with an empty string idempotencyKey', async () => {
      const order = makeOrderMissingKey({ idempotencyKey: '' });
      mockOrderFindCalls([order], []);
      mockOrderAggregateCalls([], []);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'IDEMPOTENCY_VIOLATION',
          action: 'FLAGGED_FOR_REVIEW',
        })
      );
    });

    it('does NOT call Order.updateOne or any write on the Order document (read-only auditor)', async () => {
      const order = makeOrderMissingKey({ idempotencyKey: null });
      mockOrderFindCalls([order], []);
      mockOrderAggregateCalls([], []);

      await runIdempotencyAuditor('run-001', {});

      // The only write should be via applyFix — Order itself must not be modified
      expect(Order.updateOne).not.toHaveBeenCalled();
      expect((Order as any).findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('uses the correct dedupeKey format: IDEMPOTENCY_VIOLATION:{orderId}:FLAGGED_FOR_REVIEW', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const order = makeOrderMissingKey({ _id: orderId, idempotencyKey: null });
      mockOrderFindCalls([order], []);
      mockOrderAggregateCalls([], []);

      await runIdempotencyAuditor('run-001', {});

      // applyFix constructs dedupeKey as `${anomalyType}:${entityId}:${action}`
      // so entityId must be the orderId string
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'IDEMPOTENCY_VIOLATION',
          entityId: String(orderId),
          action: 'FLAGGED_FOR_REVIEW',
        })
      );
    });

    it('returns idempotencyViolationCount = 1 for a single missing-key order', async () => {
      const order = makeOrderMissingKey({ idempotencyKey: null });
      mockOrderFindCalls([order], []);
      mockOrderAggregateCalls([], []);

      const counts = await runIdempotencyAuditor('run-001', {});

      expect(counts.idempotencyViolationCount).toBe(1);
    });
  });

  // ── 2. Malformed key scan ──────────────────────────────────────────────────

  describe('Malformed key scan (non-UUID-v4)', () => {
    it('creates an audit entry for an order with a non-UUID-v4 idempotencyKey', async () => {
      const order = makeOrderMalformedKey({ idempotencyKey: 'not-a-uuid' });
      // First find call returns empty (no missing/null keys)
      // Second find call returns the order with a non-empty but malformed key
      mockOrderFindCalls([], [order]);
      mockOrderAggregateCalls([], []);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'IDEMPOTENCY_VIOLATION',
          action: 'FLAGGED_FOR_REVIEW',
        })
      );
    });

    it('does NOT flag an order with a valid UUID v4 idempotencyKey', async () => {
      const order = makeOrderMalformedKey({ idempotencyKey: VALID_UUID_V4 });
      mockOrderFindCalls([], [order]);
      mockOrderAggregateCalls([], []);

      await runIdempotencyAuditor('run-001', {});

      // Valid UUID v4 should not be flagged
      expect(mockApplyFix).not.toHaveBeenCalled();
    });

    it('flags a UUID v3 key (wrong version digit) as malformed', async () => {
      // UUID v3 has "3" in the version position instead of "4"
      const uuidV3 = '550e8400-e29b-31d4-a716-446655440000';
      const order = makeOrderMalformedKey({ idempotencyKey: uuidV3 });
      mockOrderFindCalls([], [order]);
      mockOrderAggregateCalls([], []);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
    });

    it('flags a plain numeric string as malformed', async () => {
      const order = makeOrderMalformedKey({ idempotencyKey: '12345' });
      mockOrderFindCalls([], [order]);
      mockOrderAggregateCalls([], []);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
    });
  });

  // ── 3. Duplicate idempotency key detection ─────────────────────────────────

  describe('Duplicate idempotency key detection', () => {
    it('creates one audit entry per duplicate group', async () => {
      const userId = new mongoose.Types.ObjectId();
      const dupGroup = {
        _id: { userId, idempotencyKey: VALID_UUID_V4 },
        orderIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        count: 2,
      };

      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([dupGroup], []);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'IDEMPOTENCY_VIOLATION',
          action: 'FLAGGED_FOR_REVIEW',
          // entityId = "dup_key:{userId}:{idempotencyKey}"
          entityId: `dup_key:${String(userId)}:${VALID_UUID_V4}`,
        })
      );
    });

    it('creates separate audit entries for two distinct duplicate groups', async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      const key1 = '550e8400-e29b-41d4-a716-446655440001';
      const key2 = '550e8400-e29b-41d4-a716-446655440002';

      const group1 = {
        _id: { userId: userId1, idempotencyKey: key1 },
        orderIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        count: 2,
      };
      const group2 = {
        _id: { userId: userId2, idempotencyKey: key2 },
        orderIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        count: 2,
      };

      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([group1, group2], []);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(2);
    });

    it('includes userId, idempotencyKey, and duplicateCount in afterState', async () => {
      const userId = new mongoose.Types.ObjectId();
      const dupGroup = {
        _id: { userId, idempotencyKey: VALID_UUID_V4 },
        orderIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        count: 3,
      };

      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([dupGroup], []);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          afterState: expect.objectContaining({
            violation: 'DUPLICATE_IDEMPOTENCY_KEY',
            duplicateCount: 3,
          }),
        })
      );
    });
  });

  // ── 4. Cart-hash duplicate within 5 min ────────────────────────────────────

  describe('Cart-hash duplicate detection — within 5 minutes', () => {
    it('creates an audit entry when two orders share userId+cartHash within 5 minutes', async () => {
      const userId = new mongoose.Types.ObjectId();
      const cartHash = 'abc123hash';
      const now = Date.now();

      // Two orders 2 minutes apart (120 seconds < 300 seconds threshold)
      const cartGroup = {
        _id: { userId, cartHash },
        orders: [
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now - 2 * 60 * 1000) },
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now) },
        ],
        count: 2,
      };

      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([], [cartGroup]);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'IDEMPOTENCY_VIOLATION',
          action: 'FLAGGED_FOR_REVIEW',
          entityId: `dup_cart:${String(userId)}:${cartHash}`,
        })
      );
    });

    it('includes the correct minDeltaSec in afterState', async () => {
      const userId = new mongoose.Types.ObjectId();
      const cartHash = 'abc123hash';
      const now = Date.now();
      const deltaSec = 120; // 2 minutes

      const cartGroup = {
        _id: { userId, cartHash },
        orders: [
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now - deltaSec * 1000) },
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now) },
        ],
        count: 2,
      };

      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([], [cartGroup]);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          afterState: expect.objectContaining({
            violation: 'DUPLICATE_CART_HASH',
            minDeltaSec: expect.any(Number),
          }),
        })
      );

      const call = mockApplyFix.mock.calls[0][0];
      // Allow a small tolerance for timing
      expect(call.afterState.minDeltaSec).toBeCloseTo(deltaSec, -1);
    });

    it('flags a group where the minimum delta is just under 300 seconds (299 sec)', async () => {
      const userId = new mongoose.Types.ObjectId();
      const cartHash = 'borderlinehash';
      const now = Date.now();

      const cartGroup = {
        _id: { userId, cartHash },
        orders: [
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now - 299 * 1000) },
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now) },
        ],
        count: 2,
      };

      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([], [cartGroup]);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
    });
  });

  // ── 5. Cart-hash duplicate beyond 5 min ────────────────────────────────────

  describe('Cart-hash duplicate detection — beyond 5 minutes', () => {
    it('does NOT flag a group where all pairs are beyond 300 seconds apart', async () => {
      const userId = new mongoose.Types.ObjectId();
      const cartHash = 'oldhash';
      const now = Date.now();

      // Two orders 10 minutes apart (600 seconds > 300 seconds threshold)
      const cartGroup = {
        _id: { userId, cartHash },
        orders: [
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now - 10 * 60 * 1000) },
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now) },
        ],
        count: 2,
      };

      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([], [cartGroup]);

      await runIdempotencyAuditor('run-001', {});

      // No audit entry should be created — delta is beyond the 5-minute window
      expect(mockApplyFix).not.toHaveBeenCalled();
    });

    it('does NOT flag a group where the minimum delta is exactly 300 seconds', async () => {
      const userId = new mongoose.Types.ObjectId();
      const cartHash = 'exactboundaryhash';
      const now = Date.now();

      const cartGroup = {
        _id: { userId, cartHash },
        orders: [
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now - 300 * 1000) },
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now) },
        ],
        count: 2,
      };

      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([], [cartGroup]);

      await runIdempotencyAuditor('run-001', {});

      // Exactly 300 seconds is NOT within the window (condition is < 300)
      expect(mockApplyFix).not.toHaveBeenCalled();
    });

    it('flags a group with 3 orders where only one consecutive pair is within 5 min', async () => {
      const userId = new mongoose.Types.ObjectId();
      const cartHash = 'mixedhash';
      const now = Date.now();

      // Orders: t=0, t=120s, t=900s
      // Consecutive deltas: 120s (< 300 → flag), 780s (> 300)
      // minDeltaSec = 120 → should be flagged
      const cartGroup = {
        _id: { userId, cartHash },
        orders: [
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now - 900 * 1000) },
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now - 780 * 1000) },
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now) },
        ],
        count: 3,
      };

      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([], [cartGroup]);

      await runIdempotencyAuditor('run-001', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
    });
  });

  // ── 6. Idempotency (dedupeKey prevents duplicate audit entries) ────────────

  describe('Idempotency — second run produces same set of audit entries', () => {
    it('second run with same missing-key order returns { applied: false } and does not create a new entry', async () => {
      const order = makeOrderMissingKey({ idempotencyKey: null });

      // First run: applyFix returns applied: true
      mockOrderFindCalls([order], []);
      mockOrderAggregateCalls([], []);
      mockApplyFix.mockResolvedValue({ applied: true });

      const counts1 = await runIdempotencyAuditor('run-001', {});
      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      expect(counts1.idempotencyViolationCount).toBe(1);

      // Second run: same order, applyFix returns applied: false (dedupeKey already exists)
      jest.clearAllMocks();
      mockOrderFindCalls([order], []);
      mockOrderAggregateCalls([], []);
      mockApplyFix.mockResolvedValue({ applied: false });

      const counts2 = await runIdempotencyAuditor('run-002', {});

      // applyFix was called but returned applied: false — no new audit entry was created
      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      // The violation is still counted (applyFix was called), but no new DB entry was written
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'IDEMPOTENCY_VIOLATION',
          entityId: String(order._id),
          action: 'FLAGGED_FOR_REVIEW',
        })
      );
    });

    it('second run with same duplicate key group returns { applied: false }', async () => {
      const userId = new mongoose.Types.ObjectId();
      const dupGroup = {
        _id: { userId, idempotencyKey: VALID_UUID_V4 },
        orderIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        count: 2,
      };

      // First run
      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([dupGroup], []);
      mockApplyFix.mockResolvedValue({ applied: true });

      await runIdempotencyAuditor('run-001', {});
      expect(mockApplyFix).toHaveBeenCalledTimes(1);

      // Second run: same group, dedupeKey already exists
      jest.clearAllMocks();
      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([dupGroup], []);
      mockApplyFix.mockResolvedValue({ applied: false });

      await runIdempotencyAuditor('run-002', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: `dup_key:${String(userId)}:${VALID_UUID_V4}`,
        })
      );
    });

    it('second run with same cart-hash group returns { applied: false }', async () => {
      const userId = new mongoose.Types.ObjectId();
      const cartHash = 'repeatcarthash';
      const now = Date.now();

      const cartGroup = {
        _id: { userId, cartHash },
        orders: [
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now - 60 * 1000) },
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now) },
        ],
        count: 2,
      };

      // First run
      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([], [cartGroup]);
      mockApplyFix.mockResolvedValue({ applied: true });

      await runIdempotencyAuditor('run-001', {});
      expect(mockApplyFix).toHaveBeenCalledTimes(1);

      // Second run: same group, dedupeKey already exists
      jest.clearAllMocks();
      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([], [cartGroup]);
      mockApplyFix.mockResolvedValue({ applied: false });

      await runIdempotencyAuditor('run-002', {});

      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: `dup_cart:${String(userId)}:${cartHash}`,
        })
      );
    });
  });

  // ── 7. RunCounts aggregation ───────────────────────────────────────────────

  describe('RunCounts aggregation', () => {
    it('returns correct totalScanned and idempotencyViolationCount across all three scans', async () => {
      const userId = new mongoose.Types.ObjectId();
      const missingOrder = makeOrderMissingKey({ idempotencyKey: null });
      const dupGroup = {
        _id: { userId, idempotencyKey: VALID_UUID_V4 },
        orderIds: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
        count: 2,
      };
      const now = Date.now();
      const cartGroup = {
        _id: { userId, cartHash: 'somehash' },
        orders: [
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now - 60 * 1000) },
          { _id: new mongoose.Types.ObjectId(), createdAt: new Date(now) },
        ],
        count: 2,
      };

      mockOrderFindCalls([missingOrder], []);
      mockOrderAggregateCalls([dupGroup], [cartGroup]);

      const counts = await runIdempotencyAuditor('run-001', {});

      // 1 missing-key + 1 dup-key group + 1 cart-hash group = 3 scanned, 3 violations
      expect(counts.totalScanned).toBe(3);
      expect(counts.idempotencyViolationCount).toBe(3);
      expect(counts.manualReviewCount).toBe(3);
    });

    it('returns zero counts when no violations are found', async () => {
      mockOrderFindCalls([], []);
      mockOrderAggregateCalls([], []);

      const counts = await runIdempotencyAuditor('run-001', {});

      expect(counts.totalScanned).toBe(0);
      expect(counts.idempotencyViolationCount).toBe(0);
      expect(counts.errorCount).toBe(0);
    });

    it('passes dryRun flag through to applyFix', async () => {
      const order = makeOrderMissingKey({ idempotencyKey: null });
      mockOrderFindCalls([order], []);
      mockOrderAggregateCalls([], []);

      await runIdempotencyAuditor('run-001', { dryRun: true });

      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true })
      );
    });
  });
});
