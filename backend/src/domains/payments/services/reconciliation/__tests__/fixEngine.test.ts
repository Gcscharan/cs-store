/**
 * Unit tests for applyFix (Fix Engine)
 *
 * Tests the audit-log-first invariant, deduplication via E11000, dry-run mode,
 * and normal execution path.
 *
 * ReconciliationAuditLog.create is mocked — no real MongoDB connection needed.
 */

// Mock the ReconciliationAuditLog model before importing applyFix
jest.mock('../../../models/ReconciliationAuditLog', () => ({
  ReconciliationAuditLog: {
    create: jest.fn(),
  },
}));

// Mock the concurrencyLimiter so dbWriteLimiter.run just calls fn() directly
jest.mock('../concurrencyLimiter', () => ({
  dbWriteLimiter: {
    run: jest.fn((fn) => fn()),
  },
  razorpayLimiter: {
    run: jest.fn((fn) => fn()),
  },
  ConcurrencyLimiter: jest.requireActual('../concurrencyLimiter').ConcurrencyLimiter,
  initializeLimiters: jest.fn(),
}));

import { applyFix, FixArgs } from '../fixEngine';
import { ReconciliationAuditLog } from '../../../models/ReconciliationAuditLog';

const mockCreate = ReconciliationAuditLog.create as jest.MockedFunction<typeof ReconciliationAuditLog.create>;

/** Minimal valid FixArgs for use in tests */
const baseArgs: FixArgs = {
  anomalyType: 'FALSE_PAID',
  entityId: 'order_abc123',
  action: 'AUTO_FIXED',
  runId: 'run-001',
  subService: 'LEDGER',
  alertSeverity: 'CRITICAL',
  beforeState: { status: 'PENDING' },
  afterState: { status: 'PAID' },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('applyFix', () => {
  describe('audit log written before fix callback', () => {
    it('writes the audit log entry before invoking the fix callback', async () => {
      const callOrder: string[] = [];

      mockCreate.mockImplementation(async () => {
        callOrder.push('audit');
        return {} as any;
      });

      const fix = jest.fn(async () => {
        callOrder.push('fix');
      });

      await applyFix({ ...baseArgs, fix });

      expect(callOrder).toEqual(['audit', 'fix']);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(fix).toHaveBeenCalledTimes(1);
    });
  });

  describe('duplicate dedupeKey (E11000)', () => {
    it('returns { applied: false } when E11000 error is thrown (code 11000)', async () => {
      const e11000 = Object.assign(new Error('E11000 duplicate key error'), { code: 11000 });
      mockCreate.mockRejectedValueOnce(e11000);

      const fix = jest.fn();
      const result = await applyFix({ ...baseArgs, fix });

      expect(result).toEqual({ applied: false });
      expect(fix).not.toHaveBeenCalled();
    });

    it('returns { applied: false } when error message contains "E11000"', async () => {
      const e11000 = new Error('E11000 duplicate key error collection: test.reconciliationauditlogs');
      mockCreate.mockRejectedValueOnce(e11000);

      const fix = jest.fn();
      const result = await applyFix({ ...baseArgs, fix });

      expect(result).toEqual({ applied: false });
      expect(fix).not.toHaveBeenCalled();
    });
  });

  describe('non-E11000 DB error is re-thrown', () => {
    it('re-throws a generic DB error that is not E11000', async () => {
      const dbError = Object.assign(new Error('MongoNetworkError: connection timed out'), { code: 10107 });
      mockCreate.mockRejectedValueOnce(dbError);

      const fix = jest.fn();

      await expect(applyFix({ ...baseArgs, fix })).rejects.toThrow('MongoNetworkError: connection timed out');
      expect(fix).not.toHaveBeenCalled();
    });

    it('re-throws a validation error', async () => {
      const validationError = new Error('ValidationError: dedupeKey is required');
      mockCreate.mockRejectedValueOnce(validationError);

      await expect(applyFix({ ...baseArgs })).rejects.toThrow('ValidationError');
    });
  });

  describe('dryRun = true', () => {
    it('writes audit log with action = NO_OP when dryRun is true', async () => {
      mockCreate.mockResolvedValueOnce({} as any);

      const fix = jest.fn();
      await applyFix({ ...baseArgs, fix, dryRun: true });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const createArg = mockCreate.mock.calls[0][0] as any;
      expect(createArg.action).toBe('NO_OP');
    });

    it('does NOT call the fix callback when dryRun is true', async () => {
      mockCreate.mockResolvedValueOnce({} as any);

      const fix = jest.fn();
      await applyFix({ ...baseArgs, fix, dryRun: true });

      expect(fix).not.toHaveBeenCalled();
    });

    it('returns { applied: true } in dry-run mode', async () => {
      mockCreate.mockResolvedValueOnce({} as any);

      const result = await applyFix({ ...baseArgs, dryRun: true });

      expect(result).toEqual({ applied: true });
    });
  });

  describe('normal path', () => {
    it('returns { applied: true } when fix is applied successfully', async () => {
      mockCreate.mockResolvedValueOnce({} as any);

      const fix = jest.fn().mockResolvedValueOnce(undefined);
      const result = await applyFix({ ...baseArgs, fix });

      expect(result).toEqual({ applied: true });
    });

    it('calls the fix callback exactly once', async () => {
      mockCreate.mockResolvedValueOnce({} as any);

      const fix = jest.fn().mockResolvedValueOnce(undefined);
      await applyFix({ ...baseArgs, fix });

      expect(fix).toHaveBeenCalledTimes(1);
    });

    it('writes audit log with the correct action (not NO_OP) in normal mode', async () => {
      mockCreate.mockResolvedValueOnce({} as any);

      await applyFix({ ...baseArgs });

      const createArg = mockCreate.mock.calls[0][0] as any;
      expect(createArg.action).toBe('AUTO_FIXED');
    });

    it('constructs dedupeKey as "{anomalyType}:{entityId}:{action}"', async () => {
      mockCreate.mockResolvedValueOnce({} as any);

      await applyFix({ ...baseArgs });

      const createArg = mockCreate.mock.calls[0][0] as any;
      expect(createArg.dedupeKey).toBe('FALSE_PAID:order_abc123:AUTO_FIXED');
    });

    it('works without a fix callback (FLAGGED_FOR_REVIEW case)', async () => {
      mockCreate.mockResolvedValueOnce({} as any);

      const result = await applyFix({ ...baseArgs, action: 'FLAGGED_FOR_REVIEW', fix: undefined });

      expect(result).toEqual({ applied: true });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });
});
