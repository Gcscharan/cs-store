/**
 * Unit tests for reconciliationReportService
 *
 * Tests persistReport, generateDailySummary, and getReconciliationReports functions.
 *
 * ReconciliationReport and DailyReconciliationSummary models are mocked — no real MongoDB connection needed.
 */

// Mock the models before importing the service
jest.mock('../../../models/ReconciliationReport', () => ({
  ReconciliationReport: {
    create: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock('../../../models/DailyReconciliationSummary', () => ({
  DailyReconciliationSummary: {
    findOneAndUpdate: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../../../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  persistReport,
  generateDailySummary,
  getReconciliationReports,
  type RunCounts,
} from '../reconciliationReportService';
import { ReconciliationReport } from '../../../models/ReconciliationReport';
import { DailyReconciliationSummary } from '../../../models/DailyReconciliationSummary';
import { logger } from '../../../../../utils/logger';

const mockCreate = ReconciliationReport.create as jest.MockedFunction<typeof ReconciliationReport.create>;
const mockFind = ReconciliationReport.find as jest.MockedFunction<typeof ReconciliationReport.find>;
const mockFindOneAndUpdate = DailyReconciliationSummary.findOneAndUpdate as jest.MockedFunction<
  typeof DailyReconciliationSummary.findOneAndUpdate
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('persistReport', () => {
  const baseRunCounts: RunCounts = {
    totalScanned: 100,
    falsePaidCount: 2,
    phantomPaidCount: 0,
    orphanLedgerCount: 1,
    missingLedgerCount: 3,
    amountMismatchCount: 1,
    partialCaptureCount: 0,
    piStatusMismatchCount: 0,
    zombieRecoveredCount: 5,
    zombieFailedCount: 0,
    idempotencyViolationCount: 0,
    autoFixedCount: 8,
    manualReviewCount: 4,
    errorCount: 0,
  };

  it('creates a ReconciliationReport document with correct fields', async () => {
    const mockReport = { _id: 'report-123', runId: 'run-001' };
    mockCreate.mockResolvedValueOnce(mockReport as any);

    const result = await persistReport('run-001', 'LEDGER', baseRunCounts);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0][0] as any;

    expect(createArg.runId).toBe('run-001');
    expect(createArg.subService).toBe('LEDGER');
    expect(createArg.totalScanned).toBe(100);
    expect(createArg.falsePaidCount).toBe(2);
    expect(createArg.missingLedgerCount).toBe(3);
    expect(createArg.autoFixedCount).toBe(8);
    expect(createArg.manualReviewCount).toBe(4);
    expect(result).toEqual(mockReport);
  });

  it('calculates mismatchCount as sum of all anomaly counts', async () => {
    mockCreate.mockResolvedValueOnce({} as any);

    await persistReport('run-001', 'LEDGER', baseRunCounts);

    const createArg = mockCreate.mock.calls[0][0] as any;
    // 2 + 0 + 1 + 3 + 1 + 0 + 0 + 5 + 0 + 0 = 12
    expect(createArg.mismatchCount).toBe(12);
  });

  it('calculates mismatchRate as (mismatchCount / totalScanned) * 100', async () => {
    mockCreate.mockResolvedValueOnce({} as any);

    await persistReport('run-001', 'LEDGER', baseRunCounts);

    const createArg = mockCreate.mock.calls[0][0] as any;
    // (12 / 100) * 100 = 12%
    expect(createArg.mismatchRate).toBe(12);
  });

  it('calculates criticalAnomalyCount as falsePaidCount + amountMismatchCount', async () => {
    mockCreate.mockResolvedValueOnce({} as any);

    await persistReport('run-001', 'LEDGER', baseRunCounts);

    const createArg = mockCreate.mock.calls[0][0] as any;
    // 2 + 1 = 3
    expect(createArg.criticalAnomalyCount).toBe(3);
  });

  it('handles zero totalScanned without division by zero', async () => {
    mockCreate.mockResolvedValueOnce({} as any);

    const zeroCounts: RunCounts = {
      ...baseRunCounts,
      totalScanned: 0,
    };

    await persistReport('run-001', 'LEDGER', zeroCounts);

    const createArg = mockCreate.mock.calls[0][0] as any;
    expect(createArg.mismatchRate).toBe(0);
  });

  it('logs the persisted report', async () => {
    mockCreate.mockResolvedValueOnce({} as any);

    await persistReport('run-001', 'LEDGER', baseRunCounts);

    expect(logger.info).toHaveBeenCalledWith(
      '[RECONCILIATION_REPORT_PERSISTED]',
      expect.objectContaining({
        runId: 'run-001',
        subService: 'LEDGER',
        totalScanned: 100,
        mismatchCount: 12,
        mismatchRate: 12,
        criticalAnomalyCount: 3,
      })
    );
  });
});

describe('generateDailySummary', () => {
  it('aggregates reports for the given date and upserts a summary', async () => {
    const mockReports = [
      {
        totalScanned: 100,
        mismatchCount: 10,
        autoFixedCount: 5,
        manualReviewCount: 5,
        mismatchRate: 10,
        criticalAnomalyCount: 2,
      },
      {
        totalScanned: 200,
        mismatchCount: 20,
        autoFixedCount: 15,
        manualReviewCount: 5,
        mismatchRate: 10,
        criticalAnomalyCount: 3,
      },
      {
        totalScanned: 150,
        mismatchCount: 5,
        autoFixedCount: 3,
        manualReviewCount: 2,
        mismatchRate: 3.33,
        criticalAnomalyCount: 1,
      },
    ];

    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValueOnce(mockReports),
    } as any);

    const mockSummary = { date: '2024-01-15', totalRuns: 3 };
    mockFindOneAndUpdate.mockResolvedValueOnce(mockSummary as any);

    const result = await generateDailySummary('2024-01-15');

    expect(mockFind).toHaveBeenCalledWith({
      generatedAt: {
        $gte: new Date('2024-01-15T00:00:00.000Z'),
        $lte: new Date('2024-01-15T23:59:59.999Z'),
      },
    });

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { date: '2024-01-15' },
      {
        $set: {
          totalRuns: 3,
          totalScanned: 450, // 100 + 200 + 150
          totalMismatches: 35, // 10 + 20 + 5
          totalAutoFixed: 23, // 5 + 15 + 3
          totalManualReview: 12, // 5 + 5 + 2
          peakMismatchRate: 10, // max(10, 10, 3.33)
          criticalAnomalyCount: 6, // 2 + 3 + 1
        },
      },
      { upsert: true, new: true }
    );

    expect(result).toEqual(mockSummary);
  });

  it('handles empty reports array (no runs for the date)', async () => {
    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValueOnce([]),
    } as any);

    const mockSummary = { date: '2024-01-15', totalRuns: 0 };
    mockFindOneAndUpdate.mockResolvedValueOnce(mockSummary as any);

    await generateDailySummary('2024-01-15');

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { date: '2024-01-15' },
      {
        $set: {
          totalRuns: 0,
          totalScanned: 0,
          totalMismatches: 0,
          totalAutoFixed: 0,
          totalManualReview: 0,
          peakMismatchRate: 0,
          criticalAnomalyCount: 0,
        },
      },
      { upsert: true, new: true }
    );
  });

  it('logs the generated summary', async () => {
    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValueOnce([]),
    } as any);

    mockFindOneAndUpdate.mockResolvedValueOnce({ date: '2024-01-15' } as any);

    await generateDailySummary('2024-01-15');

    expect(logger.info).toHaveBeenCalledWith(
      '[RECONCILIATION_DAILY_SUMMARY_GENERATED]',
      expect.objectContaining({
        date: '2024-01-15',
        totalRuns: 0,
      })
    );
  });

  it('logs error and re-throws when summary generation fails', async () => {
    const dbError = new Error('MongoDB connection failed');
    mockFind.mockReturnValueOnce({
      lean: jest.fn().mockRejectedValueOnce(dbError),
    } as any);

    await expect(generateDailySummary('2024-01-15')).rejects.toThrow('MongoDB connection failed');

    expect(logger.error).toHaveBeenCalledWith(
      '[RECONCILIATION_DAILY_SUMMARY_FAILED]',
      expect.objectContaining({
        date: '2024-01-15',
        error: 'MongoDB connection failed',
      })
    );
  });
});

describe('getReconciliationReports', () => {
  const mockReports = [
    { _id: 'report-1', generatedAt: new Date('2024-01-15T10:00:00Z') },
    { _id: 'report-2', generatedAt: new Date('2024-01-15T09:00:00Z') },
    { _id: 'report-3', generatedAt: new Date('2024-01-15T08:00:00Z') },
  ];

  beforeEach(() => {
    // Default mock chain for find query
    mockFind.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockReports),
    } as any);
  });

  it('returns reports in reverse-chronological order', async () => {
    const result = await getReconciliationReports({});

    expect(mockFind).toHaveBeenCalledWith({});
    expect(result.items).toEqual(mockReports);
    expect(result.nextCursor).toBeUndefined();
  });

  it('applies startDate filter', async () => {
    const startDate = new Date('2024-01-15T00:00:00Z');
    await getReconciliationReports({ startDate });

    expect(mockFind).toHaveBeenCalledWith({
      generatedAt: { $gte: startDate },
    });
  });

  it('applies endDate filter', async () => {
    const endDate = new Date('2024-01-15T23:59:59Z');
    await getReconciliationReports({ endDate });

    expect(mockFind).toHaveBeenCalledWith({
      generatedAt: { $lte: endDate },
    });
  });

  it('applies both startDate and endDate filters', async () => {
    const startDate = new Date('2024-01-15T00:00:00Z');
    const endDate = new Date('2024-01-15T23:59:59Z');
    await getReconciliationReports({ startDate, endDate });

    expect(mockFind).toHaveBeenCalledWith({
      generatedAt: { $gte: startDate, $lte: endDate },
    });
  });

  it('applies subService filter', async () => {
    await getReconciliationReports({ subService: 'LEDGER' });

    expect(mockFind).toHaveBeenCalledWith({
      subService: 'LEDGER',
    });
  });

  it('applies cursor for pagination', async () => {
    await getReconciliationReports({ cursor: 'report-1' });

    expect(mockFind).toHaveBeenCalledWith({
      _id: { $lt: 'report-1' },
    });
  });

  it('uses default limit of 50', async () => {
    const mockChain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockReports),
    };
    mockFind.mockReturnValueOnce(mockChain as any);

    await getReconciliationReports({});

    expect(mockChain.limit).toHaveBeenCalledWith(51); // limit + 1 for hasMore check
  });

  it('respects custom limit up to max of 200', async () => {
    const mockChain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockReports),
    };
    mockFind.mockReturnValueOnce(mockChain as any);

    await getReconciliationReports({ limit: 100 });

    expect(mockChain.limit).toHaveBeenCalledWith(101); // limit + 1
  });

  it('caps limit at 200', async () => {
    const mockChain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockReports),
    };
    mockFind.mockReturnValueOnce(mockChain as any);

    await getReconciliationReports({ limit: 500 });

    expect(mockChain.limit).toHaveBeenCalledWith(201); // max 200 + 1
  });

  it('returns nextCursor when there are more results', async () => {
    const manyReports = Array.from({ length: 51 }, (_, i) => ({
      _id: `report-${i}`,
      generatedAt: new Date(),
    }));

    mockFind.mockReturnValueOnce({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(manyReports),
    } as any);

    const result = await getReconciliationReports({ limit: 50 });

    expect(result.items).toHaveLength(50);
    expect(result.nextCursor).toBe('report-49');
  });

  it('does not return nextCursor when there are no more results', async () => {
    const result = await getReconciliationReports({ limit: 50 });

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeUndefined();
  });

  it('sorts by generatedAt and _id in descending order', async () => {
    const mockChain = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockReports),
    };
    mockFind.mockReturnValueOnce(mockChain as any);

    await getReconciliationReports({});

    expect(mockChain.sort).toHaveBeenCalledWith({ generatedAt: -1, _id: -1 });
  });
});
