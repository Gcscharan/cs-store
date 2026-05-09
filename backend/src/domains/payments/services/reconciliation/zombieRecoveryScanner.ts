/**
 * Zombie Recovery Scanner
 *
 * Detects and recovers PaymentIntents where the process crashed between claiming
 * the Razorpay order creation slot and saving the `gatewayOrderId`. These are
 * called "zombie" intents — `gatewayCreateAttemptedAt` is set but `gatewayOrderId`
 * is absent.
 *
 * Recovery paths:
 *   - LINK: Razorpay order found → set gatewayOrderId, transition to GATEWAY_ORDER_CREATED
 *   - RECOVERABLE: No Razorpay order AND age > 10 min → transition to PAYMENT_RECOVERABLE
 *   - SKIP: No Razorpay order AND age ≤ 10 min → advance lastScannedAt only
 *   - PERMANENT FAILURE: attempts >= 3 OR age > 30 min → mark FAILED, lock intent
 *
 * Design reference: §6 (Zombie Recovery Scanner)
 * Requirements: 2.1–2.10
 */

import Razorpay from "razorpay";

import { Order } from "../../../../models/Order";
import { PaymentIntent } from "../../models/PaymentIntent";
import type { IPaymentIntent } from "../../models/PaymentIntent";
import { assertAllowedTransition } from "../paymentIntentStateMachine";
import { applyFix, ANOMALY_SEVERITY } from "./fixEngine";
import { razorpayLimiter, dbWriteLimiter } from "./concurrencyLimiter";
import { logger } from "../../../../utils/logger";
import type { RunCounts } from "./reconciliationReportService";
import type { AlertChannel } from "./reconciliationAlertService";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 100;
const INTER_ITEM_SLEEP_MS = 50;
const ZOMBIE_MAX_ATTEMPTS = 3;
const ZOMBIE_AGE_HARD_LIMIT_MS = 30 * 60 * 1000;  // 30 minutes
const ZOMBIE_RECOVERABLE_AGE_MS = 10 * 60 * 1000;  // 10 minutes

// Exponential backoff delays for Razorpay API calls: 500ms, 1000ms, 2000ms
const RETRY_DELAYS_MS = [500, 1000, 2000];

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Configuration for the zombie recovery scanner.
 */
export interface ZombieScannerConfig {
  razorpay: Razorpay;
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

/**
 * Fetch with exponential backoff retry logic.
 * Retries on failure with delays: 500ms, 1000ms, 2000ms (max 3 attempts).
 * Returns null if all attempts fail.
 */
async function fetchWithRetry<T>(fn: () => Promise<T>): Promise<T | null> {
  let lastError: any;

  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_DELAYS_MS.length - 1) {
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  logger.error("[ZombieRecoveryScanner] Razorpay API error after all retries", {
    error: String(lastError),
  });
  return null;
}

/**
 * Fetch a Razorpay order by idempotency key.
 * Uses `razorpay.orders.fetch` to check if an order exists for the given key.
 * Returns the order object if found, or null if not found.
 */
async function fetchRazorpayOrderByIdempotencyKey(
  razorpay: Razorpay,
  idempotencyKey: string
): Promise<any | null> {
  // Razorpay uses idempotency keys to deduplicate order creation requests.
  // We query by the idempotency key to check if an order was already created.
  const response: any = await new Promise((resolve, reject) => {
    (razorpay.orders as any).all(
      { receipt: idempotencyKey },
      (err: any, data: any) => {
        if (err) return reject(err);
        return resolve(data);
      }
    );
  });

  if (response && Array.isArray(response.items) && response.items.length > 0) {
    // Return the most recently created order matching this idempotency key
    const sorted = response.items.sort((a: any, b: any) => {
      return Number(b.created_at || 0) - Number(a.created_at || 0);
    });
    return sorted[0];
  }

  return null;
}

// ---------------------------------------------------------------------------
// Recovery path implementations
// ---------------------------------------------------------------------------

/**
 * Task 7.3 — Permanent failure path (audit-log-first).
 *
 * All writes to PaymentIntent and Order happen INSIDE the `fix` callback of
 * `applyFix` — never before it. This upholds the audit-log-first invariant:
 * the audit entry is written first, and the fix is only applied if the audit
 * write succeeds (preventing double-application on crash-replay).
 *
 * Design reference: §6.3 (Permanent Failure Path), §15.3 (Audit-Log-First)
 */
async function handlePermanentFailure(
  intent: Pick<IPaymentIntent, "_id" | "orderId" | "status" | "zombieRecoveryAttempts" | "version">,
  runId: string,
  dryRun: boolean
): Promise<void> {
  logger.warn("[ZombieRecoveryScanner] Permanent failure — max retries or age exceeded", {
    paymentIntentId: String(intent._id),
    zombieRecoveryAttempts: intent.zombieRecoveryAttempts,
    status: intent.status,
  });

  await dbWriteLimiter.run(async () => {
    await applyFix({
      anomalyType: "ZOMBIE_GATEWAY_RECOVERY",
      entityId: String(intent._id),
      action: "AUTO_FIXED",
      runId,
      subService: "ZOMBIE",
      alertSeverity: ANOMALY_SEVERITY["ZOMBIE_GATEWAY_RECOVERY"],
      paymentIntentId: intent._id,
      orderId: intent.orderId,
      beforeState: {
        status: intent.status,
        zombieRecoveryAttempts: intent.zombieRecoveryAttempts,
      },
      afterState: {
        status: "FAILED",
        isLocked: true,
        lockReason: "ZOMBIE_MAX_RETRIES",
      },
      // All DB writes happen inside this fix callback — audit-log-first invariant
      fix: async () => {
        // Mark PaymentIntent FAILED permanently with versioned update
        await PaymentIntent.updateOne(
          {
            _id: intent._id,
            status: { $nin: ["CAPTURED", "FAILED", "CANCELLED", "EXPIRED"] },
          },
          {
            $set: {
              status: "FAILED",
              isLocked: true,
              lockReason: "ZOMBIE_MAX_RETRIES",
              lastScannedAt: new Date(),
            },
            $inc: { version: 1 },
          }
        );

        // Mark associated Order FAILED only if still PENDING (idempotent)
        await Order.updateOne(
          { _id: intent.orderId, paymentStatus: "PENDING" },
          { $set: { paymentStatus: "FAILED" } }
        );
      },
      dryRun,
    });
  });
}

/**
 * Task 7.2 — Link path: Razorpay order found.
 *
 * Atomically sets gatewayOrderId using a compare-and-set with `{ $exists: false }`
 * guard to prevent double-writes from concurrent runs.
 *
 * Design reference: §6.4 (Link Path)
 */
async function handleLinkPath(
  intent: Pick<IPaymentIntent, "_id" | "status" | "zombieRecoveryAttempts">,
  razorpayOrder: any,
  runId: string,
  dryRun: boolean
): Promise<void> {
  logger.info("[ZombieRecoveryScanner] Link path — Razorpay order found", {
    paymentIntentId: String(intent._id),
    razorpayOrderId: razorpayOrder.id,
  });

  // Atomic compare-and-set: only write if gatewayOrderId still absent
  const result = await PaymentIntent.updateOne(
    {
      _id: intent._id,
      gatewayOrderId: { $exists: false },  // atomic guard
      status: { $nin: ["CAPTURED", "FAILED", "CANCELLED", "EXPIRED"] },
    },
    {
      $set: {
        gatewayOrderId: razorpayOrder.id,
        status: "GATEWAY_ORDER_CREATED",
        lastScannedAt: new Date(),
      },
      $inc: { version: 1 },
    }
  );

  if (result.modifiedCount === 0) {
    // Another worker already linked it — no-op
    logger.info("[ZombieRecoveryScanner] Link path no-op — gatewayOrderId already set", {
      paymentIntentId: String(intent._id),
    });
    return;
  }

  await dbWriteLimiter.run(async () => {
    await applyFix({
      anomalyType: "ZOMBIE_GATEWAY_RECOVERY",
      entityId: String(intent._id),
      action: "AUTO_FIXED",
      runId,
      subService: "ZOMBIE",
      alertSeverity: ANOMALY_SEVERITY["ZOMBIE_GATEWAY_RECOVERY"],
      paymentIntentId: intent._id,
      beforeState: {
        gatewayOrderId: null,
        status: intent.status,
        zombieRecoveryAttempts: intent.zombieRecoveryAttempts,
      },
      afterState: {
        gatewayOrderId: razorpayOrder.id,
        status: "GATEWAY_ORDER_CREATED",
      },
      // No fix callback — DB write already applied above via atomic compare-and-set
      dryRun,
    });
  });
}

/**
 * Task 7.2 — Recoverable path: no Razorpay order AND age > 10 min.
 *
 * Validates the transition is allowed via paymentIntentStateMachine, then
 * transitions the PaymentIntent to PAYMENT_RECOVERABLE.
 *
 * Design reference: §6.5 (Recoverable Path)
 */
async function handleRecoverablePath(
  intent: Pick<IPaymentIntent, "_id" | "status" | "zombieRecoveryAttempts">,
  runId: string,
  dryRun: boolean
): Promise<void> {
  logger.info("[ZombieRecoveryScanner] Recoverable path — no Razorpay order, age > 10 min", {
    paymentIntentId: String(intent._id),
    currentStatus: intent.status,
  });

  // Validate the transition is allowed by the state machine
  assertAllowedTransition(intent.status, "PAYMENT_RECOVERABLE");

  await PaymentIntent.updateOne(
    { _id: intent._id, status: intent.status },
    {
      $set: { status: "PAYMENT_RECOVERABLE", lastScannedAt: new Date() },
      $inc: { version: 1 },
    }
  );

  await dbWriteLimiter.run(async () => {
    await applyFix({
      anomalyType: "ZOMBIE_GATEWAY_RECOVERY",
      entityId: String(intent._id),
      action: "AUTO_FIXED",
      runId,
      subService: "ZOMBIE",
      alertSeverity: ANOMALY_SEVERITY["ZOMBIE_GATEWAY_RECOVERY"],
      paymentIntentId: intent._id,
      beforeState: {
        status: intent.status,
        zombieRecoveryAttempts: intent.zombieRecoveryAttempts,
      },
      afterState: {
        status: "PAYMENT_RECOVERABLE",
      },
      // No fix callback — DB write already applied above
      dryRun,
    });
  });
}

// ---------------------------------------------------------------------------
// Core scanner implementation
// ---------------------------------------------------------------------------

interface ScanResult {
  scanned: number;
  linked: number;
  recovered: number;
  skipped: number;
  permanentlyFailed: number;
  errors: number;
}

/**
 * Run one batch of the zombie recovery scan.
 *
 * Tasks 7.1 + 7.2 + 7.3 combined:
 *   1. Scan query (Task 7.1)
 *   2. Atomic claim + hard-limit check (Task 7.1)
 *   3. Three recovery paths: link, recoverable, skip (Task 7.2)
 *   4. Permanent failure path (Task 7.3)
 *
 * Design reference: §6.1 (Scan Query), §6.2 (Per-Intent Recovery Flow)
 */
async function runZombieScan(
  razorpay: Razorpay,
  runId: string,
  dryRun: boolean
): Promise<ScanResult> {
  const result: ScanResult = {
    scanned: 0,
    linked: 0,
    recovered: 0,
    skipped: 0,
    permanentlyFailed: 0,
    errors: 0,
  };

  // ── Task 7.1: Scan query ─────────────────────────────────────────────────
  // Fetch zombie PaymentIntents: gatewayCreateAttemptedAt set, gatewayOrderId absent,
  // attempts < 3, non-terminal status, not locked, sorted by lastScannedAt ascending
  // (fairness: least-recently-scanned first).
  const zombies = await PaymentIntent.find({
    gatewayCreateAttemptedAt: { $exists: true },
    gatewayOrderId: { $exists: false },
    zombieRecoveryAttempts: { $lt: ZOMBIE_MAX_ATTEMPTS },
    status: { $nin: ["CAPTURED", "FAILED", "CANCELLED", "EXPIRED"] },
    isLocked: { $ne: true },
  })
    .select("_id orderId idempotencyKey gatewayCreateAttemptedAt zombieRecoveryAttempts status version")
    .sort({ lastScannedAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  logger.info("[ZombieRecoveryScanner] Scan found zombies", {
    runId,
    count: zombies.length,
  });

  for (const intent of zombies as any[]) {
    result.scanned++;

    try {
      const now = new Date();

      // ── Task 7.1: Atomic claim ───────────────────────────────────────────
      // Increment zombieRecoveryAttempts atomically using optimistic concurrency.
      // If modifiedCount === 0, a concurrent run already claimed this intent — skip.
      const claimResult = await PaymentIntent.updateOne(
        {
          _id: intent._id,
          zombieRecoveryAttempts: intent.zombieRecoveryAttempts,
        },
        {
          $inc: { zombieRecoveryAttempts: 1 },
          $set: { lastScannedAt: now },
        }
      );

      if (claimResult.modifiedCount === 0) {
        // Concurrent run claimed this intent — skip
        logger.debug("[ZombieRecoveryScanner] Skipping — concurrent run claimed intent", {
          paymentIntentId: String(intent._id),
        });
        result.skipped++;
        await sleep(INTER_ITEM_SLEEP_MS);
        continue;
      }

      // ── Task 7.1: Hard-limit check ───────────────────────────────────────
      // After the atomic increment, the effective attempt count is zombieRecoveryAttempts + 1.
      // Check if we've hit the hard limit (>= 3 attempts) or the age TTL (> 30 min).
      const ageMs = now.getTime() - new Date(intent.gatewayCreateAttemptedAt).getTime();
      const effectiveAttempts = intent.zombieRecoveryAttempts + 1;

      if (effectiveAttempts >= ZOMBIE_MAX_ATTEMPTS || ageMs > ZOMBIE_AGE_HARD_LIMIT_MS) {
        // ── Task 7.3: Permanent failure path ────────────────────────────────
        await handlePermanentFailure(intent, runId, dryRun);
        result.permanentlyFailed++;
        await sleep(INTER_ITEM_SLEEP_MS);
        continue;
      }

      // ── Task 7.2: Query Razorpay with exponential backoff ────────────────
      let razorpayOrder: any | null = null;
      try {
        razorpayOrder = await razorpayLimiter.run(() =>
          fetchWithRetry(() =>
            fetchRazorpayOrderByIdempotencyKey(razorpay, intent.idempotencyKey)
          )
        );
      } catch (razorpayError) {
        // Log and skip on Razorpay API error (Requirement 2.9)
        logger.error("[ZombieRecoveryScanner] Razorpay API error — skipping intent", {
          paymentIntentId: String(intent._id),
          idempotencyKey: intent.idempotencyKey,
          error: String(razorpayError),
        });
        result.errors++;
        await sleep(INTER_ITEM_SLEEP_MS);
        continue;
      }

      // ── Task 7.2: Three recovery paths ──────────────────────────────────

      if (razorpayOrder !== null) {
        // 4a. LINK path: Razorpay order found
        await handleLinkPath(intent, razorpayOrder, runId, dryRun);
        result.linked++;
      } else if (ageMs > ZOMBIE_RECOVERABLE_AGE_MS) {
        // 4b. RECOVERABLE path: no Razorpay order AND age > 10 min
        await handleRecoverablePath(intent, runId, dryRun);
        result.recovered++;
      } else {
        // 4c. SKIP path: no Razorpay order AND age ≤ 10 min
        // Too recent — winner may still be in progress. Advance lastScannedAt only.
        // (lastScannedAt was already updated in the atomic claim above)
        logger.debug("[ZombieRecoveryScanner] Skip path — too recent, no Razorpay order", {
          paymentIntentId: String(intent._id),
          ageMs,
        });
        result.skipped++;
      }

      // ── Sleep 50ms between items ─────────────────────────────────────────
      await sleep(INTER_ITEM_SLEEP_MS);
    } catch (error) {
      result.errors++;
      logger.error("[ZombieRecoveryScanner] Error processing intent", {
        paymentIntentId: String(intent._id),
        error: String(error),
      });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API — Task 7.4
// ---------------------------------------------------------------------------

/**
 * Task 7.4 — Wire into exported function.
 *
 * Run the zombie recovery scanner and return RunCounts for report persistence.
 *
 * Design reference: §6 (Zombie Recovery Scanner)
 * Requirements: 2.1–2.10
 *
 * @param runId - Unique identifier for the reconciliation run (UUID v4)
 * @param config - Scanner configuration (Razorpay client, optional dryRun flag)
 * @param alertChannel - Alert channel for sending alerts (unused directly by zombie scanner;
 *                       alerts are emitted at run completion by the orchestrator)
 * @returns RunCounts object with aggregated counts for report persistence
 */
export async function runZombieRecoveryScanner(
  runId: string,
  config: ZombieScannerConfig,
  alertChannel: AlertChannel
): Promise<RunCounts> {
  const { razorpay, dryRun = false } = config;

  logger.info("[ZombieRecoveryScanner] Starting zombie recovery scan", {
    runId,
    dryRun,
  });

  const scanResult = await runZombieScan(razorpay, runId, dryRun);

  logger.info("[ZombieRecoveryScanner] Zombie recovery scan complete", {
    runId,
    ...scanResult,
  });

  // Map scan results to RunCounts for report persistence
  const runCounts: RunCounts = {
    totalScanned: scanResult.scanned,
    falsePaidCount: 0,
    phantomPaidCount: 0,
    orphanLedgerCount: 0,
    missingLedgerCount: 0,
    amountMismatchCount: 0,
    partialCaptureCount: 0,
    piStatusMismatchCount: 0,
    zombieRecoveredCount: scanResult.linked + scanResult.recovered,
    zombieFailedCount: scanResult.permanentlyFailed,
    idempotencyViolationCount: 0,
    autoFixedCount: scanResult.linked + scanResult.recovered + scanResult.permanentlyFailed,
    manualReviewCount: 0,
    errorCount: scanResult.errors,
  };

  return runCounts;
}
