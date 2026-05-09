/**
 * Idempotency Auditor
 *
 * Read-only scanner that detects idempotency key violations and duplicate orders.
 * Never modifies Order documents — all findings are recorded exclusively in the
 * ReconciliationAuditLog.
 *
 * Three scan types:
 *   1. Missing/malformed key scan — Orders with absent, null, empty, or non-UUID-v4 idempotencyKey
 *   2. Duplicate idempotency key detection — Orders sharing the same userId + idempotencyKey
 *   3. Cart-hash duplicate detection — Orders sharing the same userId + cartHash within 5 minutes
 *
 * Design reference: §7 (Idempotency Auditor)
 * Requirements: 4.1–4.9
 */

import mongoose from "mongoose";

import { Order } from "../../../../models/Order";
import { applyFix, ANOMALY_SEVERITY } from "./fixEngine";
import { dbWriteLimiter } from "./concurrencyLimiter";
import { logger } from "../../../../utils/logger";
import type { RunCounts } from "./reconciliationReportService";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default lookback window: 24 hours */
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** Maximum orders returned by the missing-key scan */
const MISSING_KEY_BATCH_LIMIT = 200;

/** Maximum groups returned by each aggregation */
const AGGREGATION_LIMIT = 100;

/** Cart-hash duplicate time window: 300 seconds (5 minutes) */
const CART_HASH_WINDOW_SEC = 300;

/** Inter-item sleep to prevent DB saturation (Requirement 5.10) */
const INTER_ITEM_SLEEP_MS = 50;

/**
 * UUID v4 regex.
 * Matches: xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx (case-insensitive)
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Configuration for the Idempotency Auditor.
 */
export interface IdempotencyAuditorConfig {
  /** Lookback window in milliseconds (default: 24 hours) */
  lookbackMs?: number;
  /** Dry-run mode — write NO_OP audit entries, skip fix callbacks (default: false) */
  dryRun?: boolean;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Task 8.1 — Missing / malformed key scan
// ---------------------------------------------------------------------------

interface MissingKeyScanResult {
  scanned: number;
  violations: number;
  errors: number;
}

/**
 * Task 8.1 — Scan Orders within the lookback window for missing, null, empty,
 * or non-UUID-v4 `idempotencyKey` values.
 *
 * For each violation, calls `applyFix` with:
 *   - `dedupeKey = "IDEMPOTENCY_VIOLATION:{orderId}:FLAGGED_FOR_REVIEW"`
 *   - `action = FLAGGED_FOR_REVIEW`
 *
 * Never modifies Order documents.
 *
 * Design reference: §7.1 (Missing / Malformed Key Scan)
 * Requirements: 4.1, 4.2, 4.3, 4.8
 */
async function runMissingKeyScan(
  runId: string,
  lookbackMs: number,
  dryRun: boolean
): Promise<MissingKeyScanResult> {
  const result: MissingKeyScanResult = {
    scanned: 0,
    violations: 0,
    errors: 0,
  };

  const lookbackCutoff = new Date(Date.now() - lookbackMs);

  // Fetch orders with missing, null, or empty idempotencyKey
  const orders = await Order.find({
    createdAt: { $gte: lookbackCutoff },
    $or: [
      { idempotencyKey: { $exists: false } },
      { idempotencyKey: null },
      { idempotencyKey: "" },
    ],
  })
    .select("_id userId idempotencyKey createdAt")
    .limit(MISSING_KEY_BATCH_LIMIT)
    .lean();

  // Also fetch orders that have a key but it's not a valid UUID v4.
  // We do a separate query for non-empty keys and filter in-memory.
  const ordersWithKeys = await Order.find({
    createdAt: { $gte: lookbackCutoff },
    idempotencyKey: { $exists: true, $ne: null, $ne: "" },
  })
    .select("_id userId idempotencyKey createdAt")
    .limit(MISSING_KEY_BATCH_LIMIT)
    .lean();

  // Filter to only those with malformed (non-UUID-v4) keys
  const malformedOrders = (ordersWithKeys as any[]).filter(
    (o) => !UUID_V4_REGEX.test(String(o.idempotencyKey))
  );

  // Combine both sets (missing/null/empty + malformed)
  const allViolations = [...(orders as any[]), ...malformedOrders];

  logger.info("[IdempotencyAuditor] Missing/malformed key scan found violations", {
    runId,
    missingOrEmpty: orders.length,
    malformed: malformedOrders.length,
    total: allViolations.length,
  });

  for (const order of allViolations) {
    result.scanned++;

    try {
      const orderId = String(order._id);

      await dbWriteLimiter.run(async () => {
        await applyFix({
          anomalyType: "IDEMPOTENCY_VIOLATION",
          // The dedupeKey format from design §7.4:
          // "IDEMPOTENCY_VIOLATION:{orderId}:FLAGGED_FOR_REVIEW"
          // applyFix constructs dedupeKey as `${anomalyType}:${entityId}:${action}`
          // so entityId must be just the orderId to produce the correct key.
          entityId: orderId,
          action: "FLAGGED_FOR_REVIEW",
          runId,
          subService: "IDEMPOTENCY",
          alertSeverity: ANOMALY_SEVERITY["IDEMPOTENCY_VIOLATION"],
          orderId: order._id,
          beforeState: {
            idempotencyKey: order.idempotencyKey ?? null,
            createdAt: order.createdAt,
          },
          afterState: {
            violation: "MISSING_OR_MALFORMED_IDEMPOTENCY_KEY",
            idempotencyKey: order.idempotencyKey ?? null,
          },
          // No fix callback — never modify Order documents (Requirement 4.8)
          dryRun,
        });
      });

      result.violations++;
      logger.debug("[IdempotencyAuditor] Flagged order with missing/malformed key", {
        runId,
        orderId,
        idempotencyKey: order.idempotencyKey ?? null,
      });
    } catch (error) {
      result.errors++;
      logger.error("[IdempotencyAuditor] Error processing missing-key violation", {
        orderId: String(order._id),
        error: String(error),
      });
    }

    await sleep(INTER_ITEM_SLEEP_MS);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Task 8.2 — Duplicate idempotency key detection
// ---------------------------------------------------------------------------

interface DupKeyScanResult {
  scanned: number;
  violations: number;
  errors: number;
}

/**
 * Task 8.2 — Detect Orders sharing the same `userId` + `idempotencyKey`.
 *
 * Runs a MongoDB aggregation `$group` on `{ userId, idempotencyKey }` with
 * `$sum: 1`, filtering groups where count > 1.
 *
 * For each duplicate group, calls `applyFix` with:
 *   - `dedupeKey = "IDEMPOTENCY_VIOLATION:dup_key:{userId}:{idempotencyKey}:FLAGGED_FOR_REVIEW"`
 *
 * Design reference: §7.2 (Duplicate Key Detection)
 * Requirements: 4.4, 4.5
 */
async function runDupKeyScan(
  runId: string,
  lookbackMs: number,
  dryRun: boolean
): Promise<DupKeyScanResult> {
  const result: DupKeyScanResult = {
    scanned: 0,
    violations: 0,
    errors: 0,
  };

  const lookbackCutoff = new Date(Date.now() - lookbackMs);

  const duplicates = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: lookbackCutoff },
        idempotencyKey: { $exists: true, $ne: null, $ne: "" },
      },
    },
    {
      $group: {
        _id: { userId: "$userId", idempotencyKey: "$idempotencyKey" },
        orderIds: { $push: "$_id" },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: AGGREGATION_LIMIT },
  ]);

  logger.info("[IdempotencyAuditor] Duplicate key scan found groups", {
    runId,
    duplicateGroups: duplicates.length,
  });

  for (const group of duplicates as any[]) {
    result.scanned++;

    try {
      const userId = String(group._id.userId);
      const idempotencyKey = String(group._id.idempotencyKey);

      // dedupeKey format from design §7.4:
      // "IDEMPOTENCY_VIOLATION:dup_key:{userId}:{idempotencyKey}:FLAGGED_FOR_REVIEW"
      // applyFix constructs: `${anomalyType}:${entityId}:${action}`
      // So entityId = "dup_key:{userId}:{idempotencyKey}"
      const entityId = `dup_key:${userId}:${idempotencyKey}`;

      await dbWriteLimiter.run(async () => {
        await applyFix({
          anomalyType: "IDEMPOTENCY_VIOLATION",
          entityId,
          action: "FLAGGED_FOR_REVIEW",
          runId,
          subService: "IDEMPOTENCY",
          alertSeverity: ANOMALY_SEVERITY["IDEMPOTENCY_VIOLATION"],
          beforeState: {
            userId,
            idempotencyKey,
            orderIds: group.orderIds.map((id: mongoose.Types.ObjectId) => String(id)),
            count: group.count,
          },
          afterState: {
            violation: "DUPLICATE_IDEMPOTENCY_KEY",
            userId,
            idempotencyKey,
            duplicateCount: group.count,
          },
          // No fix callback — read-only auditor (Requirement 4.8)
          dryRun,
        });
      });

      result.violations++;
      logger.debug("[IdempotencyAuditor] Flagged duplicate idempotency key group", {
        runId,
        userId,
        idempotencyKey,
        count: group.count,
      });
    } catch (error) {
      result.errors++;
      logger.error("[IdempotencyAuditor] Error processing duplicate key group", {
        group: JSON.stringify(group._id),
        error: String(error),
      });
    }

    await sleep(INTER_ITEM_SLEEP_MS);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Task 8.3 — Cart-hash duplicate detection
// ---------------------------------------------------------------------------

interface DupCartScanResult {
  scanned: number;
  violations: number;
  errors: number;
}

/**
 * Task 8.3 — Detect Orders sharing the same `userId` + `cartHash` with
 * `createdAt` timestamps within 5 minutes (300 seconds) of each other.
 *
 * Runs a MongoDB aggregation `$group` on `{ userId, cartHash }` with
 * `$push: { _id, createdAt }`, filtering groups where count > 1.
 * Post-filters to only flag pairs where the `createdAt` delta < 300 seconds.
 *
 * For each violation, calls `applyFix` with:
 *   - `dedupeKey = "IDEMPOTENCY_VIOLATION:dup_cart:{userId}:{cartHash}:FLAGGED_FOR_REVIEW"`
 *   - `afterState` includes the time delta in seconds
 *
 * Design reference: §7.3 (Cart Hash Duplicate Detection)
 * Requirements: 4.6, 4.7
 */
async function runDupCartScan(
  runId: string,
  lookbackMs: number,
  dryRun: boolean
): Promise<DupCartScanResult> {
  const result: DupCartScanResult = {
    scanned: 0,
    violations: 0,
    errors: 0,
  };

  const lookbackCutoff = new Date(Date.now() - lookbackMs);

  const cartDuplicates = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: lookbackCutoff },
        cartHash: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: { userId: "$userId", cartHash: "$cartHash" },
        orders: { $push: { _id: "$_id", createdAt: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $limit: AGGREGATION_LIMIT },
  ]);

  logger.info("[IdempotencyAuditor] Cart-hash duplicate scan found groups", {
    runId,
    candidateGroups: cartDuplicates.length,
  });

  for (const group of cartDuplicates as any[]) {
    result.scanned++;

    try {
      const userId = String(group._id.userId);
      const cartHash = String(group._id.cartHash);

      // Sort timestamps ascending to find the minimum delta between consecutive entries
      const times: number[] = group.orders
        .map((o: any) => new Date(o.createdAt).getTime())
        .sort((a: number, b: number) => a - b);

      // Post-filter: only flag if any consecutive pair is within 300 seconds
      let minDeltaSec = Infinity;
      for (let i = 1; i < times.length; i++) {
        const deltaSec = (times[i] - times[i - 1]) / 1000;
        if (deltaSec < minDeltaSec) {
          minDeltaSec = deltaSec;
        }
      }

      if (minDeltaSec >= CART_HASH_WINDOW_SEC) {
        // All pairs are beyond the 5-minute window — not a violation
        logger.debug("[IdempotencyAuditor] Cart-hash group outside time window — skipping", {
          runId,
          userId,
          cartHash,
          minDeltaSec,
        });
        continue;
      }

      // entityId = "dup_cart:{userId}:{cartHash}" so that applyFix constructs:
      // "IDEMPOTENCY_VIOLATION:dup_cart:{userId}:{cartHash}:FLAGGED_FOR_REVIEW"
      const entityId = `dup_cart:${userId}:${cartHash}`;

      await dbWriteLimiter.run(async () => {
        await applyFix({
          anomalyType: "IDEMPOTENCY_VIOLATION",
          entityId,
          action: "FLAGGED_FOR_REVIEW",
          runId,
          subService: "IDEMPOTENCY",
          alertSeverity: ANOMALY_SEVERITY["IDEMPOTENCY_VIOLATION"],
          beforeState: {
            userId,
            cartHash,
            orderIds: group.orders.map((o: any) => String(o._id)),
            count: group.count,
          },
          afterState: {
            violation: "DUPLICATE_CART_HASH",
            userId,
            cartHash,
            duplicateCount: group.count,
            minDeltaSec,
          },
          // No fix callback — read-only auditor (Requirement 4.8)
          dryRun,
        });
      });

      result.violations++;
      logger.debug("[IdempotencyAuditor] Flagged cart-hash duplicate group", {
        runId,
        userId,
        cartHash,
        count: group.count,
        minDeltaSec,
      });
    } catch (error) {
      result.errors++;
      logger.error("[IdempotencyAuditor] Error processing cart-hash duplicate group", {
        group: JSON.stringify(group._id),
        error: String(error),
      });
    }

    await sleep(INTER_ITEM_SLEEP_MS);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Task 8.4 — Public API
// ---------------------------------------------------------------------------

/**
 * Task 8.4 — Run the Idempotency Auditor and return RunCounts for report persistence.
 *
 * Orchestrates all three scan types in sequence:
 *   1. Missing/malformed key scan (Task 8.1)
 *   2. Duplicate idempotency key detection (Task 8.2)
 *   3. Cart-hash duplicate detection (Task 8.3)
 *
 * Design reference: §7 (Idempotency Auditor)
 * Requirements: 4.1, 4.9
 *
 * @param runId - Unique identifier for the reconciliation run (UUID v4)
 * @param config - Auditor configuration (lookback window, dry-run flag)
 * @returns RunCounts object with aggregated counts for report persistence
 */
export async function runIdempotencyAuditor(
  runId: string,
  config: IdempotencyAuditorConfig
): Promise<RunCounts> {
  const {
    lookbackMs = DEFAULT_LOOKBACK_MS,
    dryRun = false,
  } = config;

  logger.info("[IdempotencyAuditor] Starting idempotency audit", {
    runId,
    lookbackMs,
    dryRun,
  });

  // ── Task 8.1: Missing / malformed key scan ───────────────────────────────
  const missingKeyResult = await runMissingKeyScan(runId, lookbackMs, dryRun);

  logger.info("[IdempotencyAuditor] Missing/malformed key scan complete", {
    runId,
    ...missingKeyResult,
  });

  // ── Task 8.2: Duplicate idempotency key detection ────────────────────────
  const dupKeyResult = await runDupKeyScan(runId, lookbackMs, dryRun);

  logger.info("[IdempotencyAuditor] Duplicate key scan complete", {
    runId,
    ...dupKeyResult,
  });

  // ── Task 8.3: Cart-hash duplicate detection ──────────────────────────────
  const dupCartResult = await runDupCartScan(runId, lookbackMs, dryRun);

  logger.info("[IdempotencyAuditor] Cart-hash duplicate scan complete", {
    runId,
    ...dupCartResult,
  });

  // Aggregate total violation count across all three scans
  const totalViolations =
    missingKeyResult.violations +
    dupKeyResult.violations +
    dupCartResult.violations;

  const totalScanned =
    missingKeyResult.scanned +
    dupKeyResult.scanned +
    dupCartResult.scanned;

  const totalErrors =
    missingKeyResult.errors +
    dupKeyResult.errors +
    dupCartResult.errors;

  logger.info("[IdempotencyAuditor] Idempotency audit complete", {
    runId,
    totalScanned,
    totalViolations,
    totalErrors,
  });

  // Map to RunCounts for report persistence
  const runCounts: RunCounts = {
    totalScanned,
    falsePaidCount: 0,
    phantomPaidCount: 0,
    orphanLedgerCount: 0,
    missingLedgerCount: 0,
    amountMismatchCount: 0,
    partialCaptureCount: 0,
    piStatusMismatchCount: 0,
    zombieRecoveredCount: 0,
    zombieFailedCount: 0,
    idempotencyViolationCount: totalViolations,
    autoFixedCount: 0,
    manualReviewCount: totalViolations,
    errorCount: totalErrors,
  };

  return runCounts;
}
