/**
 * Unit tests for the Zombie Recovery Scanner
 *
 * Tests the atomic claim, three recovery paths (link, recoverable, skip),
 * permanent failure path, and idempotency via dedupeKey.
 *
 * All MongoDB models (PaymentIntent, Order), applyFix, assertAllowedTransition,
 * and the Razorpay client are mocked — no real MongoDB connection needed.
 *
 * Requirements: 2.4, 2.5, 2.6, 2.7, 2.10
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before any imports
// ---------------------------------------------------------------------------

jest.mock('../../../models/PaymentIntent');
jest.mock('../../../../../models/Order');
jest.mock('../fixEngine');
jest.mock('../../paymentIntentStateMachine');
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
import { PaymentIntent } from '../../../models/PaymentIntent';
import { Order } from '../../../../../models/Order';
import { applyFix } from '../fixEngine';
import { assertAllowedTransition } from '../../paymentIntentStateMachine';
import { runZombieRecoveryScanner } from '../zombieRecoveryScanner';

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockPaymentIntentFind = PaymentIntent.find as jest.MockedFunction<typeof PaymentIntent.find>;
const mockPaymentIntentUpdateOne = PaymentIntent.updateOne as jest.MockedFunction<typeof PaymentIntent.updateOne>;
const mockOrderUpdateOne = Order.updateOne as jest.MockedFunction<typeof Order.updateOne>;
const mockApplyFix = applyFix as jest.MockedFunction<typeof applyFix>;
const mockAssertAllowedTransition = assertAllowedTransition as jest.MockedFunction<typeof assertAllowedTransition>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal zombie PaymentIntent document */
function makeZombie(overrides: Partial<{
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  idempotencyKey: string;
  status: string;
  zombieRecoveryAttempts: number;
  gatewayCreateAttemptedAt: Date;
  version: number;
}> = {}) {
  return {
    _id: overrides._id ?? new mongoose.Types.ObjectId(),
    orderId: overrides.orderId ?? new mongoose.Types.ObjectId(),
    idempotencyKey: overrides.idempotencyKey ?? 'idem-key-001',
    status: overrides.status ?? 'CREATED',
    zombieRecoveryAttempts: overrides.zombieRecoveryAttempts ?? 0,
    gatewayCreateAttemptedAt: overrides.gatewayCreateAttemptedAt ?? new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
    version: overrides.version ?? 0,
  };
}

/** Build a mock Razorpay client */
function makeMockRazorpay(ordersResponse: { items: any[] } | null = null) {
  return {
    orders: {
      all: jest.fn((params: any, cb: (err: any, data: any) => void) => {
        if (ordersResponse === null) {
          cb(new Error('Razorpay API error'), null);
        } else {
          cb(null, ordersResponse);
        }
      }),
    },
  };
}

/** Build a mock alert channel */
function makeMockAlertChannel() {
  return {
    sendAlert: jest.fn().mockResolvedValue(undefined),
  };
}

/** Set up PaymentIntent.find to return the given zombies */
function mockFindZombies(zombies: any[]) {
  mockPaymentIntentFind.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(zombies),
  } as any);
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Default: no zombies found
  mockFindZombies([]);

  // Default: atomic claim succeeds (modifiedCount = 1)
  mockPaymentIntentUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);

  // Default: Order.updateOne succeeds
  mockOrderUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);

  // Default: applyFix succeeds
  mockApplyFix.mockResolvedValue({ applied: true });

  // Default: assertAllowedTransition is a no-op
  mockAssertAllowedTransition.mockReturnValue(undefined);
});

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('ZombieRecoveryScanner', () => {

  // ── 1. Atomic claim ────────────────────────────────────────────────────────

  describe('Atomic claim', () => {
    it('skips the intent when modifiedCount === 0 (concurrent run claimed it)', async () => {
      const zombie = makeZombie({ zombieRecoveryAttempts: 0 });
      mockFindZombies([zombie]);

      // Simulate concurrent claim: first updateOne (atomic claim) returns modifiedCount=0
      mockPaymentIntentUpdateOne.mockResolvedValueOnce({ modifiedCount: 0 } as any);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      const counts = await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // applyFix should NOT have been called — the intent was skipped
      expect(mockApplyFix).not.toHaveBeenCalled();

      // The scan still counted the intent as scanned
      expect(counts.totalScanned).toBe(1);
    });

    it('proceeds with recovery when modifiedCount === 1 (claim succeeded)', async () => {
      // 15 min old zombie → recoverable path
      const zombie = makeZombie({ zombieRecoveryAttempts: 0 });
      mockFindZombies([zombie]);

      // Claim succeeds
      mockPaymentIntentUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);

      // No Razorpay order found → recoverable path (age > 10 min)
      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // applyFix should have been called (recoverable path)
      expect(mockApplyFix).toHaveBeenCalledTimes(1);
    });
  });

  // ── 2. Link path ───────────────────────────────────────────────────────────

  describe('Link path (Razorpay order found)', () => {
    it('sets gatewayOrderId atomically and transitions status to GATEWAY_ORDER_CREATED', async () => {
      const zombie = makeZombie({ zombieRecoveryAttempts: 0 });
      mockFindZombies([zombie]);

      // Razorpay returns a matching order
      const razorpayOrder = { id: 'order_rzp_001', created_at: Math.floor(Date.now() / 1000) };
      const razorpay = makeMockRazorpay({ items: [razorpayOrder] });
      const alertChannel = makeMockAlertChannel();

      // First updateOne = atomic claim (succeeds)
      // Second updateOne = link path compare-and-set (succeeds)
      mockPaymentIntentUpdateOne
        .mockResolvedValueOnce({ modifiedCount: 1 } as any)  // atomic claim
        .mockResolvedValueOnce({ modifiedCount: 1 } as any); // link CAS

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // Verify the link compare-and-set was called with the correct filter and update
      expect(mockPaymentIntentUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: zombie._id,
          gatewayOrderId: { $exists: false },
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            gatewayOrderId: 'order_rzp_001',
            status: 'GATEWAY_ORDER_CREATED',
          }),
        })
      );
    });

    it('calls applyFix after linking gatewayOrderId', async () => {
      const zombie = makeZombie({ zombieRecoveryAttempts: 0 });
      mockFindZombies([zombie]);

      const razorpayOrder = { id: 'order_rzp_001', created_at: Math.floor(Date.now() / 1000) };
      const razorpay = makeMockRazorpay({ items: [razorpayOrder] });
      const alertChannel = makeMockAlertChannel();

      mockPaymentIntentUpdateOne
        .mockResolvedValueOnce({ modifiedCount: 1 } as any)
        .mockResolvedValueOnce({ modifiedCount: 1 } as any);

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'ZOMBIE_GATEWAY_RECOVERY',
          action: 'AUTO_FIXED',
          afterState: expect.objectContaining({
            gatewayOrderId: 'order_rzp_001',
            status: 'GATEWAY_ORDER_CREATED',
          }),
        })
      );
    });

    it('skips applyFix when link CAS returns modifiedCount === 0 (already linked by concurrent run)', async () => {
      const zombie = makeZombie({ zombieRecoveryAttempts: 0 });
      mockFindZombies([zombie]);

      const razorpayOrder = { id: 'order_rzp_001', created_at: Math.floor(Date.now() / 1000) };
      const razorpay = makeMockRazorpay({ items: [razorpayOrder] });
      const alertChannel = makeMockAlertChannel();

      mockPaymentIntentUpdateOne
        .mockResolvedValueOnce({ modifiedCount: 1 } as any)  // atomic claim
        .mockResolvedValueOnce({ modifiedCount: 0 } as any); // link CAS — already linked

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // applyFix should NOT be called when link CAS fails
      expect(mockApplyFix).not.toHaveBeenCalled();
    });
  });

  // ── 3. Recoverable path ────────────────────────────────────────────────────

  describe('Recoverable path (no Razorpay order, age > 10 min)', () => {
    it('calls assertAllowedTransition before transitioning to PAYMENT_RECOVERABLE', async () => {
      // 15 min old zombie → recoverable
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000),
        status: 'CREATED',
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] }); // no Razorpay order
      const alertChannel = makeMockAlertChannel();

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      expect(mockAssertAllowedTransition).toHaveBeenCalledWith('CREATED', 'PAYMENT_RECOVERABLE');
    });

    it('transitions PaymentIntent status to PAYMENT_RECOVERABLE', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000),
        status: 'CREATED',
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // The recoverable path calls PaymentIntent.updateOne with status = PAYMENT_RECOVERABLE
      // (second call — first is the atomic claim)
      const calls = mockPaymentIntentUpdateOne.mock.calls;
      const recoverableCall = calls.find((call) =>
        call[1] && (call[1] as any).$set && (call[1] as any).$set.status === 'PAYMENT_RECOVERABLE'
      );
      expect(recoverableCall).toBeDefined();
    });

    it('calls applyFix with ZOMBIE_GATEWAY_RECOVERY and afterState.status = PAYMENT_RECOVERABLE', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000),
        status: 'CREATED',
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'ZOMBIE_GATEWAY_RECOVERY',
          afterState: expect.objectContaining({
            status: 'PAYMENT_RECOVERABLE',
          }),
        })
      );
    });
  });

  // ── 4. Skip path ───────────────────────────────────────────────────────────

  describe('Skip path (no Razorpay order, age ≤ 10 min)', () => {
    it('does NOT call applyFix when age is within 10 minutes and no Razorpay order found', async () => {
      // 5 min old zombie → too recent, skip
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 5 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] }); // no Razorpay order
      const alertChannel = makeMockAlertChannel();

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      expect(mockApplyFix).not.toHaveBeenCalled();
    });

    it('only updates lastScannedAt (via atomic claim) when skipping', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 5 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // Only the atomic claim updateOne should have been called (sets lastScannedAt)
      expect(mockPaymentIntentUpdateOne).toHaveBeenCalledTimes(1);
      expect(mockPaymentIntentUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: zombie._id }),
        expect.objectContaining({
          $set: expect.objectContaining({ lastScannedAt: expect.any(Date) }),
        })
      );
    });

    it('does NOT call assertAllowedTransition on the skip path', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 5 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      expect(mockAssertAllowedTransition).not.toHaveBeenCalled();
    });
  });

  // ── 5. Permanent failure path ──────────────────────────────────────────────

  describe('Permanent failure path', () => {
    it('triggers permanent failure when zombieRecoveryAttempts reaches the limit (>= 3 after increment)', async () => {
      // attempts = 2 → after increment = 3 → permanent failure
      const zombie = makeZombie({
        zombieRecoveryAttempts: 2,
        gatewayCreateAttemptedAt: new Date(Date.now() - 5 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      // Execute fix callbacks so PaymentIntent.updateOne and Order.updateOne are called
      mockApplyFix.mockImplementation(async (args: any) => {
        if (args.fix) await args.fix();
        return { applied: true };
      });

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // PaymentIntent should be marked FAILED with isLocked = true
      expect(mockPaymentIntentUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: zombie._id }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'FAILED',
            isLocked: true,
            lockReason: 'ZOMBIE_MAX_RETRIES',
          }),
        })
      );
    });

    it('marks Order paymentStatus FAILED only when Order is still PENDING', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 2,
        gatewayCreateAttemptedAt: new Date(Date.now() - 5 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      mockApplyFix.mockImplementation(async (args: any) => {
        if (args.fix) await args.fix();
        return { applied: true };
      });

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // Order.updateOne should be called with paymentStatus: PENDING filter (idempotent guard)
      expect(mockOrderUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: zombie.orderId,
          paymentStatus: 'PENDING',
        }),
        expect.objectContaining({
          $set: expect.objectContaining({ paymentStatus: 'FAILED' }),
        })
      );
    });

    it('triggers permanent failure when age exceeds 30 minutes', async () => {
      // 35 min old zombie → age hard limit exceeded
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 35 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      mockApplyFix.mockImplementation(async (args: any) => {
        if (args.fix) await args.fix();
        return { applied: true };
      });

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // Should have called applyFix with permanent failure afterState
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'ZOMBIE_GATEWAY_RECOVERY',
          afterState: expect.objectContaining({
            status: 'FAILED',
            isLocked: true,
          }),
        })
      );
    });

    it('calls applyFix with AUTO_FIXED action on permanent failure', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 2,
        gatewayCreateAttemptedAt: new Date(Date.now() - 5 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUTO_FIXED',
          anomalyType: 'ZOMBIE_GATEWAY_RECOVERY',
        })
      );
    });
  });

  // ── 6. Idempotency ─────────────────────────────────────────────────────────

  describe('Idempotency (dedupeKey prevents duplicate audit entries)', () => {
    it('second run with same intents produces no additional audit entries when applyFix returns { applied: false }', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000),
      });

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      // First run: applyFix returns applied: true
      mockFindZombies([zombie]);
      mockApplyFix.mockResolvedValueOnce({ applied: true });

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      expect(mockApplyFix).toHaveBeenCalledTimes(1);

      // Second run: same zombie, applyFix returns applied: false (dedupeKey already exists)
      jest.clearAllMocks();
      mockFindZombies([zombie]);
      mockPaymentIntentUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);
      mockApplyFix.mockResolvedValueOnce({ applied: false });
      mockAssertAllowedTransition.mockReturnValue(undefined);

      await runZombieRecoveryScanner('run-002', { razorpay: razorpay as any }, alertChannel as any);

      // applyFix was called but returned applied: false — no new audit entry was created
      expect(mockApplyFix).toHaveBeenCalledTimes(1);
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({ anomalyType: 'ZOMBIE_GATEWAY_RECOVERY' })
      );
    });

    it('returns correct RunCounts after processing zombies', async () => {
      // One recoverable zombie (15 min old, no Razorpay order)
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      const counts = await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      expect(counts.totalScanned).toBe(1);
      expect(counts.zombieRecoveredCount).toBe(1);
      expect(counts.zombieFailedCount).toBe(0);
      expect(counts.errorCount).toBe(0);
    });

    it('returns correct RunCounts for permanently failed zombie', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 2,
        gatewayCreateAttemptedAt: new Date(Date.now() - 5 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      const counts = await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      expect(counts.totalScanned).toBe(1);
      expect(counts.zombieFailedCount).toBe(1);
      expect(counts.zombieRecoveredCount).toBe(0);
    });
  });

  // ── 7. Razorpay error handling ─────────────────────────────────────────────

  describe('Razorpay error handling', () => {
    it('treats Razorpay API failure as "no order found" (fetchWithRetry returns null after all retries)', async () => {
      // 15 min old zombie → after Razorpay failure (null returned), falls through to recoverable path
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      // Razorpay returns an error — fetchWithRetry catches it and returns null
      const razorpay = makeMockRazorpay(null);
      const alertChannel = makeMockAlertChannel();

      const counts = await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // fetchWithRetry returns null on error, so the scanner treats it as "no Razorpay order"
      // and falls through to the recoverable path (age > 10 min) — applyFix IS called
      // The errorCount is only incremented if razorpayLimiter.run() itself throws (not fetchWithRetry)
      expect(counts.totalScanned).toBe(1);
      // The intent is processed (not skipped) — it goes to recoverable path since age > 10 min
      expect(counts.zombieRecoveredCount).toBe(1);
    });

    it('increments errorCount when razorpayLimiter.run() itself throws', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      // Make razorpayLimiter.run throw directly (simulates a limiter-level error)
      const { razorpayLimiter } = require('../concurrencyLimiter');
      (razorpayLimiter.run as jest.Mock).mockRejectedValueOnce(new Error('Limiter error'));

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      const counts = await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any }, alertChannel as any);

      // applyFix should NOT be called — intent was skipped due to limiter error
      expect(mockApplyFix).not.toHaveBeenCalled();
      expect(counts.errorCount).toBe(1);
    });
  });

  // ── 8. dryRun mode ─────────────────────────────────────────────────────────

  describe('dryRun mode', () => {
    it('passes dryRun flag through to applyFix', async () => {
      const zombie = makeZombie({
        zombieRecoveryAttempts: 0,
        gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000),
      });
      mockFindZombies([zombie]);

      const razorpay = makeMockRazorpay({ items: [] });
      const alertChannel = makeMockAlertChannel();

      await runZombieRecoveryScanner('run-001', { razorpay: razorpay as any, dryRun: true }, alertChannel as any);

      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({ dryRun: true })
      );
    });
  });
});
