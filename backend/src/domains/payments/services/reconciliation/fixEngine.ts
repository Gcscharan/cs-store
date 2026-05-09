/**
 * Fix Engine — idempotent corrective action applier for the Payment Reconciliation System.
 *
 * All corrective writes flow through `applyFix`. The audit log entry is written FIRST,
 * before the fix callback is invoked. This guarantees the audit-log-first invariant:
 *
 *   - If the process crashes between the audit write and the fix execution, the next run
 *     will see the dedupeKey in the audit log and return { applied: false } — a safe no-op.
 *   - A fix might be skipped once on crash, but it will NEVER be applied twice.
 *
 * Design reference: §4 (Fix Engine), §15.3 (Audit-Log-First Invariant — Issue 3)
 */

import mongoose from "mongoose";

import {
  ReconciliationAuditLog,
} from "../../models/ReconciliationAuditLog";
import type {
  AnomalyType,
  FixAction,
  AlertSeverity,
} from "../../models/ReconciliationAuditLog";
import type { SubServiceName } from "../../models/ReconciliationRun";
import { dbWriteLimiter } from "./concurrencyLimiter";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FixArgs {
  anomalyType: AnomalyType;
  entityId: string;              // orderId or paymentIntentId as string
  action: FixAction;
  runId: string;
  subService: SubServiceName;
  alertSeverity: AlertSeverity;
  orderId?: mongoose.Types.ObjectId;
  paymentIntentId?: mongoose.Types.ObjectId;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  fix?: () => Promise<void>;     // optional — omit for FLAGGED_FOR_REVIEW (no DB change)
  dryRun?: boolean;              // when true, write NO_OP audit log, skip fix callback
}

// ---------------------------------------------------------------------------
// Severity routing map
// ---------------------------------------------------------------------------

/**
 * Maps each AnomalyType to its default AlertSeverity.
 * Callers may override per-invocation via `FixArgs.alertSeverity`.
 *
 * Design reference: §4 (Severity routing)
 */
export const ANOMALY_SEVERITY: Record<AnomalyType, AlertSeverity> = {
  FALSE_PAID:              "CRITICAL",
  AMOUNT_MISMATCH:         "CRITICAL",
  ORPHAN_LEDGER:           "WARNING",
  PARTIAL_CAPTURE:         "WARNING",
  PI_STATUS_MISMATCH:      "WARNING",
  PHANTOM_PAID:            "WARNING",
  MISSING_LEDGER:          "INFO",
  ZOMBIE_GATEWAY_RECOVERY: "INFO",
  IDEMPOTENCY_VIOLATION:   "INFO",
};

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Apply a reconciliation fix with exactly-once semantics.
 *
 * Sequence:
 *   1. Construct `dedupeKey = "${anomalyType}:${entityId}:${action}"`
 *   2. Write audit log entry (unique on dedupeKey)
 *      - E11000 duplicate key → already applied → return { applied: false }
 *      - Any other DB error   → re-throw
 *   3. If `dryRun = true` → audit log written with action = 'NO_OP', skip fix callback
 *   4. If `fix` callback provided → run it inside `dbWriteLimiter` for back-pressure
 *   5. Return { applied: true }
 *
 * @param args - Fix arguments including anomaly metadata and optional fix callback.
 * @returns `{ applied: true }` if the fix was applied, `{ applied: false }` if already applied.
 */
export async function applyFix(args: FixArgs): Promise<{ applied: boolean }> {
  const dedupeKey = `${args.anomalyType}:${args.entityId}:${args.action}`;

  // Determine the effective action for the audit log entry.
  // In dry-run mode we record NO_OP so the audit trail reflects intent without mutation.
  const effectiveAction: FixAction = args.dryRun ? "NO_OP" : args.action;

  // -------------------------------------------------------------------------
  // Step 1: Write audit log entry FIRST (audit-log-first invariant)
  // -------------------------------------------------------------------------
  try {
    await ReconciliationAuditLog.create({
      dedupeKey,
      runId: args.runId,
      category: args.anomalyType,
      subService: args.subService,
      orderId: args.orderId,
      paymentIntentId: args.paymentIntentId,
      action: effectiveAction,
      alertSeverity: args.alertSeverity,
      beforeState: args.beforeState,
      afterState: args.afterState,
      recordedAt: new Date(),
    });
  } catch (e: any) {
    // E11000 duplicate key error on dedupeKey → already applied in a previous run
    if (e?.code === 11000 || String(e?.message ?? "").includes("E11000")) {
      return { applied: false };
    }
    // Any other DB error — propagate to caller
    throw e;
  }

  // -------------------------------------------------------------------------
  // Step 2: Execute the fix (only if audit log write succeeded)
  // -------------------------------------------------------------------------

  // Dry-run mode: audit log written with NO_OP, skip the fix callback entirely
  if (args.dryRun) {
    return { applied: true };
  }

  // Execute the fix callback under the global DB write concurrency limiter
  if (args.fix) {
    await dbWriteLimiter.run(args.fix);
  }

  return { applied: true };
}
