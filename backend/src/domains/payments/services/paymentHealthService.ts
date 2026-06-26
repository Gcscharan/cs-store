/**
 * Payment Health Service (intentionally small).
 *
 * Operational parity with the notification health endpoint. Answers:
 *   - Are webhook events backing up / failing?
 *   - Are there stuck PROCESSING refunds (gateway accepted, not finalized)?
 *   - Are there stuck non-terminal payment intents?
 *   - Is Mongo/Redis reachable (readiness)?
 *
 * Health = "is the payment subsystem behaving correctly right now?"
 * Readiness = "can this instance accept new payment work?"
 *
 * Critical components use hard-floor rules so a failing one can't hide behind a
 * healthy average (same approach as notifications). Time-windowed failure counts
 * so stale failures don't pin the score forever.
 */

import mongoose from "mongoose";
import { WebhookEventInbox } from "../models/WebhookEventInbox";
import { RefundRequest } from "../models/RefundRequest";
import { PaymentIntent } from "../models/PaymentIntent";
import redisClient from "../../../config/redis";
import { logger } from "../../../utils/logger";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface ComponentHealth {
  score: number;
  status: HealthStatus;
  critical: boolean;
  detail: Record<string, any>;
}

export interface PaymentHealth {
  overall: number;
  status: HealthStatus;
  components: {
    webhooks: ComponentHealth;
    refunds: ComponentHealth;
    intents: ComponentHealth;
    mongo: ComponentHealth;
  };
  generatedAt: string;
}

// ─── Thresholds ────────────────────────────────────────────────────────────────

const FAILED_WEBHOOK_WARN = 5;
const FAILED_WEBHOOK_CRIT = 50;
const STUCK_REFUND_WARN = 3;
const STUCK_REFUND_CRIT = 25;
const STUCK_INTENT_WARN = 25;
const STUCK_INTENT_CRIT = 250;

const FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;   // recent failures only
const STUCK_REFUND_AGE_MS = 30 * 60 * 1000;      // PROCESSING > 30 min = stuck
const STUCK_INTENT_AGE_MS = 60 * 60 * 1000;      // non-terminal > 1h = stuck

const CRITICAL_DEGRADED_FLOOR = 70;
const CRITICAL_UNHEALTHY_FLOOR = 40;

function statusFromScore(score: number): HealthStatus {
  if (score >= 90) return "healthy";
  if (score >= 70) return "degraded";
  return "unhealthy";
}

function scoreFromBacklog(value: number, warn: number, crit: number): number {
  if (value <= warn) return 100;
  if (value >= crit) return 0;
  return Math.round((1 - (value - warn) / (crit - warn)) * 100);
}

// ─── Component checks ────────────────────────────────────────────────────────

async function checkWebhooks(): Promise<ComponentHealth> {
  const since = new Date(Date.now() - FAILURE_WINDOW_MS);
  const [failed, backlog] = await Promise.all([
    WebhookEventInbox.countDocuments({ status: "FAILED", receivedAt: { $gte: since } }),
    // RECEIVED but never PROCESSED, older than 5 min = stuck in processing
    WebhookEventInbox.countDocuments({
      status: "RECEIVED",
      receivedAt: { $lte: new Date(Date.now() - 5 * 60_000) },
    }),
  ]);
  const score = Math.min(
    scoreFromBacklog(failed, FAILED_WEBHOOK_WARN, FAILED_WEBHOOK_CRIT),
    scoreFromBacklog(backlog, FAILED_WEBHOOK_WARN, FAILED_WEBHOOK_CRIT)
  );
  return { score, status: statusFromScore(score), critical: true, detail: { recentFailed: failed, stuckReceived: backlog } };
}

async function checkRefunds(): Promise<ComponentHealth> {
  const cutoff = new Date(Date.now() - STUCK_REFUND_AGE_MS);
  const stuck = await RefundRequest.countDocuments({ status: "PROCESSING", updatedAt: { $lte: cutoff } });
  const score = scoreFromBacklog(stuck, STUCK_REFUND_WARN, STUCK_REFUND_CRIT);
  // Critical: a stuck refund means a customer may not have been refunded.
  return { score, status: statusFromScore(score), critical: true, detail: { stuckProcessing: stuck } };
}

async function checkIntents(): Promise<ComponentHealth> {
  const cutoff = new Date(Date.now() - STUCK_INTENT_AGE_MS);
  const stuck = await PaymentIntent.countDocuments({
    status: { $in: ["GATEWAY_ORDER_CREATED", "PAYMENT_PROCESSING", "VERIFYING", "PAYMENT_RECOVERABLE"] },
    updatedAt: { $lte: cutoff },
  });
  const score = scoreFromBacklog(stuck, STUCK_INTENT_WARN, STUCK_INTENT_CRIT);
  // Non-critical: reconciliation resolves these; backlog is a warning signal.
  return { score, status: statusFromScore(score), critical: false, detail: { stuckNonTerminal: stuck } };
}

async function checkMongo(): Promise<ComponentHealth> {
  const connected = mongoose.connection.readyState === 1;
  return {
    score: connected ? 100 : 0,
    status: connected ? "healthy" : "unhealthy",
    critical: true,
    detail: { readyState: mongoose.connection.readyState },
  };
}

function resolveOverallStatus(blended: number, components: ComponentHealth[]): HealthStatus {
  const criticals = components.filter((c) => c.critical);
  if (criticals.some((c) => c.score < CRITICAL_UNHEALTHY_FLOOR)) return "unhealthy";
  let status = statusFromScore(blended);
  if (criticals.some((c) => c.score < CRITICAL_DEGRADED_FLOOR) && status === "healthy") status = "degraded";
  return status;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function getPaymentHealth(): Promise<PaymentHealth> {
  try {
    const [webhooks, refunds, intents, mongoC] = await Promise.all([
      checkWebhooks(),
      checkRefunds(),
      checkIntents(),
      checkMongo(),
    ]);

    const overall = Math.round(
      webhooks.score * 0.35 + refunds.score * 0.3 + mongoC.score * 0.25 + intents.score * 0.1
    );
    const status = resolveOverallStatus(overall, [webhooks, refunds, intents, mongoC]);

    return {
      overall,
      status,
      components: { webhooks, refunds, intents, mongo: mongoC },
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.error("[PaymentHealth] Failed to compute health", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      overall: 0,
      status: "unhealthy",
      components: {
        webhooks: { score: 0, status: "unhealthy", critical: true, detail: { error: "compute failed" } },
        refunds: { score: 0, status: "unhealthy", critical: true, detail: {} },
        intents: { score: 0, status: "unhealthy", critical: false, detail: {} },
        mongo: { score: 0, status: "unhealthy", critical: true, detail: {} },
      },
      generatedAt: new Date().toISOString(),
    };
  }
}

export interface PaymentReadiness {
  ready: boolean;
  reason: string | null;
  checks: { mongo: boolean; redis: boolean };
  checkedAt: string;
}

/**
 * Readiness — can this instance accept new payment work? Mongo is hard-required
 * (intents/orders/ledger writes). Redis backs idempotency/cache; treat down as
 * not-ready for write-path conservatism.
 */
export async function getPaymentReadiness(): Promise<PaymentReadiness> {
  const checks = { mongo: false, redis: false };
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
    reason = "MongoDB unavailable — cannot persist payment writes";
  } else if (!checks.redis) {
    ready = false;
    reason = "Redis unavailable — payment idempotency/cache degraded";
  }

  return { ready, reason, checks, checkedAt: new Date().toISOString() };
}

export {
  scoreFromBacklog as _scoreFromBacklog,
  statusFromScore as _statusFromScore,
  resolveOverallStatus as _resolveOverallStatus,
};
