/**
 * Integration tests for end-to-end reconciliation flow
 *
 * These are integration-style tests that mock MongoDB models but test the full
 * flow through `runReconciliationOnce`. They verify the interactions between
 * components: scanners, fixEngine, alerting, and audit log creation.
 *
 * Requirements: 1.11, 2.10, 4.9, 6.4, 6.7
 */

// ---------------------------------------------------------------------------
// Mocks — declared before imports
// ---------------------------------------------------------------------------

jest.mock('../../../models/ReconciliationAuditLog');
jest.mock('../../../models/ReconciliationReport');
jest.mock('../../../models/DailyReconciliationSummary');
jest.mock('../../../models/ReconciliationRun');
jest.mock('../../../../../models/Order');
jest.mock('../../../models/PaymentIntent');
jest.mock('../../../models/LedgerEntry');
jest.mock('../../ledgerService');
jest.mock('../../paymentIntentStateMachine');
jest.mock('../concurrencyLimiter', () => ({
  initializeLimiters: jest.fn(),
  dbWriteLimiter: { run: jest.fn((fn: any) => fn()) },
  razorpayLimiter: { run: jest.fn((fn: any) => fn()) },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import mongoose from 'mongoose';
import { ReconciliationAuditLog } from '../../../models/ReconciliationAuditLog';
import { ReconciliationReport } from '../../../models/ReconciliationReport';
import { ReconciliationRun } from '../../../models/ReconciliationRun';
import { Order } from '../../../../../models/Order';
import { PaymentIntent } from '../../../models/PaymentIntent';
import { LedgerEntry } from '../../../models/LedgerEntry';
import { appendLedgerEntry } from '../../ledgerService';
import { assertAllowedTransition } from '../../paymentIntentStateMachine';
import { runReconciliationOnce } from '../reconciliationOrchestrator';

// ---------------------------------------------------------------------------
// Typed mock references
// ---------------------------------------------------------------------------

const mockAuditLogCreate = ReconciliationAuditLog.create as jest.MockedFunction<typeof ReconciliationAuditLog.create>;
const mockReportCreate = ReconciliationReport.create as jest.MockedFunction<typeof ReconciliationReport.create>;
const mockRunCreate = ReconciliationRun.create as jest.MockedFunction<typeof ReconciliationRun.create>;
const mockRunFindOne = ReconciliationRun.findOne as jest.MockedFunction<typeof ReconciliationRun.findOne>;
const mockRunUpdateOne = ReconciliationRun.updateOne as jest.MockedFunction<typeof ReconciliationRun.updateOne>;
const mockRunUpdateMany = ReconciliationRun.updateMany as jest.MockedFunction<typeof ReconciliationRun.updateMany>;

const mockOrderFind = Order.find as jest.MockedFunction<typeof Order.find>;
const mockOrderUpdateOne = Order.updateOne as jest.MockedFunction<typeof Order.updateOne>;

const mockPaymentIntentFind = PaymentIntent.find as jest.MockedFunction<typeof PaymentIntent.find>;
const mockPaymentIntentFindById = PaymentIntent.findById as jest.MockedFunction<typeof PaymentIntent.findById>;
const mockPaymentIntentFindOne = PaymentIntent.findOne as jest.MockedFunction<typeof PaymentIntent.findOne>;
const mockPaymentIntentUpdateOne = PaymentIntent.updateOne as jest.MockedFunction<typeof PaymentIntent.updateOne>;

const mockLedgerEntryFindOne = LedgerEntry.findOne as jest.MockedFunction<typeof LedgerEntry.findOne>;
const mockLedgerEntryAggregate = LedgerEntry.aggregate as jest.MockedFunction<typeof LedgerEntry.aggregate>;

const mockAppendLedgerEntry = appendLedgerEntry as jest.MockedFunction<typeof appendLedgerEntry>;
const mockAssertAllowedTransition = assertAllowedTransition as jest.MockedFunction<typeof assertAllowedTransition>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock Razorpay client */
function makeMockRazorpay(paymentsResponse: { items: any[] } | null = { items: [] }) {
  return {
    orders: {
      fetchPayments: jest.fn((orderId: string, cb: (err: any, data: any) => void) => {
        if (paymentsResponse === null) {
          cb(new Error('Razorpay API error'), null);
        } else {
          cb(null, paymentsResponse);
        }
      }),
      all: jest.fn((params: any, cb: (err: any, data: any) => void) => {
        cb(null, { items: [] });
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

/** Build a minimal PAID order */
function makePaidOrder(overrides: Partial<{
  _id: mongoose.Types.ObjectId;
  paymentStatus: string;
  totalAmount: number;
  razorpayOrderId: string;
  activePaymentIntentId: mongoose.Types.ObjectId | null;
  idempotencyKey: string | null | undefined;
  reconciliationErrorCount: number;
}> = {}) {
  return {
    _id: overrides._id ?? new mongoose.Types.ObjectId(),
    paymentStatus: overrides.paymentStatus ?? 'PAID',
    totalAmount: overrides.totalAmount ?? 100,
    razorpayOrderId: overrides.razorpayOrderId ?? 'order_ABC123',
    activePaymentIntentId: overrides.activePaymentIntentId !== undefined
      ? overrides.activePaymentIntentId
      : new mongoose.Types.ObjectId(),
    idempotencyKey: overrides.idempotencyKey !== undefined
      ? overrides.idempotencyKey
      : '550e8400-e29b-41d4-a716-446655440000',
    reconciliationErrorCount: overrides.reconciliationErrorCount ?? 0,
  };
}

/** Build a minimal zombie PaymentIntent */
function makeZombieIntent(overrides: Partial<{
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
    idempotencyKey: overrides.idempotencyKey ?? 'zombie-key-001',
    status: overrides.status ?? 'CREATED',
    zombieRecoveryAttempts: overrides.zombieRecoveryAttempts ?? 0,
    gatewayCreateAttemptedAt: overrides.gatewayCreateAttemptedAt ?? new Date(Date.now() - 15 * 60 * 1000),
    version: overrides.version ?? 0,
  };
}

/** Set up Order.find to return the given orders (for LEDGER scanner) */
function mockOrderFindReturns(orders: any[]) {
  // First call returns orders, second call returns [] (end of pagination)
  mockOrderFind
    .mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(orders),
    } as any)
    .mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    } as any);
}

/** Set up PaymentIntent.find to return the given zombies (for ZOMBIE scanner) */
function mockZombieIntentFindReturns(zombies: any[]) {
  mockPaymentIntentFind.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(zombies),
  } as any);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Default: no orders, no zombies
  mockOrderFind.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  } as any);

  mockPaymentIntentFind.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([]),
  } as any);

  mockPaymentIntentFindById.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(null),
  } as any);

  mockPaymentIntentFindOne.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(null),
  } as any);

  mockLedgerEntryFindOne.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(null),
  } as any);

  mockLedgerEntryAggregate.mockResolvedValue([]);

  mockOrderUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);
  mockPaymentIntentUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);

  // Audit log: default success
  mockAuditLogCreate.mockResolvedValue({ _id: new mongoose.Types.ObjectId() } as any);

  // Report: default success
  mockReportCreate.mockResolvedValue({
    _id: new mongoose.Types.ObjectId(),
    runId: 'test-run',
    subService: 'LEDGER',
    generatedAt: new Date(),
    totalScanned: 0,
    falsePaidCount: 0,
    phantomPaidCount: 0,
    orphanLedgerCount: 0,
    missingLedgerCount: 0,
    amountMismatchCount: 0,
    partialCaptureCount: 0,
    piStatusMismatchCount: 0,
    zombieRecoveredCount: 0,
    zombieFailedCount: 0,
    idempotencyViolationCount: 0,
    mismatchCount: 0,
    mismatchRate: 0,
    autoFixedCount: 0,
    manualReviewCount: 0,
    criticalAnomalyCount: 0,
    errorCount: 0,
  } as any);

  // ReconciliationRun: default success
  mockRunFindOne.mockResolvedValue(null);
  mockRunCreate.mockResolvedValue({ runId: 'test-run', _id: new mongoose.Types.ObjectId() } as any);
  mockRunUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);
  mockRunUpdateMany.mockResolvedValue({ modifiedCount: 0 } as any);

  // appendLedgerEntry: default success
  mockAppendLedgerEntry.mockResolvedValue({ created: true });

  // assertAllowedTransition: default no-op
  mockAssertAllowedTransition.mockReturnValue(undefined);
});

// ---------------------------------------------------------------------------
// Test 1: FALSE_PAID scenario
// ---------------------------------------------------------------------------

describe('Integration: FALSE_PAID scenario', () => {
  it('fires CRITICAL alert and creates audit entry with category = FALSE_PAID', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const order = makePaidOrder({
      _id: orderId,
      razorpayOrderId: 'order_FALSE_PAID',
      activePaymentIntentId: null,
    });

    // Seed: PAID order with no Razorpay capture
    mockOrderFindReturns([order]);

    // Razorpay returns no payments → FALSE_PAID
    const razorpay = makeMockRazorpay({ items: [] });
    const alertChannel = makeMockAlertChannel();

    await runReconciliationOnce('LEDGER', {
      razorpay: razorpay as any,
      alertChannel: alertChannel as any,
    });

    // Verify audit entry was created with category = FALSE_PAID
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'FALSE_PAID',
        action: 'FLAGGED_FOR_REVIEW',
        alertSeverity: 'CRITICAL',
      })
    );

    // Verify CRITICAL alert was fired
    expect(alertChannel.sendAlert).toHaveBeenCalledWith(
      expect.any(Object),
      'CRITICAL'
    );
  });

  it('sets reconciliationFlag on the order when FALSE_PAID is detected', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const order = makePaidOrder({
      _id: orderId,
      razorpayOrderId: 'order_FALSE_PAID_2',
      activePaymentIntentId: null,
    });

    mockOrderFindReturns([order]);

    const razorpay = makeMockRazorpay({ items: [] });
    const alertChannel = makeMockAlertChannel();

    // Execute fix callbacks so Order.updateOne is actually called
    mockAuditLogCreate.mockImplementation(async (doc: any) => {
      return { _id: new mongoose.Types.ObjectId(), ...doc } as any;
    });

    await runReconciliationOnce('LEDGER', {
      razorpay: razorpay as any,
      alertChannel: alertChannel as any,
    });

    // Verify Order.updateOne was called to set reconciliationFlag
    expect(mockOrderUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: orderId }),
      expect.objectContaining({
        $set: expect.objectContaining({ reconciliationFlag: 'FALSE_PAID_UNRESOLVED' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2: MISSING_LEDGER scenario
// ---------------------------------------------------------------------------

describe('Integration: MISSING_LEDGER scenario', () => {
  it('calls appendLedgerEntry and creates audit entry with action = AUTO_FIXED', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const piId = new mongoose.Types.ObjectId();
    const order = makePaidOrder({
      _id: orderId,
      razorpayOrderId: 'order_MISSING_LEDGER',
      activePaymentIntentId: piId,
    });

    const paymentIntent = {
      _id: piId,
      status: 'CAPTURED',
      version: 1,
    };

    // Seed: PAID order with Razorpay captured but no LedgerEntry
    mockOrderFindReturns([order]);

    mockPaymentIntentFindById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(paymentIntent),
    } as any);

    // No ledger entry
    mockLedgerEntryFindOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    } as any);

    // Razorpay returns captured payment
    const razorpay = makeMockRazorpay({
      items: [{
        id: 'pay_MISSING_LEDGER',
        status: 'captured',
        amount: 10000,
        created_at: Math.floor(Date.now() / 1000),
      }],
    });

    const alertChannel = makeMockAlertChannel();

    // Execute fix callbacks so appendLedgerEntry is actually called
    mockAuditLogCreate.mockImplementation(async (doc: any) => {
      return { _id: new mongoose.Types.ObjectId(), ...doc } as any;
    });

    await runReconciliationOnce('LEDGER', {
      razorpay: razorpay as any,
      alertChannel: alertChannel as any,
    });

    // Verify appendLedgerEntry was called
    expect(mockAppendLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: orderId.toString(),
        eventType: 'CAPTURE',
        dedupeKey: expect.stringContaining('ledger_backfill:'),
      })
    );

    // Verify audit entry was created with action = AUTO_FIXED
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'MISSING_LEDGER',
        action: 'AUTO_FIXED',
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Test 3: Zombie PAYMENT_RECOVERABLE scenario
// ---------------------------------------------------------------------------

describe('Integration: Zombie PAYMENT_RECOVERABLE scenario', () => {
  it('transitions zombie PaymentIntent to PAYMENT_RECOVERABLE when age > 10 min and no Razorpay order', async () => {
    const zombie = makeZombieIntent({
      zombieRecoveryAttempts: 0,
      gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 min ago
      status: 'CREATED',
    });

    // Seed: zombie PaymentIntent (age > 10 min, no Razorpay order)
    mockZombieIntentFindReturns([zombie]);

    // Razorpay returns no matching order
    const razorpay = makeMockRazorpay({ items: [] });
    const alertChannel = makeMockAlertChannel();

    // Atomic claim succeeds
    mockPaymentIntentUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);

    await runReconciliationOnce('ZOMBIE', {
      razorpay: razorpay as any,
      alertChannel: alertChannel as any,
    });

    // Verify PaymentIntent was transitioned to PAYMENT_RECOVERABLE
    const calls = mockPaymentIntentUpdateOne.mock.calls;
    const recoverableCall = calls.find((call) =>
      call[1] && (call[1] as any).$set && (call[1] as any).$set.status === 'PAYMENT_RECOVERABLE'
    );
    expect(recoverableCall).toBeDefined();

    // Verify audit entry was created for ZOMBIE_GATEWAY_RECOVERY
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ZOMBIE_GATEWAY_RECOVERY',
        action: 'AUTO_FIXED',
      })
    );
  });

  it('calls assertAllowedTransition before transitioning to PAYMENT_RECOVERABLE', async () => {
    const zombie = makeZombieIntent({
      zombieRecoveryAttempts: 0,
      gatewayCreateAttemptedAt: new Date(Date.now() - 15 * 60 * 1000),
      status: 'CREATED',
    });

    mockZombieIntentFindReturns([zombie]);

    const razorpay = makeMockRazorpay({ items: [] });
    const alertChannel = makeMockAlertChannel();

    mockPaymentIntentUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);

    await runReconciliationOnce('ZOMBIE', {
      razorpay: razorpay as any,
      alertChannel: alertChannel as any,
    });

    expect(mockAssertAllowedTransition).toHaveBeenCalledWith('CREATED', 'PAYMENT_RECOVERABLE');
  });
});

// ---------------------------------------------------------------------------
// Test 4: Zombie permanent failure scenario
// ---------------------------------------------------------------------------

describe('Integration: Zombie permanent failure scenario', () => {
  it('permanently marks zombie FAILED when zombieRecoveryAttempts = 2 (reaches limit after increment)', async () => {
    const zombie = makeZombieIntent({
      zombieRecoveryAttempts: 2, // after increment = 3 → permanent failure
      gatewayCreateAttemptedAt: new Date(Date.now() - 5 * 60 * 1000),
      status: 'CREATED',
    });

    // Seed: zombie with 2 attempts (will hit limit on this run)
    mockZombieIntentFindReturns([zombie]);

    const razorpay = makeMockRazorpay({ items: [] });
    const alertChannel = makeMockAlertChannel();

    // Atomic claim succeeds
    mockPaymentIntentUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);

    // Execute fix callbacks so PaymentIntent.updateOne and Order.updateOne are called
    mockAuditLogCreate.mockImplementation(async (doc: any) => {
      return { _id: new mongoose.Types.ObjectId(), ...doc } as any;
    });

    await runReconciliationOnce('ZOMBIE', {
      razorpay: razorpay as any,
      alertChannel: alertChannel as any,
    });

    // Verify PaymentIntent was marked FAILED with isLocked = true
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

    // Verify audit entry was created with AUTO_FIXED
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ZOMBIE_GATEWAY_RECOVERY',
        action: 'AUTO_FIXED',
        afterState: expect.objectContaining({
          status: 'FAILED',
          isLocked: true,
        }),
      })
    );
  });

  it('marks associated Order FAILED only when Order is still PENDING', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const zombie = makeZombieIntent({
      orderId,
      zombieRecoveryAttempts: 2,
      gatewayCreateAttemptedAt: new Date(Date.now() - 5 * 60 * 1000),
    });

    mockZombieIntentFindReturns([zombie]);

    const razorpay = makeMockRazorpay({ items: [] });
    const alertChannel = makeMockAlertChannel();

    mockPaymentIntentUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);

    // Execute fix callbacks
    mockAuditLogCreate.mockImplementation(async (doc: any) => {
      return { _id: new mongoose.Types.ObjectId(), ...doc } as any;
    });

    await runReconciliationOnce('ZOMBIE', {
      razorpay: razorpay as any,
      alertChannel: alertChannel as any,
    });

    // Verify Order.updateOne was called with PENDING guard
    expect(mockOrderUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: orderId,
        paymentStatus: 'PENDING',
      }),
      expect.objectContaining({
        $set: expect.objectContaining({ paymentStatus: 'FAILED' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// Test 5: Missing idempotencyKey scenario
// ---------------------------------------------------------------------------

describe('Integration: Missing idempotencyKey scenario', () => {
  it('creates audit entry without modifying the Order document', async () => {
    const orderId = new mongoose.Types.ObjectId();

    // Seed: order with missing idempotencyKey
    const ordersWithMissingKey = [{
      _id: orderId,
      userId: new mongoose.Types.ObjectId(),
      idempotencyKey: null,
      createdAt: new Date(),
    }];

    // Mock Order.find for the missing-key scan
    mockOrderFind
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(ordersWithMissingKey),
      } as any)
      .mockReturnValue({
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      } as any);

    // Mock Order.aggregate for dup-key and dup-cart scans
    (Order.aggregate as jest.Mock).mockResolvedValue([]);

    const alertChannel = makeMockAlertChannel();

    await runReconciliationOnce('IDEMPOTENCY', {
      alertChannel: alertChannel as any,
    });

    // Verify audit entry was created for IDEMPOTENCY_VIOLATION
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'IDEMPOTENCY_VIOLATION',
        action: 'FLAGGED_FOR_REVIEW',
        orderId,
      })
    );

    // Verify Order was NOT modified (read-only auditor)
    expect(mockOrderUpdateOne).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 6: Idempotency — same FALSE_PAID scenario run twice
// ---------------------------------------------------------------------------

describe('Integration: Idempotency (dedupeKey prevents duplicate audit entries)', () => {
  it('applyFix is called both times but second call returns { applied: false }', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const order = makePaidOrder({
      _id: orderId,
      razorpayOrderId: 'order_IDEMPOTENCY_TEST',
      activePaymentIntentId: null,
    });

    // Razorpay returns no payments → FALSE_PAID
    const razorpay = makeMockRazorpay({ items: [] });
    const alertChannel = makeMockAlertChannel();

    // ── First run ──────────────────────────────────────────────────────────
    mockOrderFindReturns([order]);

    // First run: audit log create succeeds
    mockAuditLogCreate.mockResolvedValueOnce({
      _id: new mongoose.Types.ObjectId(),
      category: 'FALSE_PAID',
      action: 'FLAGGED_FOR_REVIEW',
    } as any);

    await runReconciliationOnce('LEDGER', {
      razorpay: razorpay as any,
      alertChannel: alertChannel as any,
    });

    const firstRunAuditCalls = mockAuditLogCreate.mock.calls.length;
    expect(firstRunAuditCalls).toBeGreaterThan(0);

    // Verify first run created an audit entry with FALSE_PAID
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'FALSE_PAID',
        dedupeKey: expect.stringContaining('FALSE_PAID'),
      })
    );

    // ── Second run ─────────────────────────────────────────────────────────
    jest.clearAllMocks();

    // Re-seed the same order
    mockOrderFindReturns([order]);

    // Second run: audit log create throws E11000 (dedupeKey already exists)
    const e11000 = Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
    mockAuditLogCreate.mockRejectedValueOnce(e11000);

    // Re-setup other mocks
    mockReportCreate.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      runId: 'test-run-2',
      subService: 'LEDGER',
      generatedAt: new Date(),
      totalScanned: 0,
      falsePaidCount: 0,
      phantomPaidCount: 0,
      orphanLedgerCount: 0,
      missingLedgerCount: 0,
      amountMismatchCount: 0,
      partialCaptureCount: 0,
      piStatusMismatchCount: 0,
      zombieRecoveredCount: 0,
      zombieFailedCount: 0,
      idempotencyViolationCount: 0,
      mismatchCount: 0,
      mismatchRate: 0,
      autoFixedCount: 0,
      manualReviewCount: 0,
      criticalAnomalyCount: 0,
      errorCount: 0,
    } as any);

    mockLedgerEntryAggregate.mockResolvedValue([]);
    mockOrderUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);
    mockPaymentIntentFindById.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    } as any);
    mockPaymentIntentFindOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    } as any);
    mockLedgerEntryFindOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    } as any);

    const alertChannel2 = makeMockAlertChannel();

    await runReconciliationOnce('LEDGER', {
      razorpay: razorpay as any,
      alertChannel: alertChannel2 as any,
    });

    // Second run: applyFix was called (audit log create was attempted)
    // but returned { applied: false } because E11000 was thrown
    expect(mockAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'FALSE_PAID',
        dedupeKey: expect.stringContaining('FALSE_PAID'),
      })
    );

    // The fix callback (Order.updateOne for reconciliationFlag) should NOT have been called
    // because applyFix returned { applied: false } after E11000
    expect(mockOrderUpdateOne).not.toHaveBeenCalledWith(
      expect.objectContaining({ _id: orderId }),
      expect.objectContaining({
        $set: expect.objectContaining({ reconciliationFlag: 'FALSE_PAID_UNRESOLVED' }),
      })
    );
  });
});
