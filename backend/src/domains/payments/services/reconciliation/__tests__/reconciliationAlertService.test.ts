/**
 * Unit tests for LogAlertChannel
 *
 * Validates that LogAlertChannel routes alerts to the correct logger level
 * based on severity, and that every log entry carries the [RECONCILIATION_ALERT]
 * label together with the full set of required report fields.
 *
 * The logger is mocked — no real MongoDB connection is needed.
 *
 * Validates: Requirements 3.7
 */

// Mock the logger before importing the service under test
jest.mock('../../../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { LogAlertChannel } from '../reconciliationAlertService';
import { logger } from '../../../../../utils/logger';
import { IReconciliationReport } from '../../../models/ReconciliationReport';
import { AlertSeverity } from '../../../models/ReconciliationAuditLog';

// Cast mocked logger methods for type-safe assertions
const mockError = logger.error as jest.MockedFunction<typeof logger.error>;
const mockWarn  = logger.warn  as jest.MockedFunction<typeof logger.warn>;
const mockInfo  = logger.info  as jest.MockedFunction<typeof logger.info>;

/** Minimal IReconciliationReport stub used across all tests */
const baseReport: Partial<IReconciliationReport> = {
  runId: 'run-test-001',
  subService: 'LEDGER',
  falsePaidCount: 2,
  amountMismatchCount: 3,
  orphanLedgerCount: 1,
  partialCaptureCount: 0,
  mismatchRate: 5.5,
  criticalAnomalyCount: 5,
  totalScanned: 100,
  generatedAt: new Date('2024-01-15T10:00:00.000Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LogAlertChannel', () => {
  const channel = new LogAlertChannel();

  // ─── Severity → log level routing ────────────────────────────────────────

  describe('severity routing', () => {
    it('calls logger.error for CRITICAL severity', async () => {
      await channel.sendAlert(baseReport as IReconciliationReport, 'CRITICAL');

      expect(mockError).toHaveBeenCalledTimes(1);
      expect(mockWarn).not.toHaveBeenCalled();
      expect(mockInfo).not.toHaveBeenCalled();
    });

    it('calls logger.warn for WARNING severity', async () => {
      await channel.sendAlert(baseReport as IReconciliationReport, 'WARNING');

      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockError).not.toHaveBeenCalled();
      expect(mockInfo).not.toHaveBeenCalled();
    });

    it('calls logger.info for INFO severity', async () => {
      await channel.sendAlert(baseReport as IReconciliationReport, 'INFO');

      expect(mockInfo).toHaveBeenCalledTimes(1);
      expect(mockError).not.toHaveBeenCalled();
      expect(mockWarn).not.toHaveBeenCalled();
    });
  });

  // ─── [RECONCILIATION_ALERT] label ────────────────────────────────────────

  describe('[RECONCILIATION_ALERT] label', () => {
    it.each<AlertSeverity>(['CRITICAL', 'WARNING', 'INFO'])(
      'includes [RECONCILIATION_ALERT] as the first argument for %s severity',
      async (severity) => {
        await channel.sendAlert(baseReport as IReconciliationReport, severity);

        const mock =
          severity === 'CRITICAL' ? mockError :
          severity === 'WARNING'  ? mockWarn  : mockInfo;

        expect(mock).toHaveBeenCalledWith(
          '[RECONCILIATION_ALERT]',
          expect.any(Object)
        );
      }
    );
  });

  // ─── Full report fields in log payload ───────────────────────────────────

  describe('log payload contains all required report fields', () => {
    const requiredFields: Array<keyof typeof baseReport | 'severity'> = [
      'runId',
      'subService',
      'falsePaidCount',
      'amountMismatchCount',
      'orphanLedgerCount',
      'partialCaptureCount',
      'mismatchRate',
      'criticalAnomalyCount',
      'totalScanned',
      'generatedAt',
    ];

    it.each<AlertSeverity>(['CRITICAL', 'WARNING', 'INFO'])(
      'payload for %s severity contains all required fields with correct values',
      async (severity) => {
        await channel.sendAlert(baseReport as IReconciliationReport, severity);

        const mock =
          severity === 'CRITICAL' ? mockError :
          severity === 'WARNING'  ? mockWarn  : mockInfo;

        const payload = (mock.mock.calls[0] as any[])[1];

        // severity is included in the payload
        expect(payload).toMatchObject({
          severity,
          runId: baseReport.runId,
          subService: baseReport.subService,
          falsePaidCount: baseReport.falsePaidCount,
          amountMismatchCount: baseReport.amountMismatchCount,
          orphanLedgerCount: baseReport.orphanLedgerCount,
          partialCaptureCount: baseReport.partialCaptureCount,
          mismatchRate: baseReport.mismatchRate,
          criticalAnomalyCount: baseReport.criticalAnomalyCount,
          totalScanned: baseReport.totalScanned,
          generatedAt: baseReport.generatedAt,
        });

        // Verify every required field key is present
        for (const field of requiredFields) {
          expect(payload).toHaveProperty(field);
        }
      }
    );
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles zero counts without throwing', async () => {
      const zeroReport: Partial<IReconciliationReport> = {
        ...baseReport,
        falsePaidCount: 0,
        amountMismatchCount: 0,
        orphanLedgerCount: 0,
        partialCaptureCount: 0,
        mismatchRate: 0,
        criticalAnomalyCount: 0,
        totalScanned: 0,
      };

      await expect(
        channel.sendAlert(zeroReport as IReconciliationReport, 'INFO')
      ).resolves.toBeUndefined();

      expect(mockInfo).toHaveBeenCalledTimes(1);
    });

    it('resolves without returning a value', async () => {
      const result = await channel.sendAlert(
        baseReport as IReconciliationReport,
        'WARNING'
      );
      expect(result).toBeUndefined();
    });
  });
});
