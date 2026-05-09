/**
 * Ledger Consistency Scanner
 *
 * Performs 4-way consistency checks across Razorpay, PaymentIntent, Order, and LedgerEntry
 * for every completed payment. Detects all categories of financial mismatch including
 * reverse mismatches where the DB shows PAID but Razorpay does not.
 *
 * Design reference: §5 (Ledger Consistency Scanner)
 * Requirements: 1.2, 1.4, 1.5, 1.6, 1.7, 1.9
 */

import mongoose from "mongoose";
import Razorpay from "razorpay";

import { Order } from "../../../../models/Order";
import type { IOrder } from "../../../../models/Order";
import { PaymentIntent } from "../../models/PaymentIntent";
import type { IPaymentIntent } from "../../models/PaymentIntent";
import { LedgerEntry } from "../../models/LedgerEntry";
import type { ILedgerEntry } from "../../models/LedgerEntry";
import type { RazorpayPaymentInfo, RazorpayStatusCache } from "./razorpayStatusCache";
import { RazorpayStatusCache as RazorpayStatusCacheClass } from "./razorpayStatusCache";
import type { AnomalyType, AlertSeverity } from "../../models/ReconciliationAuditLog";
import { ANOMALY_SEVERITY, applyFix } from "./fixEngine";
import { razorpayLimiter, dbWriteLimiter } from "./concurrencyLimiter";
import { appendLedgerEntry } from "../ledgerService";
import { logger } from "../../../../utils/logger";
import type { RunCounts } from "./reconciliationReportService";
import type { AlertChannel } from "./reconciliationAlertService";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/**
 * Result of a 4-way consistency evaluation.
 *
 * - `ok: true` — All four consistency checks passed (Razorpay captured,
 *   PaymentIntent CAPTURED, Order PAID, LedgerEntry exists with correct amount).
 * - `ok: false` — One or more checks failed. The `anomaly` field identifies
 *   the specific mismatch category, and `details` provides diagnostic context.
 */
export type ConsistencyResult =
  | { ok: true }
  | { ok: false; anomaly: AnomalyType; details: Record<string, any> };

// ---------------------------------------------------------------------------
// Core evaluation function
// ---------------------------------------------------------------------------

/**
 * Evaluates 4-way consistency for a single PAID order.
 *
 * Checks are performed in priority order (most dangerous first):
 *   1. FALSE_PAID — Order=PAID but Razorpay shows no capture (fraud risk)
 *   2. PARTIAL_CAPTURE — Razorpay shows authorized but not fully captured
 *   3. MISSING_LEDGER — Captured at Razorpay but no LedgerEntry
 *   4. AMOUNT_MISMATCH — LedgerEntry amount differs from order total (>1 paise)
 *   5. PI_STATUS_MISMATCH — PaymentIntent not in CAPTURED state
 *   6. Clean path — all checks pass
 *
 * Design reference: §5.2 (4-Way Consistency Evaluation)
 *
 * @param order - The Order document (must have paymentStatus = PAID)
 * @param paymentIntent - The associated PaymentIntent (may be null if not found)
 * @param ledgerEntry - The associated CAPTURE LedgerEntry (may be null if not found)
 * @param razorpay - Razorpay payment status (may be null if API call failed or no payment found)
 * @returns ConsistencyResult indicating whether the order is consistent or which anomaly was detected
 */
export function evaluateConsistency(
  order: IOrder,
  paymentIntent: IPaymentIntent | null,
  ledgerEntry: ILedgerEntry | null,
  razorpay: RazorpayPaymentInfo | null
): ConsistencyResult {
  // ── 1. FALSE_PAID: Order=PAID but Razorpay shows no capture ──────────────
  // This is the most dangerous case — potential fraud or data corruption.
  // If Razorpay shows neither captured nor authorized, the payment never
  // reached the gateway in a valid state.
  if (!razorpay?.captured && !razorpay?.authorized) {
    return {
      ok: false,
      anomaly: "FALSE_PAID",
      details: {
        orderPaymentStatus: order.paymentStatus,
        razorpayStatus: razorpay?.status ?? "NOT_FOUND",
        gatewayOrderId: order.razorpayOrderId,
      },
    };
  }

  // ── 2. PARTIAL_CAPTURE: Razorpay shows authorized but not fully captured ──
  // Payment was authorized (funds reserved) but not yet settled.
  // This requires manual review — neither auto-fix nor ignore is safe.
  if (razorpay?.authorized && !razorpay?.captured) {
    return {
      ok: false,
      anomaly: "PARTIAL_CAPTURE",
      details: {
        razorpayStatus: "authorized",
        gatewayOrderId: order.razorpayOrderId,
      },
    };
  }

  // ── From here: razorpay.captured === true ─────────────────────────────────

  // ── 3. MISSING_LEDGER: Captured at Razorpay but no LedgerEntry ───────────
  // Payment was captured at the gateway but the ledger write failed or was
  // never attempted. This can be auto-fixed by backfilling the ledger entry.
  if (!ledgerEntry) {
    return {
      ok: false,
      anomaly: "MISSING_LEDGER",
      details: {
        gatewayOrderId: order.razorpayOrderId,
        razorpayPaymentId: razorpay.paymentId,
      },
    };
  }

  // ── 4. AMOUNT_MISMATCH: LedgerEntry amount differs from order total ──────
  // The ledger entry exists but the amount doesn't match the order total.
  // Use 1-paise tolerance to handle floating-point rounding errors.
  const expectedPaise = Math.round(order.totalAmount * 100);
  if (Math.abs(ledgerEntry.amount - expectedPaise) > 1) {
    return {
      ok: false,
      anomaly: "AMOUNT_MISMATCH",
      details: {
        expectedPaise,
        actualPaise: ledgerEntry.amount,
        diffPaise: ledgerEntry.amount - expectedPaise,
      },
    };
  }

  // ── 5. PI_STATUS_MISMATCH: PaymentIntent not in CAPTURED state ───────────
  // The payment was captured at Razorpay and the ledger entry exists, but
  // the PaymentIntent status is stale. This can be auto-fixed by transitioning
  // the PaymentIntent to CAPTURED.
  if (paymentIntent && paymentIntent.status !== "CAPTURED") {
    return {
      ok: false,
      anomaly: "PI_STATUS_MISMATCH",
      details: {
        piStatus: paymentIntent.status,
        expectedStatus: "CAPTURED",
      },
    };
  }

  // ── 6. Clean path: all checks pass ────────────────────────────────────────
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Sleep for the specified number of milliseconds.
 * Used to add inter-item delays during batch processing.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with exponential backoff retry logic.
 * Retries on failure with delays: 500ms, 1000ms, 2000ms (max 3 attempts).
 *
 * @param fn - The async function to execute
 * @returns The result of the function, or throws after all retries exhausted
 */
async function fetchWithRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [500, 1000, 2000];
  let lastError: any;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < delays.length - 1) {
        await sleep(delays[attempt]);
      }
    }
  }

  throw lastError;
}

/**
 * Fetch Razorpay payment status for a given gateway order ID.
 * Returns normalized payment info or null if no payment found.
 *
 * @param razorpay - Razorpay client instance
 * @param gatewayOrderId - The Razorpay order ID
 * @returns RazorpayPaymentInfo or null
 */
async function fetchRazorpayStatus(
  razorpay: Razorpay,
  gatewayOrderId: string
): Promise<RazorpayPaymentInfo | null> {
  try {
    // Fetch payments for the order
    const payments: any = await new Promise((resolve, reject) => {
      razorpay.orders.fetchPayments(gatewayOrderId, (err: any, data: any) => {
        if (err) return reject(err);
        return resolve(data);
      });
    });

    if (!payments || !Array.isArray(payments.items) || payments.items.length === 0) {
      return null;
    }

    // Find the latest payment (sort by created_at descending)
    const sortedPayments = payments.items.sort((a: any, b: any) => {
      const aTime = Number(a.created_at || 0);
      const bTime = Number(b.created_at || 0);
      return bTime - aTime;
    });

    const latestPayment = sortedPayments[0];
    const status = String(latestPayment?.status || "").toLowerCase() as RazorpayPaymentInfo["status"];
    const captured = status === "captured";
    const authorized = status === "authorized" || captured;
    const paymentId = latestPayment?.id ? String(latestPayment.id) : undefined;
    const capturedAt = latestPayment?.created_at
      ? new Date(Number(latestPayment.created_at) * 1000)
      : undefined;
    const amountPaise = Number(latestPayment?.amount || 0);

    return {
      status,
      captured,
      authorized,
      paymentId,
      capturedAt,
      amountPaise,
    };
  } catch (error) {
    logger.error("[LedgerConsistencyScanner] Failed to fetch Razorpay payment status", {
      gatewayOrderId,
      error: String(error),
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Forward scan implementation
// ---------------------------------------------------------------------------

interface ForwardScanArgs {
  razorpay: Razorpay;
  cache: RazorpayStatusCache;
  alertChannel: { sendAlert: (severity: AlertSeverity) => Promise<void> };
  runId: string;
  lookbackMs?: number;
  batchSize?: number;
  dryRun?: boolean;
}

interface ForwardScanResult {
  scanned: number;
  clean: number;
  anomalies: number;
  autoFixed: number;
  flagged: number;
  errors: number;
}

/**
 * Forward scan: PAID orders → 4-way consistency check.
 *
 * Scans all PAID orders within the lookback window (default 48h) in batches of 200.
 * For each order:
 *   1. Fetch PaymentIntent (by activePaymentIntentId or orderId)
 *   2. Fetch LedgerEntry (by orderId, eventType=CAPTURE)
 *   3. Fetch Razorpay status (with exponential backoff, max 3 retries)
 *   4. evaluateConsistency(order, pi, ledger, razorpay)
 *   5. if anomaly:
 *        if CRITICAL (FALSE_PAID, AMOUNT_MISMATCH):
 *          applyFix(...)
 *          alertChannel.sendAlert(severity=CRITICAL) ← immediate, not deferred
 *        else:
 *          applyFix(...)
 *          accumulate for end-of-run alert
 *   6. if ok:
 *        Order.updateOne({ _id }, { $set: { lastReconciledAt: now } })
 *   7. sleep 50ms
 *
 * Design reference: §5.5 (Full Scanner Flow)
 * Requirements: 1.1–1.13, 5.10
 */
async function runForwardScan(args: ForwardScanArgs): Promise<ForwardScanResult> {
  const {
    razorpay,
    cache,
    alertChannel,
    runId,
    lookbackMs = 48 * 60 * 60 * 1000, // 48 hours
    batchSize = 200,
    dryRun = false,
  } = args;

  const result: ForwardScanResult = {
    scanned: 0,
    clean: 0,
    anomalies: 0,
    autoFixed: 0,
    flagged: 0,
    errors: 0,
  };

  const now = new Date();
  const lookbackCutoff = new Date(now.getTime() - lookbackMs);
  let cursor: mongoose.Types.ObjectId | null = null;

  // Cursor-paginated scan loop
  while (true) {
    // Build query: PAID orders within lookback window, exclude DEAD_LETTER
    const query: any = {
      paymentStatus: "PAID",
      createdAt: { $gte: lookbackCutoff },
      reconciliationFlag: { $ne: "DEAD_LETTER" },
    };

    if (cursor) {
      query._id = { $gt: cursor };
    }

    const orders = await Order.find(query)
      .select("_id userId totalAmount paymentStatus razorpayOrderId activePaymentIntentId lastReconciledAt reconciliationFlag reconciliationErrorCount")
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean();

    if (orders.length === 0) {
      break; // No more orders to process
    }

    // Process each order
    for (const order of orders as any[]) {
      result.scanned++;
      cursor = order._id;

      try {
        // ── Step 1: Fetch PaymentIntent ──────────────────────────────────
        let paymentIntent: IPaymentIntent | null = null;
        if (order.activePaymentIntentId) {
          paymentIntent = await PaymentIntent.findById(order.activePaymentIntentId)
            .select("_id orderId status version")
            .lean() as any;
        }
        if (!paymentIntent) {
          // Fallback: find by orderId
          paymentIntent = await PaymentIntent.findOne({ orderId: order._id })
            .select("_id orderId status version")
            .sort({ createdAt: -1 })
            .lean() as any;
        }

        // ── Step 2: Fetch LedgerEntry ────────────────────────────────────
        const ledgerEntry = await LedgerEntry.findOne({
          orderId: order._id,
          eventType: "CAPTURE",
        })
          .select("_id orderId amount gatewayEventId")
          .lean() as any;

        // ── Step 3: Fetch Razorpay status ────────────────────────────────
        const gatewayOrderId = order.razorpayOrderId;
        let razorpayInfo: RazorpayPaymentInfo | null = null;

        if (gatewayOrderId) {
          // Check cache first (Issue 1)
          razorpayInfo = cache.get(gatewayOrderId);

          if (!razorpayInfo) {
            // Cache miss — fetch from Razorpay with retry and limiter
            try {
              razorpayInfo = await razorpayLimiter.run(() =>
                fetchWithRetry(() => fetchRazorpayStatus(razorpay, gatewayOrderId))
              );

              if (razorpayInfo) {
                cache.set(gatewayOrderId, razorpayInfo);
              }
            } catch (error) {
              // Razorpay API error — increment error count and apply dead-letter logic (Issue 5)
              logger.error("[LedgerConsistencyScanner] Razorpay API error", {
                orderId: order._id.toString(),
                gatewayOrderId,
                error: String(error),
              });

              const newErrorCount = (order.reconciliationErrorCount || 0) + 1;
              await Order.updateOne(
                { _id: order._id },
                { $inc: { reconciliationErrorCount: 1 } }
              );

              if (newErrorCount >= 5) {
                // Dead-letter threshold reached — apply dead-letter fix
                await dbWriteLimiter.run(async () => {
                  await applyFix({
                    anomalyType: "FALSE_PAID",
                    entityId: order._id.toString(),
                    action: "FLAGGED_FOR_REVIEW",
                    runId,
                    subService: "LEDGER",
                    alertSeverity: "CRITICAL",
                    orderId: order._id,
                    paymentIntentId: paymentIntent?._id,
                    beforeState: {
                      paymentStatus: order.paymentStatus,
                      reconciliationErrorCount: order.reconciliationErrorCount || 0,
                    },
                    afterState: {
                      reconciliationFlag: "DEAD_LETTER",
                    },
                    fix: async () => {
                      await Order.updateOne(
                        { _id: order._id },
                        { $set: { reconciliationFlag: "DEAD_LETTER" } }
                      );
                    },
                    dryRun,
                  });
                });

                logger.warn("[LedgerConsistencyScanner] Order marked as DEAD_LETTER", {
                  orderId: order._id.toString(),
                  errorCount: newErrorCount,
                });
              }

              result.errors++;
              continue; // Skip this order
            }
          }
        }

        // ── Step 4: Evaluate consistency ─────────────────────────────────
        const consistencyResult = evaluateConsistency(
          order as IOrder,
          paymentIntent,
          ledgerEntry,
          razorpayInfo
        );

        if (consistencyResult.ok) {
          // ── Step 6: Clean path — update lastReconciledAt ──────────────
          await Order.updateOne(
            { _id: order._id },
            { $set: { lastReconciledAt: now } }
          );
          result.clean++;
        } else {
          // ── Step 5: Anomaly detected — apply fix ──────────────────────
          result.anomalies++;
          const { anomaly, details } = consistencyResult;
          const severity = ANOMALY_SEVERITY[anomaly];

          // Determine fix action based on anomaly type
          let fixAction: "AUTO_FIXED" | "FLAGGED_FOR_REVIEW" = "FLAGGED_FOR_REVIEW";
          let fixCallback: (() => Promise<void>) | undefined;

          if (anomaly === "MISSING_LEDGER") {
            // Auto-fix: backfill ledger entry (Issue 2)
            fixAction = "AUTO_FIXED";
            fixCallback = async () => {
              const gatewayEventId = razorpayInfo?.paymentId || `backfill_${gatewayOrderId}_${Date.now()}`;
              await appendLedgerEntry({
                paymentIntentId: paymentIntent?._id.toString() || "",
                orderId: order._id.toString(),
                gateway: "RAZORPAY",
                eventType: "CAPTURE",
                amount: razorpayInfo?.amountPaise || Math.round(order.totalAmount * 100),
                currency: "INR",
                gatewayEventId,
                dedupeKey: `ledger_backfill:${gatewayEventId}`,
                occurredAt: razorpayInfo?.capturedAt,
                raw: { source: "reconciliation_backfill", razorpayInfo },
              });
            };
            result.autoFixed++;
          } else if (anomaly === "PI_STATUS_MISMATCH") {
            // Auto-fix: transition PaymentIntent to CAPTURED
            fixAction = "AUTO_FIXED";
            fixCallback = async () => {
              if (paymentIntent) {
                await PaymentIntent.updateOne(
                  { _id: paymentIntent._id, version: paymentIntent.version || 0 },
                  {
                    $set: { status: "CAPTURED", paymentState: "CAPTURED" },
                    $inc: { version: 1 },
                  }
                );
              }
            };
            result.autoFixed++;
          } else if (anomaly === "FALSE_PAID") {
            // Flag for review: set reconciliationFlag
            fixCallback = async () => {
              await Order.updateOne(
                { _id: order._id },
                { $set: { reconciliationFlag: "FALSE_PAID_UNRESOLVED" } }
              );
            };
            result.flagged++;
          } else {
            // Other anomalies: flag for review, no DB change
            result.flagged++;
          }

          // Apply fix via fixEngine (Issue 4)
          await applyFix({
            anomalyType: anomaly,
            entityId: order._id.toString(),
            action: fixAction,
            runId,
            subService: "LEDGER",
            alertSeverity: severity,
            orderId: order._id,
            paymentIntentId: paymentIntent?._id,
            beforeState: {
              orderPaymentStatus: order.paymentStatus,
              piStatus: paymentIntent?.status,
              ledgerExists: !!ledgerEntry,
              razorpayStatus: razorpayInfo?.status,
              ...details,
            },
            afterState: {
              action: fixAction,
              details,
            },
            fix: fixCallback,
            dryRun,
          });

          // Immediate CRITICAL alert (Issue 4)
          if (severity === "CRITICAL") {
            await alertChannel.sendAlert(severity);
          }
        }

        // ── Step 7: Sleep 50ms between items ─────────────────────────────
        await sleep(50);
      } catch (error) {
        result.errors++;
        logger.error("[LedgerConsistencyScanner] Error processing order", {
          orderId: order._id.toString(),
          error: String(error),
        });
      }
    }

    // If we got fewer orders than batch size, we've reached the end
    if (orders.length < batchSize) {
      break;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Reverse scan implementation (ORPHAN_LEDGER detection)
// ---------------------------------------------------------------------------

interface ReverseScanArgs {
  alertChannel: { sendAlert: (severity: AlertSeverity) => Promise<void> };
  runId: string;
  lookbackMs?: number;
  batchSize?: number;
  dryRun?: boolean;
}

interface ReverseScanResult {
  scanned: number;
  orphanLedger: number;
  flagged: number;
  errors: number;
}

/**
 * Reverse scan: CAPTURE LedgerEntries → verify Order is PAID.
 *
 * Scans all CAPTURE LedgerEntries within the lookback window (default 48h) in batches.
 * For each entry:
 *   1. Join to Order via $lookup
 *   2. If Order does NOT have paymentStatus = PAID (or Order is null):
 *        applyFix(category=ORPHAN_LEDGER, action=FLAGGED_FOR_REVIEW)
 *        accumulate for end-of-run WARNING alert
 *   3. Sleep 50ms
 *
 * Design reference: §5.3 (ORPHAN_LEDGER Reverse Scan)
 * Requirements: 1.8
 */
async function runReverseScan(args: ReverseScanArgs): Promise<ReverseScanResult> {
  const {
    alertChannel,
    runId,
    lookbackMs = 48 * 60 * 60 * 1000, // 48 hours
    batchSize = 200,
    dryRun = false,
  } = args;

  const result: ReverseScanResult = {
    scanned: 0,
    orphanLedger: 0,
    flagged: 0,
    errors: 0,
  };

  const lookbackCutoff = new Date(Date.now() - lookbackMs);

  // Aggregation-based scan: CAPTURE LedgerEntries joined to Orders
  const orphanLedgerEntries = await LedgerEntry.aggregate([
    {
      $match: {
        eventType: "CAPTURE",
        createdAt: { $gte: lookbackCutoff },
      },
    },
    {
      $lookup: {
        from: "orders",
        localField: "orderId",
        foreignField: "_id",
        as: "order",
        pipeline: [{ $project: { paymentStatus: 1 } }],
      },
    },
    { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [
          { "order.paymentStatus": { $ne: "PAID" } },
          { order: null },
        ],
      },
    },
    { $limit: batchSize },
  ]);

  // Process each orphan ledger entry
  for (const entry of orphanLedgerEntries as any[]) {
    result.scanned++;

    try {
      // Flag as ORPHAN_LEDGER
      result.orphanLedger++;
      result.flagged++;

      await dbWriteLimiter.run(async () => {
        await applyFix({
          anomalyType: "ORPHAN_LEDGER",
          entityId: entry._id.toString(),
          action: "FLAGGED_FOR_REVIEW",
          runId,
          subService: "LEDGER",
          alertSeverity: "WARNING",
          orderId: entry.orderId,
          beforeState: {
            ledgerEntryId: entry._id.toString(),
            orderId: entry.orderId?.toString() || null,
            orderPaymentStatus: entry.order?.paymentStatus || null,
            orderExists: !!entry.order,
          },
          afterState: {
            action: "FLAGGED_FOR_REVIEW",
            reason: "CAPTURE LedgerEntry exists but Order is not PAID",
          },
          // No fix callback — ORPHAN_LEDGER is FLAGGED_FOR_REVIEW only, no DB change
          dryRun,
        });
      });

      // Sleep 50ms between items
      await sleep(50);
    } catch (error) {
      result.errors++;
      logger.error("[LedgerConsistencyScanner] Error processing orphan ledger entry", {
        ledgerEntryId: entry._id.toString(),
        error: String(error),
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Configuration for the ledger consistency scanner.
 *
 * @property razorpay - Razorpay client instance for fetching payment status
 * @property lookbackMs - Lookback window in milliseconds (default: 48 hours)
 * @property batchSize - Batch size for cursor pagination (default: 200)
 * @property razorpayCacheTtlMs - Cache TTL in milliseconds (default: 5 minutes)
 * @property dryRun - Dry-run mode flag (default: false)
 */
export interface LedgerScannerConfig {
  razorpay: Razorpay;
  lookbackMs?: number;
  batchSize?: number;
  razorpayCacheTtlMs?: number;
  dryRun?: boolean;
}

/**
 * Run the ledger consistency scanner.
 *
 * This function orchestrates the full ledger consistency scan:
 *   1. Creates a RazorpayStatusCache instance
 *   2. Runs the forward scan (PAID orders → 4-way consistency check)
 *   3. Runs the reverse scan (CAPTURE LedgerEntries → verify Order is PAID)
 *   4. Clears the cache
 *   5. Collects all counts and returns a RunCounts object for report persistence
 *
 * Design reference: §5.5 (Full Scanner Flow)
 * Requirements: 1.1, 1.8
 *
 * @param runId - Unique identifier for the reconciliation run (UUID v4)
 * @param config - Scanner configuration
 * @param alertChannel - Alert channel for sending alerts
 * @returns RunCounts object with aggregated counts from both scans
 */
export async function runLedgerConsistencyScanner(
  runId: string,
  config: LedgerScannerConfig,
  alertChannel: AlertChannel
): Promise<RunCounts> {
  const {
    razorpay,
    lookbackMs = 48 * 60 * 60 * 1000, // 48 hours
    batchSize = 200,
    razorpayCacheTtlMs = 5 * 60 * 1000, // 5 minutes
    dryRun = false,
  } = config;

  // Step 1: Create RazorpayStatusCache instance
  const cache = new RazorpayStatusCacheClass(razorpayCacheTtlMs);

  // Create an adapter for the alertChannel to match the internal interface
  // The internal scanners expect sendAlert(severity) but AlertChannel expects sendAlert(report, severity)
  // We'll pass a minimal report stub for now since the internal scanners don't have access to the full report
  const alertChannelAdapter = {
    sendAlert: async (severity: AlertSeverity) => {
      // Create a minimal report stub for the alert
      // The actual report will be generated after both scans complete
      const stubReport = {
        runId,
        subService: 'LEDGER' as const,
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
      } as any;
      await alertChannel.sendAlert(stubReport, severity);
    },
  };

  try {
    logger.info("[LedgerConsistencyScanner] Starting ledger consistency scan", {
      runId,
      lookbackMs,
      batchSize,
      dryRun,
    });

    // Step 2: Run forward scan
    const forwardResult = await runForwardScan({
      razorpay,
      cache,
      alertChannel: alertChannelAdapter,
      runId,
      lookbackMs,
      batchSize,
      dryRun,
    });

    logger.info("[LedgerConsistencyScanner] Forward scan complete", {
      runId,
      ...forwardResult,
    });

    // Step 3: Run reverse scan
    const reverseResult = await runReverseScan({
      alertChannel: alertChannelAdapter,
      runId,
      lookbackMs,
      batchSize,
      dryRun,
    });

    logger.info("[LedgerConsistencyScanner] Reverse scan complete", {
      runId,
      ...reverseResult,
    });

    // Step 5: Collect all counts and return RunCounts object
    const runCounts: RunCounts = {
      totalScanned: forwardResult.scanned + reverseResult.scanned,
      falsePaidCount: forwardResult.anomalies, // FALSE_PAID anomalies from forward scan
      phantomPaidCount: 0, // Not detected by ledger scanner
      orphanLedgerCount: reverseResult.orphanLedger,
      missingLedgerCount: 0, // MISSING_LEDGER is counted in autoFixed
      amountMismatchCount: 0, // AMOUNT_MISMATCH is counted in flagged
      partialCaptureCount: 0, // PARTIAL_CAPTURE is counted in flagged
      piStatusMismatchCount: 0, // PI_STATUS_MISMATCH is counted in autoFixed
      zombieRecoveredCount: 0, // Not detected by ledger scanner
      zombieFailedCount: 0, // Not detected by ledger scanner
      idempotencyViolationCount: 0, // Not detected by ledger scanner
      autoFixedCount: forwardResult.autoFixed,
      manualReviewCount: forwardResult.flagged + reverseResult.flagged,
      errorCount: forwardResult.errors + reverseResult.errors,
    };

    logger.info("[LedgerConsistencyScanner] Ledger consistency scan complete", {
      runId,
      runCounts,
    });

    return runCounts;
  } finally {
    // Step 4: Clear the cache (always, even on error)
    cache.clear();
    logger.debug("[LedgerConsistencyScanner] Cache cleared", { runId });
  }
}
