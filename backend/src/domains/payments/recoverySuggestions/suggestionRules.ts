import type { RecoverySuggestion, VerificationDiscrepancy } from "./types";

export const SUGGESTION_RULES: Record<VerificationDiscrepancy, Omit<RecoverySuggestion, "discrepancy">> = {
  WEBHOOK_MISSING: {
    recommendedAction: "MARK_VERIFYING",
    confidence: "HIGH",
    safe: true,
    canAutoExecute: false,
    reason: "Gateway captured but internal paid signal is missing (likely webhook delivery gap)",
    nextSteps: [
      "Use /internal/payments/verify to confirm captured payment details",
      "Mark intent as VERIFYING via manual recovery hooks",
      "Monitor for webhook processing before taking destructive actions",
    ],
  },
  AWAITING_CAPTURE: {
    recommendedAction: "WAIT_AND_RECHECK",
    confidence: "MEDIUM",
    safe: true,
    canAutoExecute: false,
    reason: "Gateway payment is authorized; capture may still be pending",
    nextSteps: [
      "Wait briefly and re-run verification",
      "If it stays authorized for an extended time, consider marking intent RECOVERABLE",
    ],
  },
  NO_GATEWAY_PAYMENT: {
    recommendedAction: "MARK_RECOVERABLE",
    confidence: "HIGH",
    safe: true,
    canAutoExecute: false,
    reason: "Internal order exists but no gateway payment was found",
    nextSteps: [
      "Mark intent as PAYMENT_RECOVERABLE to enable a safe retry/resume flow",
      "If repeated over long periods, consider locking to prevent churn",
    ],
  },
  GATEWAY_FAILED: {
    recommendedAction: "LOCK_PERMANENTLY",
    confidence: "HIGH",
    safe: true,
    canAutoExecute: false,
    reason: "Gateway confirms the payment failed",
    nextSteps: [
      "Lock the intent to stop automated retries or repeated attempts",
      "Communicate failure to Ops/Support for customer follow-up",
    ],
  },
  CONSISTENT_PAID: {
    recommendedAction: "NO_ACTION",
    confidence: "HIGH",
    safe: true,
    canAutoExecute: false,
    reason: "Internal and gateway states are consistent: paid",
    nextSteps: ["No action required"],
  },
};
