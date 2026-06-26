/**
 * Reconciliation Report Service — report persistence, daily summary generation, and query API.
 *
 * This service handles:
 *   - Persisting ReconciliationReport documents after each sub-service run
 *   - Generating daily summaries by aggregating all reports for a given UTC date
 *   - Providing cursor-based pagination for querying reports
 *
 * Design reference: §8.4 (Report Persistence and Daily Summary)
 * Requirements: 3.1, 3.8, 3.9, 3.10
 */

import { logger } from "../../../../utils/logger";
import {
  ReconciliationReport,
  type IReconciliationReport,
} from "../../models/ReconciliationReport";
import {
  DailyReconciliationSummary,
  type IDailyReconciliationSummary,
} from "../../models/DailyReconciliationSummary";
import type { SubServiceName } from "../../models/ReconciliationRun";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Counts collected during a reconciliation run.
 * These are aggregated from the anomaly detection and fix application steps.
 */
export interface RunCounts {
  totalScanned: number;
  falsePaidCount: number;
  phantomPaidCount: number;
  orphanLedgerCount: number;
  missingLedgerCount: number;
  amountMismatchCount: number;
  partialCaptureCount: number;
  piStatusMismatchCount: number;
  zombieRecoveredCount: number;
  zombieFailedCount: number;
  idempotencyViolationCount: number;
  autoFixedCount: number;
  manualReviewCount: number;
  errorCount: number;
}

export interface ReconciliationReportQuery {
  startDate?: Date;
  endDate?: Date;
  subService?: SubServiceName;
  limit?: number;
  cursor?: string;  // ObjectId as string for cursor-based pagination
}

export interface ReconciliationReportQueryResult {
  items: IReconciliationReport[];
  nextCursor?: string;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Persist a ReconciliationReport document after a sub-service run completes.
 *
 * @param runId - Unique identifier for the reconciliation run (UUID v4)
 * @param subService - The sub-service that generated this report
 * @param counts - Aggregated counts from the run
 * @returns The persisted ReconciliationReport document
 */
export async function persistReport(
  runId: string,
  subService: SubServiceName,
  counts: RunCounts
): Promise<IReconciliationReport> {
  // Calculate derived fields
  const mismatchCount =
    counts.falsePaidCount +
    counts.phantomPaidCount +
    counts.orphanLedgerCount +
    counts.missingLedgerCount +
    counts.amountMismatchCount +
    counts.partialCaptureCount +
    counts.piStatusMismatchCount +
    counts.zombieRecoveredCount +
    counts.zombieFailedCount +
    counts.idempotencyViolationCount;

  const mismatchRate =
    counts.totalScanned > 0
      ? (mismatchCount / counts.totalScanned) * 100
      : 0;

  const criticalAnomalyCount =
    counts.falsePaidCount + counts.amountMismatchCount;

  const report = await ReconciliationReport.create({
    runId,
    subService,
    generatedAt: new Date(),
    totalScanned: counts.totalScanned,
    falsePaidCount: counts.falsePaidCount,
    phantomPaidCount: counts.phantomPaidCount,
    orphanLedgerCount: counts.orphanLedgerCount,
    missingLedgerCount: counts.missingLedgerCount,
    amountMismatchCount: counts.amountMismatchCount,
    partialCaptureCount: counts.partialCaptureCount,
    piStatusMismatchCount: counts.piStatusMismatchCount,
    zombieRecoveredCount: counts.zombieRecoveredCount,
    zombieFailedCount: counts.zombieFailedCount,
    idempotencyViolationCount: counts.idempotencyViolationCount,
    mismatchCount,
    mismatchRate,
    autoFixedCount: counts.autoFixedCount,
    manualReviewCount: counts.manualReviewCount,
    criticalAnomalyCount,
    errorCount: counts.errorCount,
  });

  logger.info("[RECONCILIATION_REPORT_PERSISTED]", {
    runId,
    subService,
    totalScanned: counts.totalScanned,
    mismatchCount,
    mismatchRate,
    criticalAnomalyCount,
  });

  return report;
}

/**
 * Generate a daily summary by aggregating all reports for a given UTC date.
 * This function is idempotent — it upserts the summary document, so it's safe to re-run.
 *
 * @param dateUtc - The date in YYYY-MM-DD format (UTC)
 * @returns The persisted or updated DailyReconciliationSummary document
 */
export async function generateDailySummary(
  dateUtc: string
): Promise<IDailyReconciliationSummary> {
  try {
    const startOfDay = new Date(`${dateUtc}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateUtc}T23:59:59.999Z`);

    // Fetch all reports for the given date
    const reports = await ReconciliationReport.find({
      generatedAt: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    // Aggregate counts
    const totalRuns = reports.length;
    const totalScanned = sum(reports, "totalScanned");
    const totalMismatches = sum(reports, "mismatchCount");
    const totalAutoFixed = sum(reports, "autoFixedCount");
    const totalManualReview = sum(reports, "manualReviewCount");
    const peakMismatchRate =
      reports.length > 0
        ? Math.max(...reports.map((r) => r.mismatchRate))
        : 0;
    const criticalAnomalyCount = sum(reports, "criticalAnomalyCount");

    // Upsert the summary document — safe to re-run
    const summary = await DailyReconciliationSummary.findOneAndUpdate(
      { date: dateUtc },
      {
        $set: {
          totalRuns,
          totalScanned,
          totalMismatches,
          totalAutoFixed,
          totalManualReview,
          peakMismatchRate,
          criticalAnomalyCount,
        },
      },
      { upsert: true, new: true }
    );

    logger.info("[RECONCILIATION_DAILY_SUMMARY_GENERATED]", {
      date: dateUtc,
      totalRuns,
      totalScanned,
      totalMismatches,
      criticalAnomalyCount,
    });

    return summary;
  } catch (error) {
    // Log the error but do not crash the process (Requirement 3.10)
    logger.error("[RECONCILIATION_DAILY_SUMMARY_FAILED]", {
      date: dateUtc,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Query reconciliation reports with cursor-based pagination.
 * Results are returned in reverse-chronological order (newest first).
 *
 * @param query - Query parameters including date range, sub-service filter, limit, and cursor
 * @returns Paginated results with optional nextCursor for fetching the next page
 */
export async function getReconciliationReports(
  query: ReconciliationReportQuery
): Promise<ReconciliationReportQueryResult> {
  const limit = Math.min(query.limit ?? 50, 200); // Default 50, max 200

  // Build the filter
  const filter: any = {};

  if (query.startDate || query.endDate) {
    filter.generatedAt = {};
    if (query.startDate) {
      filter.generatedAt.$gte = query.startDate;
    }
    if (query.endDate) {
      filter.generatedAt.$lte = query.endDate;
    }
  }

  if (query.subService) {
    filter.subService = query.subService;
  }

  // Cursor-based pagination: if cursor is provided, filter for documents with _id < cursor
  if (query.cursor) {
    filter._id = { $lt: query.cursor };
  }

  // Execute the query
  const items = await ReconciliationReport.find(filter)
    .sort({ generatedAt: -1, _id: -1 }) // Reverse-chronological order
    .limit(limit + 1) // Fetch one extra to determine if there's a next page
    .lean();

  // Determine if there's a next page
  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? String(results[results.length - 1]._id) : undefined;

  return {
    items: results as unknown as IReconciliationReport[],
    nextCursor,
  };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Sum a numeric field across an array of objects.
 */
function sum<T>(items: T[], field: keyof T): number {
  return items.reduce((acc, item) => acc + (Number(item[field]) || 0), 0);
}

// ---------------------------------------------------------------------------
// Audit log query API (Requirement 6.5, 6.6)
// ---------------------------------------------------------------------------

import mongoose from "mongoose";
import {
  ReconciliationAuditLog,
  type IReconciliationAuditLog,
} from "../../models/ReconciliationAuditLog";

/**
 * Return ReconciliationAuditLog entries for a given order in reverse-chronological order.
 *
 * Returns an empty array (without throwing) when:
 *   - The orderId string is not a valid MongoDB ObjectId
 *   - No audit entries exist for the order
 *
 * @param orderId - The order ID as a string (ObjectId hex)
 * @param limit   - Maximum number of entries to return (default: 50)
 * @returns Array of audit log entries, newest first
 *
 * Requirements: 6.5, 6.6
 */
export async function getAuditLogsForOrder(
  orderId: string,
  limit = 50
): Promise<IReconciliationAuditLog[]> {
  // Guard: return empty array for invalid ObjectId without throwing (Requirement 6.6)
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return [];
  }

  const entries = await ReconciliationAuditLog.find({
    orderId: new mongoose.Types.ObjectId(orderId),
  })
    .sort({ recordedAt: -1 }) // Reverse-chronological order (Requirement 6.5)
    .limit(limit)
    .lean();

  return entries as unknown as IReconciliationAuditLog[];
}
