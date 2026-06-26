/**
 * Notification Recovery Manager
 *
 * A periodic self-healing supervisor for the notification subsystem. It detects
 * degraded conditions, runs bounded automatic recovery playbooks, and escalates
 * (opsAlert → Sentry) only when recovery repeatedly fails.
 *
 * Detections & playbooks:
 *   1. Stuck outbox events     — PENDING far past nextAttemptAt with a held lock
 *                                → release stale locks so the dispatcher reclaims them.
 *   2. Stuck push receipts     — pending receipts long overdue for a poll
 *                                → reset checkAfter so the receipt worker retries.
 *   3. Growing dead letters    — DEAD_LETTER/FAILED accumulating over threshold
 *                                → escalate (needs human/eng attention).
 *   4. Redis unavailable       — unread-count cache backend down
 *                                → escalate; reads already fall back to Mongo.
 *
 * The manager is intentionally conservative: it only performs reversible,
 * low-risk mitigations (lock release, reschedule). It never deletes data.
 */

import mongoose from "mongoose";
import { logger } from "../../../utils/logger";
import { incCounterWithLabels } from "../../../ops/opsMetrics";
import { OutboxEvent } from "../../../models/OutboxEvent";
import PushReceipt from "../../../models/PushReceipt";
import NotificationHealthSnapshot from "../../../models/NotificationHealthSnapshot";
import { getNotificationHealth } from "./notificationHealthService";
import redisClient from "../../../config/redis";

// ─── Tunables ─────────────────────────────────────────────────────────────────

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;          // run every 5 minutes
const STUCK_OUTBOX_AGE_MS = 10 * 60 * 1000;       // PENDING + locked >10m = stuck
const STUCK_RECEIPT_AGE_MS = 60 * 60 * 1000;      // receipt checkAfter >1h overdue = stuck
const DEAD_LETTER_ALERT_THRESHOLD = 25;           // escalate when DLQ exceeds this
const DEAD_LETTER_WINDOW_MS = 24 * 60 * 60 * 1000; // only recent dead-letters are actionable
const MAX_RECOVERY_ATTEMPTS = 3;                  // escalate after this many failed sweeps per issue

type IssueType = "stuck_outbox" | "stuck_receipts" | "dead_letters" | "redis_down";

interface Detection {
  type: IssueType;
  detected: boolean;
  detail: Record<string, any>;
}

let started = false;
let sweepTimer: ReturnType<typeof setInterval> | null = null;

// Cumulative counters since process start (surfaced in health history).
let totalRecoveriesRun = 0;
let totalEscalations = 0;

// Track consecutive unrecovered occurrences per issue type for escalation.
const failureStreak: Record<IssueType, number> = {
  stuck_outbox: 0,
  stuck_receipts: 0,
  dead_letters: 0,
  redis_down: 0,
};

// ─── Detection ──────────────────────────────────────────────────────────────

async function detectStuckOutbox(): Promise<Detection> {
  const cutoff = new Date(Date.now() - STUCK_OUTBOX_AGE_MS);
  const count = await OutboxEvent.countDocuments({
    status: { $in: ["PENDING", "DISPATCHING"] },
    lockedAt: { $ne: null, $lte: cutoff },
  });
  return { type: "stuck_outbox", detected: count > 0, detail: { count } };
}

async function detectStuckReceipts(): Promise<Detection> {
  const cutoff = new Date(Date.now() - STUCK_RECEIPT_AGE_MS);
  const count = await PushReceipt.countDocuments({
    status: "pending",
    checkAfter: { $lte: cutoff },
  });
  return { type: "stuck_receipts", detected: count > 0, detail: { count } };
}

async function detectDeadLetters(): Promise<Detection> {
  // Only recent dead-letters are actionable — stale failures from weeks ago must
  // not keep paging on-call. Operators triage the recent window.
  const since = new Date(Date.now() - DEAD_LETTER_WINDOW_MS);
  const count = await OutboxEvent.countDocuments({
    status: "DEAD_LETTER",
    updatedAt: { $gte: since },
  });
  return { type: "dead_letters", detected: count >= DEAD_LETTER_ALERT_THRESHOLD, detail: { count, windowHours: DEAD_LETTER_WINDOW_MS / 3_600_000 } };
}

async function detectRedisDown(): Promise<Detection> {
  try {
    await redisClient.ping();
    return { type: "redis_down", detected: false, detail: {} };
  } catch (err) {
    return {
      type: "redis_down",
      detected: true,
      detail: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

// ─── Recovery playbooks ───────────────────────────────────────────────────────

/**
 * Release stale locks on stuck outbox events so the dispatcher can reclaim them.
 * Reversible and safe — the dispatcher's own recovery does the same on its cadence;
 * this is a faster backstop.
 */
async function recoverStuckOutbox(): Promise<boolean> {
  const cutoff = new Date(Date.now() - STUCK_OUTBOX_AGE_MS);
  const res = await OutboxEvent.updateMany(
    {
      status: { $in: ["PENDING", "DISPATCHING"] },
      lockedAt: { $ne: null, $lte: cutoff },
    },
    {
      $set: {
        status: "PENDING",
        lockedAt: null,
        lockedBy: null,
        nextAttemptAt: new Date(),
      },
    }
  );
  logger.info("[RecoveryManager] Released stale outbox locks", {
    modified: res.modifiedCount,
  });
  incCounterWithLabels("notification_recovery_total", { issue: "stuck_outbox", action: "release_lock" }, res.modifiedCount || 0);
  return true;
}

/**
 * Reschedule stuck receipts for an immediate re-poll.
 */
async function recoverStuckReceipts(): Promise<boolean> {
  const cutoff = new Date(Date.now() - STUCK_RECEIPT_AGE_MS);
  const res = await PushReceipt.updateMany(
    { status: "pending", checkAfter: { $lte: cutoff } },
    { $set: { checkAfter: new Date() } }
  );
  logger.info("[RecoveryManager] Rescheduled stuck push receipts", {
    modified: res.modifiedCount,
  });
  incCounterWithLabels("notification_recovery_total", { issue: "stuck_receipts", action: "reschedule" }, res.modifiedCount || 0);
  return true;
}

// ─── Escalation ─────────────────────────────────────────────────────────────

function escalate(detection: Detection): void {
  totalEscalations += 1;
  logger.opsAlert(`[RecoveryManager] Escalating unrecovered notification issue: ${detection.type}`, {
    issue: detection.type,
    ...detection.detail,
    failureStreak: failureStreak[detection.type],
  });
  incCounterWithLabels("notification_recovery_escalation_total", { issue: detection.type }, 1);
}

// ─── Sweep ──────────────────────────────────────────────────────────────────

async function runDetectionAndRecovery(detection: Detection, recover?: () => Promise<boolean>): Promise<void> {
  if (!detection.detected) {
    failureStreak[detection.type] = 0;
    return;
  }

  incCounterWithLabels("notification_recovery_detected_total", { issue: detection.type }, 1);

  // Issues with no safe auto-recovery (dead letters, redis down) escalate directly.
  if (!recover) {
    failureStreak[detection.type] += 1;
    escalate(detection);
    return;
  }

  try {
    const ok = await recover();
    if (ok) {
      totalRecoveriesRun += 1;
      // Recovery executed; reset streak. If the same issue recurs next sweep,
      // the streak rebuilds toward escalation.
      failureStreak[detection.type] = 0;
    } else {
      failureStreak[detection.type] += 1;
    }
  } catch (err) {
    failureStreak[detection.type] += 1;
    logger.error("[RecoveryManager] Recovery playbook failed", {
      issue: detection.type,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Escalate if recovery keeps failing for the same issue.
  if (failureStreak[detection.type] >= MAX_RECOVERY_ATTEMPTS) {
    escalate(detection);
  }
}

export async function sweep(): Promise<void> {
  // Redis check first (cheap, and informs whether cache-dependent recovery is viable).
  const redisDetection = await detectRedisDown();
  await runDetectionAndRecovery(redisDetection); // escalate-only

  // Mongo-backed detections.
  const [outbox, receipts, deadLetters] = await Promise.all([
    detectStuckOutbox(),
    detectStuckReceipts(),
    detectDeadLetters(),
  ]);

  await runDetectionAndRecovery(outbox, recoverStuckOutbox);
  await runDetectionAndRecovery(receipts, recoverStuckReceipts);
  await runDetectionAndRecovery(deadLetters); // escalate-only

  // Record a health snapshot for trend history (best-effort, never blocks).
  await recordHealthSnapshot();
}

/**
 * Captures a point-in-time health snapshot for the /history endpoint.
 */
async function recordHealthSnapshot(): Promise<void> {
  try {
    const health = await getNotificationHealth();
    await NotificationHealthSnapshot.create({
      overall: health.overall,
      status: health.status,
      outboxScore: health.components.outbox.score,
      pushScore: health.components.push.score,
      receiptsScore: health.components.receipts.score,
      redisScore: health.components.redis.score,
      outboxBacklog: Number(health.components.outbox.detail?.backlog || 0),
      recentDeadLetters: Number(health.components.outbox.detail?.deadLetters || 0),
      recoveriesRun: totalRecoveriesRun,
      escalations: totalEscalations,
      secondsSinceLastSuccess: health.secondsSinceLastSuccess,
      createdAt: new Date(),
    });
  } catch (err) {
    logger.warn("[RecoveryManager] Failed to record health snapshot", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function safeSweep(): Promise<void> {
  try {
    await sweep();
  } catch (err) {
    logger.error("[RecoveryManager] Sweep error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function initializeNotificationRecoveryManager(params?: { sweepIntervalMs?: number }): void {
  if (started) return;
  started = true;

  const intervalMs = params?.sweepIntervalMs || SWEEP_INTERVAL_MS;
  sweepTimer = setInterval(() => {
    void safeSweep();
  }, intervalMs);

  logger.info("[RecoveryManager] Notification recovery manager initialized", {
    sweepIntervalMs: intervalMs,
  });
}

export function stopNotificationRecoveryManager(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  started = false;
}

// ─── Exports for testing ──────────────────────────────────────────────────────

export {
  detectStuckOutbox as _detectStuckOutbox,
  detectStuckReceipts as _detectStuckReceipts,
  detectDeadLetters as _detectDeadLetters,
  detectRedisDown as _detectRedisDown,
  recoverStuckOutbox as _recoverStuckOutbox,
  recoverStuckReceipts as _recoverStuckReceipts,
  runDetectionAndRecovery as _runDetectionAndRecovery,
  failureStreak as _failureStreak,
  MAX_RECOVERY_ATTEMPTS,
};

export function _resetRecoveryManager(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  started = false;
  totalRecoveriesRun = 0;
  totalEscalations = 0;
  failureStreak.stuck_outbox = 0;
  failureStreak.stuck_receipts = 0;
  failureStreak.dead_letters = 0;
  failureStreak.redis_down = 0;
}
