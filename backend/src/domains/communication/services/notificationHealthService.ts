/**
 * Notification Health Service
 *
 * Computes a real-time health model for the notification subsystem from live
 * MongoDB/Redis state. Exposed via GET /internal/notification-health for ops
 * dashboards, uptime probes, and on-call triage.
 *
 * Each component is scored 0..100 from backlog/error signals; the overall score
 * is a weighted blend. Status thresholds:
 *   >= 90  healthy
 *   >= 70  degraded
 *   <  70  unhealthy
 */

import { OutboxEvent } from "../../../models/OutboxEvent";
import PushRetry from "../../../models/PushRetry";
import PushReceipt from "../../../models/PushReceipt";
import NotificationAudit from "../../../models/NotificationAudit";
import redisClient from "../../../config/redis";
import { logger } from "../../../utils/logger";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  score: number;            // 0..100
  status: HealthStatus;
  critical: boolean;        // whether a low score forces overall degradation
  detail: Record<string, any>;
}

export interface NotificationHealth {
  overall: number;          // 0..100 (weighted blend)
  status: HealthStatus;     // worst-of: blend + hard-floor rules
  components: {
    outbox: ComponentHealth;
    push: ComponentHealth;
    receipts: ComponentHealth;
    redis: ComponentHealth;
  };
  lastSuccessfulNotification: string | null;
  secondsSinceLastSuccess: number | null;
  generatedAt: string;
}

// ─── Thresholds (tunable) ──────────────────────────────────────────────────────

const OUTBOX_BACKLOG_WARN = 100;     // PENDING events past due
const OUTBOX_BACKLOG_CRIT = 1000;
const DEAD_LETTER_WARN = 10;
const DEAD_LETTER_CRIT = 50;
const RETRY_BACKLOG_WARN = 100;
const RETRY_BACKLOG_CRIT = 1000;
const RECEIPT_BACKLOG_WARN = 500;    // pending receipts overdue for poll
const RECEIPT_BACKLOG_CRIT = 5000;

// Only recent dead-letters count toward health/alerts (stale failures from weeks
// ago shouldn't pin the score or page on-call indefinitely).
const DEAD_LETTER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

// Hard-floor rules: a critical component below these scores forces the overall
// status DOWN regardless of the weighted average, so a failing subsystem can't
// hide behind healthy ones.
const CRITICAL_DEGRADED_FLOOR = 70; // any critical component < 70 → at least degraded
const CRITICAL_UNHEALTHY_FLOOR = 40; // any critical component < 40 → unhealthy

function statusFromScore(score: number): HealthStatus {
  if (score >= 90) return "healthy";
  if (score >= 70) return "degraded";
  return "unhealthy";
}

/**
 * Linear score: 100 when value<=warn, 0 when value>=crit, interpolated between.
 */
function scoreFromBacklog(value: number, warn: number, crit: number): number {
  if (value <= warn) return 100;
  if (value >= crit) return 0;
  const ratio = (value - warn) / (crit - warn);
  return Math.round((1 - ratio) * 100);
}

// ─── Component checks ──────────────────────────────────────────────────────────

async function checkOutbox(): Promise<ComponentHealth> {
  const now = new Date();
  // Only count RECENT dead-letters — a failure from weeks ago shouldn't keep the
  // health score (and on-call alerts) pinned forever. Operators triage recent ones.
  const deadLetterWindow = new Date(Date.now() - DEAD_LETTER_WINDOW_MS);
  const [backlog, deadLetters, failed] = await Promise.all([
    OutboxEvent.countDocuments({
      status: "PENDING",
      $or: [{ nextAttemptAt: { $exists: false } }, { nextAttemptAt: { $lte: now } }],
    }),
    OutboxEvent.countDocuments({ status: "DEAD_LETTER", updatedAt: { $gte: deadLetterWindow } }),
    OutboxEvent.countDocuments({ status: "FAILED", updatedAt: { $gte: deadLetterWindow } }),
  ]);

  const backlogScore = scoreFromBacklog(backlog, OUTBOX_BACKLOG_WARN, OUTBOX_BACKLOG_CRIT);
  const dlScore = scoreFromBacklog(deadLetters, DEAD_LETTER_WARN, DEAD_LETTER_CRIT);
  const score = Math.min(backlogScore, dlScore);

  return {
    score,
    status: statusFromScore(score),
    critical: true, // outbox is delivery-critical
    detail: { backlog, deadLetters, failed },
  };
}

async function checkPush(): Promise<ComponentHealth> {
  const now = new Date();
  const [pending, deadLetters] = await Promise.all([
    PushRetry.countDocuments({ status: "pending", nextAttemptAt: { $lte: now } }),
    PushRetry.countDocuments({ status: "dead_letter" }),
  ]);

  const backlogScore = scoreFromBacklog(pending, RETRY_BACKLOG_WARN, RETRY_BACKLOG_CRIT);
  const dlScore = scoreFromBacklog(deadLetters, DEAD_LETTER_WARN, DEAD_LETTER_CRIT);
  const score = Math.min(backlogScore, dlScore);

  return {
    score,
    status: statusFromScore(score),
    critical: false, // push has retry/DLQ backstops — important, not delivery-blocking
    detail: { retryBacklog: pending, deadLetters },
  };
}

async function checkReceipts(): Promise<ComponentHealth> {
  const now = new Date();
  const overdue = await PushReceipt.countDocuments({
    status: "pending",
    checkAfter: { $lte: now },
  });

  const score = scoreFromBacklog(overdue, RECEIPT_BACKLOG_WARN, RECEIPT_BACKLOG_CRIT);
  return {
    score,
    status: statusFromScore(score),
    critical: false, // receipts are observability — not delivery-blocking
    detail: { overdueReceipts: overdue },
  };
}

async function checkRedis(): Promise<ComponentHealth> {
  try {
    const start = Date.now();
    await redisClient.ping();
    const latencyMs = Date.now() - start;
    // Penalize high latency: 100 at <=10ms, scaling down past 200ms.
    const score = latencyMs <= 10 ? 100 : scoreFromBacklog(latencyMs, 10, 200);
    return { score, status: statusFromScore(score), critical: true, detail: { latencyMs } };
  } catch (err) {
    return {
      score: 0,
      status: "unhealthy",
      critical: true,
      detail: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Finds the timestamp of the most recent successfully-delivered notification
 * (any channel reached 'sent'+ in the audit trail). A growing gap here while
 * users are active is an early warning that delivery has silently stalled.
 */
async function getLastSuccessfulNotification(): Promise<{ at: Date | null; secondsAgo: number | null }> {
  try {
    const latest = await NotificationAudit.findOne({
      "channels.status": { $in: ["sent", "delivered"] },
    })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean();

    if (!latest?.createdAt) return { at: null, secondsAgo: null };
    const at = new Date(latest.createdAt);
    return { at, secondsAgo: Math.floor((Date.now() - at.getTime()) / 1000) };
  } catch {
    return { at: null, secondsAgo: null };
  }
}

/**
 * Applies hard-floor rules so a failing CRITICAL component can't hide behind a
 * healthy weighted average:
 *   - any critical component < 40 → unhealthy
 *   - any critical component < 70 → at least degraded
 * Otherwise the status follows the blended score.
 */
function resolveOverallStatus(blended: number, components: ComponentHealth[]): HealthStatus {
  const criticals = components.filter((c) => c.critical);
  if (criticals.some((c) => c.score < CRITICAL_UNHEALTHY_FLOOR)) return "unhealthy";

  let status = statusFromScore(blended);
  if (criticals.some((c) => c.score < CRITICAL_DEGRADED_FLOOR) && status === "healthy") {
    status = "degraded";
  }
  return status;
}

/**
 * Computes the full notification health model. Never throws — on internal
 * failure it returns a degraded report with the error captured.
 */
export async function getNotificationHealth(): Promise<NotificationHealth> {
  try {
    const [outbox, push, receipts, redis, lastSuccess] = await Promise.all([
      checkOutbox(),
      checkPush(),
      checkReceipts(),
      checkRedis(),
      getLastSuccessfulNotification(),
    ]);

    // Weighted overall: outbox + redis are most critical to delivery.
    const overall = Math.round(
      outbox.score * 0.35 +
        redis.score * 0.25 +
        push.score * 0.25 +
        receipts.score * 0.15
    );

    // Hard-floor rules override a misleadingly-high average.
    const status = resolveOverallStatus(overall, [outbox, push, receipts, redis]);

    return {
      overall,
      status,
      components: { outbox, push, receipts, redis },
      lastSuccessfulNotification: lastSuccess.at ? lastSuccess.at.toISOString() : null,
      secondsSinceLastSuccess: lastSuccess.secondsAgo,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error("[NotificationHealth] Failed to compute health", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      overall: 0,
      status: "unhealthy",
      components: {
        outbox: { score: 0, status: "unhealthy", critical: true, detail: { error: "compute failed" } },
        push: { score: 0, status: "unhealthy", critical: false, detail: {} },
        receipts: { score: 0, status: "unhealthy", critical: false, detail: {} },
        redis: { score: 0, status: "unhealthy", critical: true, detail: {} },
      },
      lastSuccessfulNotification: null,
      secondsSinceLastSuccess: null,
      generatedAt: new Date().toISOString(),
    };
  }
}

// Exports for testing
export {
  scoreFromBacklog as _scoreFromBacklog,
  statusFromScore as _statusFromScore,
  resolveOverallStatus as _resolveOverallStatus,
};

// ─── Health History (trends) ────────────────────────────────────────────────

import NotificationHealthSnapshot from "../../../models/NotificationHealthSnapshot";

export interface NotificationHealthHistory {
  windowHours: number;
  sampleCount: number;
  score: { avg: number | null; min: number | null; max: number | null };
  recoveriesRun: number;      // delta over the window
  escalations: number;        // delta over the window
  maxRecentDeadLetters: number;
  maxOutboxBacklog: number;
  currentSecondsSinceLastSuccess: number | null;
  firstSampleAt: string | null;
  lastSampleAt: string | null;
}

/**
 * Aggregates health snapshots over the last N hours into trend statistics.
 * recoveriesRun/escalations are deltas (last cumulative - first cumulative)
 * so they reflect activity within the window, not since process start.
 */
export async function getNotificationHealthHistory(windowHours = 24): Promise<NotificationHealthHistory> {
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const empty: NotificationHealthHistory = {
    windowHours,
    sampleCount: 0,
    score: { avg: null, min: null, max: null },
    recoveriesRun: 0,
    escalations: 0,
    maxRecentDeadLetters: 0,
    maxOutboxBacklog: 0,
    currentSecondsSinceLastSuccess: null,
    firstSampleAt: null,
    lastSampleAt: null,
  };

  try {
    const samples = await NotificationHealthSnapshot.find({ createdAt: { $gte: since } })
      .sort({ createdAt: 1 })
      .lean();

    if (samples.length === 0) return empty;

    const scores = samples.map((s) => s.overall);
    const first = samples[0];
    const last = samples[samples.length - 1];

    return {
      windowHours,
      sampleCount: samples.length,
      score: {
        avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        min: Math.min(...scores),
        max: Math.max(...scores),
      },
      // Deltas over the window (counters are cumulative since process start;
      // clamp at 0 in case the process restarted mid-window and reset them).
      recoveriesRun: Math.max(0, (last.recoveriesRun || 0) - (first.recoveriesRun || 0)),
      escalations: Math.max(0, (last.escalations || 0) - (first.escalations || 0)),
      maxRecentDeadLetters: Math.max(...samples.map((s) => s.recentDeadLetters || 0)),
      maxOutboxBacklog: Math.max(...samples.map((s) => s.outboxBacklog || 0)),
      currentSecondsSinceLastSuccess: last.secondsSinceLastSuccess ?? null,
      firstSampleAt: new Date(first.createdAt).toISOString(),
      lastSampleAt: new Date(last.createdAt).toISOString(),
    };
  } catch (err) {
    logger.error("[NotificationHealth] Failed to compute history", {
      error: err instanceof Error ? err.message : String(err),
    });
    return empty;
  }
}

// ─── Readiness ──────────────────────────────────────────────────────────────

import mongoose from "mongoose";

export interface NotificationReadiness {
  ready: boolean;
  reason: string | null;
  checks: {
    mongo: boolean;   // can persist outbox events / notifications
    redis: boolean;   // can dedup + serve unread counts
  };
  checkedAt: string;
}

/**
 * Readiness probe — answers "can this instance ACCEPT new notification work?"
 *
 * Distinct from health (which answers "is the subsystem behaving correctly right
 * now?"). Readiness is binary and dependency-oriented, suited to k8s readiness
 * probes / Railway health checks / blue-green cutover gates: if the instance
 * can't reach the stores it needs to enqueue work, it should be pulled from the
 * load balancer rather than accept-and-drop.
 *
 * Mongo is hard-required (outbox/notification writes). Redis being down is
 * tolerable for reads (Mongo fallback exists) but means dedup/cache are degraded,
 * so we report not-ready to be conservative for write-path correctness.
 */
export async function getNotificationReadiness(): Promise<NotificationReadiness> {
  const checks = { mongo: false, redis: false };

  // Mongo connection state (1 = connected).
  checks.mongo = mongoose.connection.readyState === 1;

  try {
    await redisClient.ping();
    checks.redis = true;
  } catch {
    checks.redis = false;
  }

  let ready = true;
  let reason: string | null = null;

  if (!checks.mongo) {
    ready = false;
    reason = "MongoDB unavailable — cannot persist outbox/notification writes";
  } else if (!checks.redis) {
    ready = false;
    reason = "Redis unavailable — dedup/unread-cache degraded";
  }

  return { ready, reason, checks, checkedAt: new Date().toISOString() };
}
