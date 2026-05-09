/**
 * Reconciliation Orchestrator
 *
 * Schedules and coordinates all four reconciliation sub-services:
 *   - Ledger Consistency Scanner  (default: every 60 min)
 *   - Zombie Recovery Scanner     (default: every 15 min)
 *   - Idempotency Auditor         (default: every 60 min)
 *   - Daily Summary Generator     (default: 01:00 UTC)
 *
 * Provides:
 *   - Overlap protection via ReconciliationRun lock documents
 *   - Crash recovery via recoverAbandonedRuns() on startup
 *   - Consecutive failure guard with process.exit(1) after maxConsecutiveFailures
 *   - runReconciliationOnce() for tests and admin use (bypasses overlap check)
 *
 * Design reference: §3 (Orchestrator Design)
 * Requirements: 5.1–5.11
 */

import { v4 as uuidv4 } from "uuid";

import { logger } from "../../../../utils/logger";
import {
  ReconciliationRun,
  type IReconciliationRun,
  type SubServiceName,
} from "../../models/ReconciliationRun";
import { runLedgerConsistencyScanner } from "./ledgerConsistencyScanner";
import { runZombieRecoveryScanner } from "./zombieRecoveryScanner";
import { runIdempotencyAuditor } from "./idempotencyAuditor";
import {
  persistReport,
  generateDailySummary,
  type RunCounts,
} from "./reconciliationReportService";
import { initializeLimiters } from "./concurrencyLimiter";
import {
  LogAlertChannel,
  type AlertChannel,
} from "./reconciliationAlertService";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReconciliationConfig {
  /** Ledger Consistency Scanner interval in ms. Default: 60 * 60_000 (60 min) */
  ledgerIntervalMs?: number;
  /** Zombie Recovery Scanner interval in ms. Default: 15 * 60_000 (15 min) */
  zombieIntervalMs?: number;
  /** Idempotency Auditor interval in ms. Default: 60 * 60_000 (60 min) */
  idempotencyIntervalMs?: number;
  /** Hour (UTC) at which to run the daily summary. Default: 1 (01:00 UTC) */
  dailySummaryHourUtc?: number;
  /** Alert channel implementation. Default: LogAlertChannel */
  alertChannel?: AlertChannel;
  /** Max consecutive failures before process.exit(1). Default: 10 */
  maxConsecutiveFailures?: number;
  /** Razorpay client instance */
  razorpay?: any;
  /** Dry-run mode — no corrective writes, audit entries use NO_OP */
  dryRun?: boolean;
  /** Max concurrent Razorpay API calls. Default: 5 */
  maxConcurrentRazorpayCalls?: number;
  /** Max concurrent DB write operations. Default: 10 */
  maxConcurrentDbWrites?: number;
  /** Razorpay status cache TTL in ms. Default: 5 * 60_000 (5 min) */
  razorpayCacheTtlMs?: number;
}

/**
 * Combined result returned by runReconciliationOnce.
 * Contains per-sub-service counts and the overall totals.
 */
export interface ReconciliationRunResult {
  subServices: Partial<Record<SubServiceName, RunCounts>>;
  totals: RunCounts;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** Guard against double-start (Requirement 5.2) */
let started = false;

/** Per-sub-service consecutive failure counters (Requirement 5.8, 5.9) */
const consecutiveFailures: Record<SubServiceName, number> = {
  LEDGER: 0,
  ZOMBIE: 0,
  IDEMPOTENCY: 0,
  DAILY_SUMMARY: 0,
};

// ---------------------------------------------------------------------------
// Task 10.1 — acquireRunLock
// ---------------------------------------------------------------------------

/**
 * Attempt to acquire a run lock for the given sub-service.
 *
 * Queries for an existing RUNNING ReconciliationRun within the overlap window
 * (2× intervalMs). If found, logs [RECONCILIATION_OVERLAP_SKIPPED] and returns null.
 * Otherwise creates and returns a new RUNNING ReconciliationRun document.
 *
 * Design reference: §3.2 (Overlap Lock Algorithm)
 * Requirements: 5.4
 */
async function acquireRunLock(
  subService: SubServiceName,
  intervalMs: number
): Promise<IReconciliationRun | null> {
  const overlapWindowMs = intervalMs * 2;
  const cutoff = new Date(Date.now() - overlapWindowMs);

  const existing = await ReconciliationRun.findOne({
    subService,
    status: "RUNNING",
    startedAt: { $gte: cutoff },
  });

  if (existing) {
    logger.warn("[RECONCILIATION_OVERLAP_SKIPPED]", {
      subService,
      existingRunId: existing.runId,
    });
    return null;
  }

  return ReconciliationRun.create({
    runId: uuidv4(),
    subService,
    status: "RUNNING",
    startedAt: new Date(),
    processedCount: 0,
    anomalyCount: 0,
    autoFixedCount: 0,
  });
}

// ---------------------------------------------------------------------------
// Task 10.1 — recoverAbandonedRuns
// ---------------------------------------------------------------------------

/**
 * Detect and mark abandoned ReconciliationRun documents on process startup.
 *
 * For each sub-service, finds all RUNNING runs with startedAt older than
 * 2× the sub-service interval and marks them ABANDONED. Items already
 * processed in the abandoned run are protected by Fix_DedupeKey idempotency.
 *
 * Design reference: §3.3 (Crash Recovery Algorithm)
 * Requirements: 5.7
 */
export async function recoverAbandonedRuns(): Promise<void> {
  const intervals: Record<SubServiceName, number> = {
    LEDGER: 60 * 60_000,
    ZOMBIE: 15 * 60_000,
    IDEMPOTENCY: 60 * 60_000,
    DAILY_SUMMARY: 24 * 60 * 60_000,
  };

  for (const [subService, intervalMs] of Object.entries(intervals)) {
    const cutoff = new Date(Date.now() - intervalMs * 2);
    const result = await ReconciliationRun.updateMany(
      { subService, status: "RUNNING", startedAt: { $lt: cutoff } },
      { $set: { status: "ABANDONED", abandonedAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      logger.warn("[RECONCILIATION_RUNS_ABANDONED]", {
        subService,
        count: result.modifiedCount,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Task 10.2 — Consecutive failure guard
// ---------------------------------------------------------------------------

/**
 * Run `fn` and track consecutive failures per sub-service.
 *
 * On success: resets the consecutive failure counter to 0.
 * On error: increments the counter, logs at ERROR level.
 *   If counter reaches maxFailures: logs [RECONCILIATION_FATAL] and calls process.exit(1).
 *
 * Design reference: §3.4 (Consecutive Failure Guard)
 * Requirements: 5.8, 5.9
 */
async function runWithFailureGuard(
  subService: SubServiceName,
  fn: () => Promise<void>,
  maxFailures: number
): Promise<void> {
  try {
    await fn();
    consecutiveFailures[subService] = 0;
  } catch (e) {
    consecutiveFailures[subService]++;
    logger.error(`[RECONCILIATION_ERROR] subService=${subService}`, e);

    if (consecutiveFailures[subService] >= maxFailures) {
      logger.error("[RECONCILIATION_FATAL]", {
        subService,
        failures: consecutiveFailures[subService],
      });
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Task 10.2 — Sub-service runner
// ---------------------------------------------------------------------------

/**
 * Build a zero-value RunCounts object.
 */
function zeroRunCounts(): RunCounts {
  return {
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
    autoFixedCount: 0,
    manualReviewCount: 0,
    errorCount: 0,
  };
}

/**
 * Determine the end-of-run alert severity from the counts.
 *
 * CRITICAL  — any falsePaid or amountMismatch (already fired mid-run, but also at end)
 * WARNING   — any orphan/partial/pi mismatch, or mismatchRate > 1%
 * INFO      — anything else (zombie, missing ledger, idempotency)
 */
function resolveEndOfRunSeverity(counts: RunCounts): "CRITICAL" | "WARNING" | "INFO" {
  if (counts.falsePaidCount > 0 || counts.amountMismatchCount > 0) {
    return "CRITICAL";
  }

  const mismatchCount =
    counts.orphanLedgerCount +
    counts.partialCaptureCount +
    counts.piStatusMismatchCount +
    counts.phantomPaidCount;

  const mismatchRate =
    counts.totalScanned > 0
      ? (mismatchCount / counts.totalScanned) * 100
      : 0;

  if (mismatchCount > 0 || mismatchRate > 1) {
    return "WARNING";
  }

  return "INFO";
}

/**
 * Run a single sub-service:
 *   1. Acquire run lock (skip if overlap)
 *   2. Execute the appropriate scanner
 *   3. Persist the report
 *   4. Send end-of-run alert
 *   5. Update ReconciliationRun to COMPLETED or FAILED
 *
 * Requirements: 5.4, 5.5, 5.6
 */
async function runSubService(
  subService: SubServiceName,
  config: ReconciliationConfig | undefined,
  intervalMs: number
): Promise<void> {
  const alertChannel = config?.alertChannel ?? new LogAlertChannel();
  const dryRun = config?.dryRun ?? false;
  const razorpay = config?.razorpay;

  // Step 1: Acquire run lock
  const run = await acquireRunLock(subService, intervalMs);
  if (!run) {
    // Overlap detected — skip this run
    return;
  }

  const runId = run.runId;
  let counts: RunCounts = zeroRunCounts();

  try {
    // Step 2: Execute the appropriate scanner
    switch (subService) {
      case "LEDGER": {
        if (!razorpay) {
          throw new Error("[RECONCILIATION] razorpay client is required for LEDGER sub-service");
        }
        counts = await runLedgerConsistencyScanner(
          runId,
          {
            razorpay,
            dryRun,
            razorpayCacheTtlMs: config?.razorpayCacheTtlMs,
          },
          alertChannel
        );
        break;
      }

      case "ZOMBIE": {
        if (!razorpay) {
          throw new Error("[RECONCILIATION] razorpay client is required for ZOMBIE sub-service");
        }
        counts = await runZombieRecoveryScanner(
          runId,
          { razorpay, dryRun },
          alertChannel
        );
        break;
      }

      case "IDEMPOTENCY": {
        counts = await runIdempotencyAuditor(runId, { dryRun });
        break;
      }

      case "DAILY_SUMMARY": {
        // Generate daily summary for yesterday (UTC)
        const yesterday = new Date(Date.now() - 24 * 60 * 60_000);
        const dateUtc = yesterday.toISOString().slice(0, 10);
        await generateDailySummary(dateUtc);
        // DAILY_SUMMARY doesn't produce RunCounts — use zeros
        break;
      }
    }

    // Step 3: Persist report (skip for DAILY_SUMMARY — it has its own persistence)
    if (subService !== "DAILY_SUMMARY") {
      const report = await persistReport(runId, subService, counts);

      // Step 4: Send end-of-run alert
      const severity = resolveEndOfRunSeverity(counts);
      await alertChannel.sendAlert(report, severity);
    }

    // Step 5: Update run to COMPLETED
    await ReconciliationRun.updateOne(
      { runId },
      {
        $set: {
          status: "COMPLETED",
          completedAt: new Date(),
          processedCount: counts.totalScanned,
          anomalyCount:
            counts.falsePaidCount +
            counts.phantomPaidCount +
            counts.orphanLedgerCount +
            counts.missingLedgerCount +
            counts.amountMismatchCount +
            counts.partialCaptureCount +
            counts.piStatusMismatchCount +
            counts.zombieRecoveredCount +
            counts.zombieFailedCount +
            counts.idempotencyViolationCount,
          autoFixedCount: counts.autoFixedCount,
        },
      }
    );

    logger.info("[RECONCILIATION_RUN_COMPLETED]", {
      runId,
      subService,
      totalScanned: counts.totalScanned,
      autoFixedCount: counts.autoFixedCount,
    });
  } catch (error) {
    // Step 5 (failure path): Update run to FAILED
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await ReconciliationRun.updateOne(
      { runId },
      {
        $set: {
          status: "FAILED",
          failedAt: new Date(),
          error: errorMessage,
        },
      }
    );

    logger.error("[RECONCILIATION_RUN_FAILED]", {
      runId,
      subService,
      error: errorMessage,
    });

    // Re-throw so runWithFailureGuard can track consecutive failures
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Task 10.3 — startReconciliationSystem
// ---------------------------------------------------------------------------

/**
 * Start all reconciliation sub-services on their configured schedules.
 *
 * Idempotent — safe to call multiple times; subsequent calls log a warning
 * and return without creating duplicate timers (Requirement 5.2).
 *
 * On startup:
 *   1. Initialises concurrency limiters from config
 *   2. Calls recoverAbandonedRuns() to handle any crash-left RUNNING runs
 *   3. Schedules Ledger, Zombie, and Idempotency scanners via setInterval
 *   4. Schedules the daily summary via a setTimeout-based daily loop
 *
 * Requirements: 5.1, 5.2, 5.3; Design: §15.4
 */
export function startReconciliationSystem(config?: ReconciliationConfig): void {
  if (started) {
    logger.warn("[RECONCILIATION_ALREADY_STARTED]");
    return;
  }
  started = true;

  // Initialise global concurrency limiters from config
  initializeLimiters({
    maxConcurrentRazorpayCalls: config?.maxConcurrentRazorpayCalls,
    maxConcurrentDbWrites: config?.maxConcurrentDbWrites,
  });

  // Recover any abandoned runs from a previous crash
  recoverAbandonedRuns().catch((err) => {
    logger.error("[RECONCILIATION_RECOVER_ABANDONED_FAILED]", err);
  });

  const maxFailures = config?.maxConsecutiveFailures ?? 10;

  // ── Ledger Consistency Scanner ───────────────────────────────────────────
  const ledgerIntervalMs = config?.ledgerIntervalMs ?? 60 * 60_000;
  setInterval(() => {
    runWithFailureGuard(
      "LEDGER",
      () => runSubService("LEDGER", config, ledgerIntervalMs),
      maxFailures
    );
  }, ledgerIntervalMs);

  // ── Zombie Recovery Scanner ──────────────────────────────────────────────
  const zombieIntervalMs = config?.zombieIntervalMs ?? 15 * 60_000;
  setInterval(() => {
    runWithFailureGuard(
      "ZOMBIE",
      () => runSubService("ZOMBIE", config, zombieIntervalMs),
      maxFailures
    );
  }, zombieIntervalMs);

  // ── Idempotency Auditor ──────────────────────────────────────────────────
  const idempotencyIntervalMs = config?.idempotencyIntervalMs ?? 60 * 60_000;
  setInterval(() => {
    runWithFailureGuard(
      "IDEMPOTENCY",
      () => runSubService("IDEMPOTENCY", config, idempotencyIntervalMs),
      maxFailures
    );
  }, idempotencyIntervalMs);

  // ── Daily Summary — scheduled at dailySummaryHourUtc (default 01:00 UTC) ─
  scheduleDailySummary(config, maxFailures);

  logger.info("[RECONCILIATION_SYSTEM_STARTED]", {
    ledgerIntervalMs,
    zombieIntervalMs,
    idempotencyIntervalMs,
    dailySummaryHourUtc: config?.dailySummaryHourUtc ?? 1,
    dryRun: config?.dryRun ?? false,
  });
}

/**
 * Schedule the daily summary to fire at `dailySummaryHourUtc:00 UTC` each day.
 * Uses a recursive setTimeout so the schedule self-corrects for clock drift.
 */
function scheduleDailySummary(
  config: ReconciliationConfig | undefined,
  maxFailures: number
): void {
  const targetHour = config?.dailySummaryHourUtc ?? 1;
  const dailySummaryIntervalMs = 24 * 60 * 60_000;

  const msUntilNextRun = msUntilNextUtcHour(targetHour);

  setTimeout(() => {
    runWithFailureGuard(
      "DAILY_SUMMARY",
      () => runSubService("DAILY_SUMMARY", config, dailySummaryIntervalMs),
      maxFailures
    );
    // Re-schedule for the next day
    scheduleDailySummary(config, maxFailures);
  }, msUntilNextRun);
}

/**
 * Calculate milliseconds until the next occurrence of `hourUtc:00:00 UTC`.
 */
function msUntilNextUtcHour(hourUtc: number): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hourUtc,
      0,
      0,
      0
    )
  );
  if (next.getTime() <= now.getTime()) {
    // Target hour already passed today — schedule for tomorrow
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

// ---------------------------------------------------------------------------
// Task 10.4 — runReconciliationOnce
// ---------------------------------------------------------------------------

/**
 * Run one or all sub-services exactly once, bypassing the overlap check.
 * Intended for use in tests and manual admin triggers.
 *
 * If `subService` is omitted, all four sub-services run sequentially.
 * Returns a combined ReconciliationRunResult with per-sub-service counts
 * and aggregated totals.
 *
 * Requirements: 5.11
 */
export async function runReconciliationOnce(
  subService?: SubServiceName,
  config?: ReconciliationConfig
): Promise<ReconciliationRunResult> {
  const alertChannel = config?.alertChannel ?? new LogAlertChannel();
  const dryRun = config?.dryRun ?? false;
  const razorpay = config?.razorpay;

  const subServicesToRun: SubServiceName[] = subService
    ? [subService]
    : ["LEDGER", "ZOMBIE", "IDEMPOTENCY", "DAILY_SUMMARY"];

  const result: ReconciliationRunResult = {
    subServices: {},
    totals: zeroRunCounts(),
  };

  for (const svc of subServicesToRun) {
    const runId = uuidv4();
    let counts: RunCounts = zeroRunCounts();

    try {
      switch (svc) {
        case "LEDGER": {
          if (!razorpay) {
            logger.warn("[RECONCILIATION_ONCE] Skipping LEDGER — no razorpay client provided");
            break;
          }
          counts = await runLedgerConsistencyScanner(
            runId,
            {
              razorpay,
              dryRun,
              razorpayCacheTtlMs: config?.razorpayCacheTtlMs,
            },
            alertChannel
          );
          break;
        }

        case "ZOMBIE": {
          if (!razorpay) {
            logger.warn("[RECONCILIATION_ONCE] Skipping ZOMBIE — no razorpay client provided");
            break;
          }
          counts = await runZombieRecoveryScanner(
            runId,
            { razorpay, dryRun },
            alertChannel
          );
          break;
        }

        case "IDEMPOTENCY": {
          counts = await runIdempotencyAuditor(runId, { dryRun });
          break;
        }

        case "DAILY_SUMMARY": {
          const yesterday = new Date(Date.now() - 24 * 60 * 60_000);
          const dateUtc = yesterday.toISOString().slice(0, 10);
          await generateDailySummary(dateUtc);
          // DAILY_SUMMARY has its own persistence — no RunCounts to accumulate
          break;
        }
      }

      // Persist report for scanners that produce counts
      if (svc !== "DAILY_SUMMARY") {
        const report = await persistReport(runId, svc, counts);
        const severity = resolveEndOfRunSeverity(counts);
        await alertChannel.sendAlert(report, severity);
      }

      result.subServices[svc] = counts;

      // Accumulate totals
      for (const key of Object.keys(result.totals) as (keyof RunCounts)[]) {
        (result.totals[key] as number) += counts[key];
      }
    } catch (error) {
      logger.error(`[RECONCILIATION_ONCE_ERROR] subService=${svc}`, error);
      result.subServices[svc] = counts;
    }
  }

  return result;
}
