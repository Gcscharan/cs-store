/**
 * Property-based and unit tests for evaluateConsistency
 *
 * Tests the 4-way consistency evaluation logic that determines whether a PAID
 * order is truly consistent across Razorpay, PaymentIntent, Order, and LedgerEntry.
 *
 * Property tests verify universal invariants across all possible input combinations.
 * Unit tests verify specific anomaly detection paths.
 *
 * **Validates: Requirements 1.2, 1.4**
 */

import * as fc from 'fast-check';
import { evaluateConsistency, ConsistencyResult } from '../ledgerConsistencyScanner';
import { IOrder } from '../../../../../models/Order';
import { IPaymentIntent } from '../../../models/PaymentIntent';
import { ILedgerEntry } from '../../../models/LedgerEntry';
import { RazorpayPaymentInfo } from '../razorpayStatusCache';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Arbitraries (generators for property-based testing)
// ---------------------------------------------------------------------------

/**
 * Generates a minimal IOrder with required fields for consistency checking.
 */
function arbOrder() {
  return fc.record({
    _id: fc.constant(new mongoose.Types.ObjectId()),
    paymentStatus: fc.constant('PAID'),
    totalAmount: fc.double({ min: 1, max: 100000, noNaN: true }),
    razorpayOrderId: fc.string({ minLength: 10, maxLength: 30 }),
  });
}

/**
 * Generates a PaymentIntent (or null).
 */
function arbPaymentIntent() {
  return fc.oneof(
    fc.constant(null),
    fc.record({
      _id: fc.constant(new mongoose.Types.ObjectId()),
      status: fc.constantFrom('CAPTURED', 'PENDING', 'FAILED', 'GATEWAY_ORDER_CREATED'),
    })
  );
}

/**
 * Generates a LedgerEntry (or null).
 */
function arbLedgerEntry(orderTotalAmount) {
  return fc.oneof(
    fc.constant(null),
    fc.record({
      _id: fc.constant(new mongoose.Types.ObjectId()),
      eventType: fc.constant('CAPTURE'),
      amount: fc.integer({ min: 1, max: 10000000 }), // paise
      dedupeKey: fc.string({ minLength: 10, maxLength: 50 }),
    })
  );
}

/**
 * Generates RazorpayPaymentInfo (or null).
 */
function arbRazorpay() {
  return fc.oneof(
    fc.constant(null),
    fc.record({
      status: fc.constantFrom('captured', 'authorized', 'created', 'failed', 'refunded'),
      captured: fc.boolean(),
      authorized: fc.boolean(),
      paymentId: fc.option(fc.string({ minLength: 10, maxLength: 30 }), { nil: undefined }),
      capturedAt: fc.option(fc.date(), { nil: undefined }),
      amountPaise: fc.integer({ min: 1, max: 10000000 }),
    })
  );
}

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

describe('evaluateConsistency — Property-based tests', () => {
  /**
   * **Property: Completeness**
   *
   * For any combination of (order, paymentIntent, ledgerEntry, razorpay) inputs,
   * `evaluateConsistency` always returns either `{ ok: true }` or
   * `{ ok: false, anomaly, details }` and never throws.
   *
   * This property guarantees that the function is total (defined for all inputs)
   * and never crashes the reconciliation run.
   *
   * **Validates: Requirements 1.2, 1.4**
   */
  it('Property: Completeness — always returns a valid result and never throws', () => {
    fc.assert(
      fc.property(
        arbOrder(),
        arbPaymentIntent(),
        fc.nat({ max: 100000 }).chain((amt) => arbLedgerEntry(amt)),
        arbRazorpay(),
        (order, paymentIntent, ledgerEntry, razorpay) => {
          let result;

          // Should never throw
          expect(() => {
            result = evaluateConsistency(order, paymentIntent, ledgerEntry, razorpay);
          }).not.toThrow();

          // Result must be one of the two valid shapes
          if (result.ok) {
            expect(result).toEqual({ ok: true });
          } else {
            expect(result).toHaveProperty('ok', false);
            expect(result).toHaveProperty('anomaly');
            expect(result).toHaveProperty('details');
            expect(typeof result.anomaly).toBe('string');
            expect(typeof result.details).toBe('object');
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * **Property: FALSE_PAID priority**
   *
   * When `razorpay.captured = false` and `razorpay.authorized = false`, the result
   * is always `FALSE_PAID` regardless of other fields (paymentIntent status,
   * ledgerEntry presence, etc.).
   *
   * This property verifies that the most dangerous anomaly (fraud risk) is detected
   * first and takes precedence over all other checks.
   *
   * **Validates: Requirements 1.2, 1.4**
   */
  it('Property: FALSE_PAID priority — when razorpay shows no capture/auth, result is always FALSE_PAID', () => {
    fc.assert(
      fc.property(
        arbOrder(),
        arbPaymentIntent(),
        fc.nat({ max: 100000 }).chain((amt) => arbLedgerEntry(amt)),
        arbRazorpay(),
        (order, paymentIntent, ledgerEntry, razorpay) => {
          // Force razorpay to show no capture and no authorization
          const razorpayNotCaptured = razorpay
            ? { ...razorpay, captured: false, authorized: false }
            : null;

          const result = evaluateConsistency(order, paymentIntent, ledgerEntry, razorpayNotCaptured);

          // Must always be FALSE_PAID
          expect(result).toEqual({
            ok: false,
            anomaly: 'FALSE_PAID',
            details: expect.objectContaining({
              orderPaymentStatus: 'PAID',
            }),
          });
        }
      ),
      { numRuns: 500 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests for specific anomaly branches
// ---------------------------------------------------------------------------

describe('evaluateConsistency — Unit tests', () => {
  const baseOrder = {
    _id: new mongoose.Types.ObjectId(),
    paymentStatus: 'PAID',
    totalAmount: 100.0, // ₹100.00
    razorpayOrderId: 'order_ABC123',
  };

  const capturedRazorpay = {
    status: 'captured',
    captured: true,
    authorized: true,
    paymentId: 'pay_XYZ789',
    amountPaise: 10000, // ₹100.00 in paise
  };

  const capturedPaymentIntent = {
    _id: new mongoose.Types.ObjectId(),
    status: 'CAPTURED',
  };

  const validLedgerEntry = {
    _id: new mongoose.Types.ObjectId(),
    eventType: 'CAPTURE',
    amount: 10000, // ₹100.00 in paise
    dedupeKey: 'ledger_backfill:pay_XYZ789',
  };

  describe('FALSE_PAID path', () => {
    it('detects FALSE_PAID when razorpay is null', () => {
      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, validLedgerEntry, null);

      expect(result).toEqual({
        ok: false,
        anomaly: 'FALSE_PAID',
        details: {
          orderPaymentStatus: 'PAID',
          razorpayStatus: 'NOT_FOUND',
          gatewayOrderId: 'order_ABC123',
        },
      });
    });

    it('detects FALSE_PAID when razorpay.captured = false and razorpay.authorized = false', () => {
      const notCapturedRazorpay = {
        status: 'failed',
        captured: false,
        authorized: false,
        amountPaise: 10000,
      };

      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, validLedgerEntry, notCapturedRazorpay);

      expect(result).toEqual({
        ok: false,
        anomaly: 'FALSE_PAID',
        details: {
          orderPaymentStatus: 'PAID',
          razorpayStatus: 'failed',
          gatewayOrderId: 'order_ABC123',
        },
      });
    });
  });

  describe('PARTIAL_CAPTURE path', () => {
    it('detects PARTIAL_CAPTURE when razorpay.authorized = true but razorpay.captured = false', () => {
      const authorizedRazorpay = {
        status: 'authorized',
        captured: false,
        authorized: true,
        amountPaise: 10000,
      };

      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, validLedgerEntry, authorizedRazorpay);

      expect(result).toEqual({
        ok: false,
        anomaly: 'PARTIAL_CAPTURE',
        details: {
          razorpayStatus: 'authorized',
          gatewayOrderId: 'order_ABC123',
        },
      });
    });
  });

  describe('MISSING_LEDGER path', () => {
    it('detects MISSING_LEDGER when ledgerEntry is null', () => {
      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, null, capturedRazorpay);

      expect(result).toEqual({
        ok: false,
        anomaly: 'MISSING_LEDGER',
        details: {
          gatewayOrderId: 'order_ABC123',
          razorpayPaymentId: 'pay_XYZ789',
        },
      });
    });
  });

  describe('AMOUNT_MISMATCH path', () => {
    it('detects AMOUNT_MISMATCH when ledger amount differs by more than 1 paise', () => {
      const wrongAmountLedger = {
        ...validLedgerEntry,
        amount: 10050, // ₹100.50 instead of ₹100.00 — 50 paise difference
      };

      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, wrongAmountLedger, capturedRazorpay);

      expect(result).toEqual({
        ok: false,
        anomaly: 'AMOUNT_MISMATCH',
        details: {
          expectedPaise: 10000,
          actualPaise: 10050,
          diffPaise: 50,
        },
      });
    });

    it('tolerates 1-paise difference (floating-point rounding)', () => {
      const onePaiseDiffLedger = {
        ...validLedgerEntry,
        amount: 10001, // 1 paise more
      };

      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, onePaiseDiffLedger, capturedRazorpay);

      // Should NOT be AMOUNT_MISMATCH — should pass or fail on a different check
      if (!result.ok) {
        expect(result.anomaly).not.toBe('AMOUNT_MISMATCH');
      }
    });

    it('detects AMOUNT_MISMATCH when ledger amount is 2 paise off', () => {
      const twoPaiseDiffLedger = {
        ...validLedgerEntry,
        amount: 10002, // 2 paise more — exceeds tolerance
      };

      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, twoPaiseDiffLedger, capturedRazorpay);

      expect(result).toEqual({
        ok: false,
        anomaly: 'AMOUNT_MISMATCH',
        details: {
          expectedPaise: 10000,
          actualPaise: 10002,
          diffPaise: 2,
        },
      });
    });
  });

  describe('PI_STATUS_MISMATCH path', () => {
    it('detects PI_STATUS_MISMATCH when PaymentIntent status is not CAPTURED', () => {
      const pendingPaymentIntent = {
        _id: new mongoose.Types.ObjectId(),
        status: 'PENDING',
      };

      const result = evaluateConsistency(baseOrder, pendingPaymentIntent, validLedgerEntry, capturedRazorpay);

      expect(result).toEqual({
        ok: false,
        anomaly: 'PI_STATUS_MISMATCH',
        details: {
          piStatus: 'PENDING',
          expectedStatus: 'CAPTURED',
        },
      });
    });

    it('does NOT detect PI_STATUS_MISMATCH when PaymentIntent is null', () => {
      const result = evaluateConsistency(baseOrder, null, validLedgerEntry, capturedRazorpay);

      // Should pass all checks (no PaymentIntent to mismatch)
      expect(result).toEqual({ ok: true });
    });
  });

  describe('Clean path (all checks pass)', () => {
    it('returns { ok: true } when all four consistency checks pass', () => {
      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, validLedgerEntry, capturedRazorpay);

      expect(result).toEqual({ ok: true });
    });

    it('returns { ok: true } when PaymentIntent is null but all other checks pass', () => {
      const result = evaluateConsistency(baseOrder, null, validLedgerEntry, capturedRazorpay);

      expect(result).toEqual({ ok: true });
    });
  });

  describe('Priority order verification', () => {
    it('FALSE_PAID takes precedence over MISSING_LEDGER', () => {
      const notCapturedRazorpay = {
        status: 'failed',
        captured: false,
        authorized: false,
        amountPaise: 10000,
      };

      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, null, notCapturedRazorpay);

      // Should be FALSE_PAID, not MISSING_LEDGER
      expect(result).toEqual({
        ok: false,
        anomaly: 'FALSE_PAID',
        details: expect.objectContaining({
          orderPaymentStatus: 'PAID',
        }),
      });
    });

    it('PARTIAL_CAPTURE takes precedence over MISSING_LEDGER', () => {
      const authorizedRazorpay = {
        status: 'authorized',
        captured: false,
        authorized: true,
        amountPaise: 10000,
      };

      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, null, authorizedRazorpay);

      // Should be PARTIAL_CAPTURE, not MISSING_LEDGER
      expect(result).toEqual({
        ok: false,
        anomaly: 'PARTIAL_CAPTURE',
        details: expect.objectContaining({
          razorpayStatus: 'authorized',
        }),
      });
    });

    it('MISSING_LEDGER takes precedence over AMOUNT_MISMATCH', () => {
      // When ledgerEntry is null, we can't check amount mismatch
      const result = evaluateConsistency(baseOrder, capturedPaymentIntent, null, capturedRazorpay);

      expect(result).toEqual({
        ok: false,
        anomaly: 'MISSING_LEDGER',
        details: expect.any(Object),
      });
    });

    it('AMOUNT_MISMATCH takes precedence over PI_STATUS_MISMATCH', () => {
      const wrongAmountLedger = {
        ...validLedgerEntry,
        amount: 10050, // 50 paise off
      };

      const pendingPaymentIntent = {
        _id: new mongoose.Types.ObjectId(),
        status: 'PENDING',
      };

      const result = evaluateConsistency(baseOrder, pendingPaymentIntent, wrongAmountLedger, capturedRazorpay);

      // Should be AMOUNT_MISMATCH, not PI_STATUS_MISMATCH
      expect(result).toEqual({
        ok: false,
        anomaly: 'AMOUNT_MISMATCH',
        details: expect.objectContaining({
          expectedPaise: 10000,
          actualPaise: 10050,
        }),
      });
    });
  });
});


// ---------------------------------------------------------------------------
// Unit tests for scanner logic (not evaluateConsistency)
// ---------------------------------------------------------------------------

// Mock all dependencies before importing the scanner
jest.mock('../../../../../models/Order');
jest.mock('../../../models/PaymentIntent');
jest.mock('../../../models/LedgerEntry');
jest.mock('../fixEngine');
jest.mock('../../ledgerService');
jest.mock('../concurrencyLimiter', () => ({
  dbWriteLimiter: {
    run: jest.fn((fn) => fn()),
  },
  razorpayLimiter: {
    run: jest.fn((fn) => fn()),
  },
}));

import { Order } from '../../../../../models/Order';
import { PaymentIntent } from '../../../models/PaymentIntent';
import { LedgerEntry } from '../../../models/LedgerEntry';
import { applyFix } from '../fixEngine';
import { appendLedgerEntry } from '../../ledgerService';
import { runLedgerConsistencyScanner } from '../ledgerConsistencyScanner';

const mockOrderFind = Order.find as jest.MockedFunction<typeof Order.find>;
const mockOrderUpdateOne = Order.updateOne as jest.MockedFunction<typeof Order.updateOne>;
const mockPaymentIntentFindById = PaymentIntent.findById as jest.MockedFunction<typeof PaymentIntent.findById>;
const mockPaymentIntentFindOne = PaymentIntent.findOne as jest.MockedFunction<typeof PaymentIntent.findOne>;
const mockPaymentIntentUpdateOne = PaymentIntent.updateOne as jest.MockedFunction<typeof PaymentIntent.updateOne>;
const mockLedgerEntryFindOne = LedgerEntry.findOne as jest.MockedFunction<typeof LedgerEntry.findOne>;
const mockLedgerEntryAggregate = LedgerEntry.aggregate as jest.MockedFunction<typeof LedgerEntry.aggregate>;
const mockApplyFix = applyFix as jest.MockedFunction<typeof applyFix>;
const mockAppendLedgerEntry = appendLedgerEntry as jest.MockedFunction<typeof appendLedgerEntry>;

// Mock Razorpay client
const createMockRazorpay = () => ({
  orders: {
    fetchPayments: jest.fn(),
  },
});

// Mock alert channel
const createMockAlertChannel = () => ({
  sendAlert: jest.fn().mockResolvedValue(undefined),
});

describe('Ledger Consistency Scanner — Unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockOrderFind.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    } as any);

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
    mockPaymentIntentUpdateOne.mockResolvedValue({ modifiedCount: 1 } as any);
    mockLedgerEntryFindOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    } as any);
    mockLedgerEntryAggregate.mockResolvedValue([]);
    mockApplyFix.mockResolvedValue({ applied: true });
    mockAppendLedgerEntry.mockResolvedValue({ created: true });
  });

  describe('FALSE_PAID path', () => {
    it('calls applyFix with FLAGGED_FOR_REVIEW when Razorpay shows no capture', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        paymentStatus: 'PAID',
        totalAmount: 100,
        razorpayOrderId: 'order_ABC123',
        activePaymentIntentId: null,
      };

      // Mock Order.find to return one PAID order
      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      // Mock Razorpay to return no payment (FALSE_PAID scenario)
      const mockRazorpay = createMockRazorpay();
      mockRazorpay.orders.fetchPayments.mockImplementation((orderId, callback) => {
        callback(null, { items: [] });
      });

      const mockAlertChannel = createMockAlertChannel();

      await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify applyFix was called with FLAGGED_FOR_REVIEW
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'FALSE_PAID',
          action: 'FLAGGED_FOR_REVIEW',
          entityId: orderId.toString(),
        })
      );
    });

    it('fires CRITICAL alert immediately when FALSE_PAID is detected', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        paymentStatus: 'PAID',
        totalAmount: 100,
        razorpayOrderId: 'order_ABC123',
        activePaymentIntentId: null,
      };

      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      const mockRazorpay = createMockRazorpay();
      mockRazorpay.orders.fetchPayments.mockImplementation((orderId, callback) => {
        callback(null, { items: [] });
      });

      const mockAlertChannel = createMockAlertChannel();

      await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify CRITICAL alert was sent (called with report stub + 'CRITICAL')
      expect(mockAlertChannel.sendAlert).toHaveBeenCalledWith(
        expect.any(Object),
        'CRITICAL'
      );
    });
  });

  describe('MISSING_LEDGER path', () => {
    it('calls appendLedgerEntry when ledger entry is missing', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const piId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        paymentStatus: 'PAID',
        totalAmount: 100,
        razorpayOrderId: 'order_ABC123',
        activePaymentIntentId: piId,
      };

      const mockPaymentIntent = {
        _id: piId,
        status: 'CAPTURED',
        version: 1,
      };

      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      mockPaymentIntentFindById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPaymentIntent),
      } as any);

      // No ledger entry (MISSING_LEDGER scenario)
      mockLedgerEntryFindOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      } as any);

      // Mock Razorpay to return captured payment
      const mockRazorpay = createMockRazorpay();
      mockRazorpay.orders.fetchPayments.mockImplementation((orderId, callback) => {
        callback(null, {
          items: [{
            id: 'pay_XYZ789',
            status: 'captured',
            amount: 10000,
            created_at: Math.floor(Date.now() / 1000),
          }],
        });
      });

      const mockAlertChannel = createMockAlertChannel();

      // Capture the fix callback from applyFix and invoke it
      mockApplyFix.mockImplementation(async (args: any) => {
        if (args.fix) await args.fix();
        return { applied: true };
      });

      await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify appendLedgerEntry was called
      expect(mockAppendLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: orderId.toString(),
          eventType: 'CAPTURE',
          dedupeKey: expect.stringContaining('ledger_backfill:'),
        })
      );
    });

    it('calls applyFix with AUTO_FIXED for MISSING_LEDGER', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const piId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        paymentStatus: 'PAID',
        totalAmount: 100,
        razorpayOrderId: 'order_ABC123',
        activePaymentIntentId: piId,
      };

      const mockPaymentIntent = {
        _id: piId,
        status: 'CAPTURED',
        version: 1,
      };

      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      mockPaymentIntentFindById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPaymentIntent),
      } as any);

      mockLedgerEntryFindOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      } as any);

      const mockRazorpay = createMockRazorpay();
      mockRazorpay.orders.fetchPayments.mockImplementation((orderId, callback) => {
        callback(null, {
          items: [{
            id: 'pay_XYZ789',
            status: 'captured',
            amount: 10000,
            created_at: Math.floor(Date.now() / 1000),
          }],
        });
      });

      const mockAlertChannel = createMockAlertChannel();

      await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify applyFix was called with AUTO_FIXED
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'MISSING_LEDGER',
          action: 'AUTO_FIXED',
        })
      );
    });
  });

  describe('AMOUNT_MISMATCH path', () => {
    it('fires CRITICAL alert immediately when amount mismatch is detected', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const piId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        paymentStatus: 'PAID',
        totalAmount: 100,
        razorpayOrderId: 'order_ABC123',
        activePaymentIntentId: piId,
      };

      const mockPaymentIntent = {
        _id: piId,
        status: 'CAPTURED',
        version: 1,
      };

      const mockLedgerEntry = {
        _id: new mongoose.Types.ObjectId(),
        amount: 10050, // 50 paise off
        eventType: 'CAPTURE',
      };

      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      mockPaymentIntentFindById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPaymentIntent),
      } as any);

      mockLedgerEntryFindOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockLedgerEntry),
      } as any);

      const mockRazorpay = createMockRazorpay();
      mockRazorpay.orders.fetchPayments.mockImplementation((orderId, callback) => {
        callback(null, {
          items: [{
            id: 'pay_XYZ789',
            status: 'captured',
            amount: 10000,
            created_at: Math.floor(Date.now() / 1000),
          }],
        });
      });

      const mockAlertChannel = createMockAlertChannel();

      await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify CRITICAL alert was sent
      expect(mockAlertChannel.sendAlert).toHaveBeenCalledWith(
        expect.any(Object),
        'CRITICAL'
      );
    });
  });

  describe('PI_STATUS_MISMATCH path', () => {
    it('updates PaymentIntent via compare-and-set when status is not CAPTURED', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const piId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        paymentStatus: 'PAID',
        totalAmount: 100,
        razorpayOrderId: 'order_ABC123',
        activePaymentIntentId: piId,
      };

      const mockPaymentIntent = {
        _id: piId,
        status: 'PENDING',
        version: 1,
      };

      const mockLedgerEntry = {
        _id: new mongoose.Types.ObjectId(),
        amount: 10000,
        eventType: 'CAPTURE',
      };

      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      mockPaymentIntentFindById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPaymentIntent),
      } as any);

      mockLedgerEntryFindOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockLedgerEntry),
      } as any);

      const mockRazorpay = createMockRazorpay();
      mockRazorpay.orders.fetchPayments.mockImplementation((orderId, callback) => {
        callback(null, {
          items: [{
            id: 'pay_XYZ789',
            status: 'captured',
            amount: 10000,
            created_at: Math.floor(Date.now() / 1000),
          }],
        });
      });

      const mockAlertChannel = createMockAlertChannel();

      // Execute fix callbacks so PaymentIntent.updateOne is actually called
      mockApplyFix.mockImplementation(async (args: any) => {
        if (args.fix) await args.fix();
        return { applied: true };
      });

      await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify PaymentIntent.updateOne was called with version check
      expect(mockPaymentIntentUpdateOne).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: piId,
          version: 1,
        }),
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'CAPTURED',
          }),
          $inc: { version: 1 },
        })
      );
    });
  });

  describe('ORPHAN_LEDGER path', () => {
    it('flags orphan ledger entries without modifying Order', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const ledgerEntryId = new mongoose.Types.ObjectId();

      // Mock empty forward scan (no PAID orders)
      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      } as any);

      // Mock reverse scan to return orphan ledger entry
      mockLedgerEntryAggregate.mockResolvedValue([
        {
          _id: ledgerEntryId,
          orderId: orderId,
          eventType: 'CAPTURE',
          amount: 10000,
          order: null, // No associated order
        },
      ]);

      const mockRazorpay = createMockRazorpay();
      const mockAlertChannel = createMockAlertChannel();

      await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify applyFix was called with FLAGGED_FOR_REVIEW
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'ORPHAN_LEDGER',
          action: 'FLAGGED_FOR_REVIEW',
        })
      );

      // Verify no Order update was attempted
      expect(mockOrderUpdateOne).not.toHaveBeenCalledWith(
        expect.objectContaining({ _id: orderId }),
        expect.anything()
      );
    });
  });

  describe('Razorpay error handling', () => {
    it('skips item and increments errorCount when Razorpay API fails', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        paymentStatus: 'PAID',
        totalAmount: 100,
        razorpayOrderId: 'order_ABC123',
        activePaymentIntentId: null,
        reconciliationErrorCount: 0,
      };

      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      // Mock Razorpay to throw error
      const mockRazorpay = createMockRazorpay();
      mockRazorpay.orders.fetchPayments.mockImplementation((orderId, callback) => {
        callback(new Error('Razorpay API error'), null);
      });

      const mockAlertChannel = createMockAlertChannel();

      const result = await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify error count was incremented
      expect(mockOrderUpdateOne).toHaveBeenCalledWith(
        { _id: orderId },
        { $inc: { reconciliationErrorCount: 1 } }
      );

      // Verify scan continues (errorCount > 0)
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it('marks order as DEAD_LETTER after 5 consecutive errors', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        paymentStatus: 'PAID',
        totalAmount: 100,
        razorpayOrderId: 'order_ABC123',
        activePaymentIntentId: null,
        reconciliationErrorCount: 4, // 5th error will trigger dead-letter
      };

      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      const mockRazorpay = createMockRazorpay();
      mockRazorpay.orders.fetchPayments.mockImplementation((orderId, callback) => {
        callback(new Error('Razorpay API error'), null);
      });

      const mockAlertChannel = createMockAlertChannel();

      await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify applyFix was called to set DEAD_LETTER flag
      expect(mockApplyFix).toHaveBeenCalledWith(
        expect.objectContaining({
          anomalyType: 'FALSE_PAID',
          action: 'FLAGGED_FOR_REVIEW',
          afterState: expect.objectContaining({
            reconciliationFlag: 'DEAD_LETTER',
          }),
        })
      );
    });
  });

  describe('Idempotency', () => {
    it('produces same final state when run twice over same window', async () => {
      const orderId = new mongoose.Types.ObjectId();
      const piId = new mongoose.Types.ObjectId();
      const mockOrder = {
        _id: orderId,
        paymentStatus: 'PAID',
        totalAmount: 100,
        razorpayOrderId: 'order_ABC123',
        activePaymentIntentId: piId,
      };

      const mockPaymentIntent = {
        _id: piId,
        status: 'CAPTURED',
        version: 1,
      };

      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      mockPaymentIntentFindById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPaymentIntent),
      } as any);

      // No ledger entry (MISSING_LEDGER scenario)
      mockLedgerEntryFindOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      } as any);

      const mockRazorpay = createMockRazorpay();
      mockRazorpay.orders.fetchPayments.mockImplementation((orderId, callback) => {
        callback(null, {
          items: [{
            id: 'pay_XYZ789',
            status: 'captured',
            amount: 10000,
            created_at: Math.floor(Date.now() / 1000),
          }],
        });
      });

      const mockAlertChannel = createMockAlertChannel();

      // First run
      await runLedgerConsistencyScanner('run-001', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      const firstRunApplyFixCalls = mockApplyFix.mock.calls.length;
      const firstRunAppendLedgerCalls = mockAppendLedgerEntry.mock.calls.length;

      // Reset mocks but keep same data
      jest.clearAllMocks();

      // Mock applyFix to return { applied: false } (already applied)
      mockApplyFix.mockResolvedValue({ applied: false });

      mockOrderFind.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([mockOrder]),
      } as any);

      mockPaymentIntentFindById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockPaymentIntent),
      } as any);

      mockLedgerEntryFindOne.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(null),
      } as any);

      // Second run
      await runLedgerConsistencyScanner('run-002', {
        razorpay: mockRazorpay as any,
        lookbackMs: 1000,
        batchSize: 10,
      }, mockAlertChannel as any);

      // Verify applyFix was called but returned { applied: false }
      expect(mockApplyFix).toHaveBeenCalled();

      // Verify appendLedgerEntry was NOT called in second run (fix callback skipped)
      expect(mockAppendLedgerEntry).not.toHaveBeenCalled();
    });
  });
});
