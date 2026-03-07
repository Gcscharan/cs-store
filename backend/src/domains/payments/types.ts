export type PaymentMethod = "RAZORPAY" | "COD";

// Canonical persisted payment state (high-level).
// This is intentionally simpler than PaymentIntentStatus (which includes gateway/UX stages).
export const PAYMENT_STATES = ["CREATED", "AUTHORIZED", "PAID", "FAILED"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_INTENT_STATUSES = [
  "CREATED",
  "GATEWAY_ORDER_CREATED",
  "PAYMENT_PROCESSING",
  "PAYMENT_RECOVERABLE",
  "PAYMENT_PENDING_EXTERNAL", // Provider unavailable - queued for retry
  "VERIFYING",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type PaymentIntentStatus = (typeof PAYMENT_INTENT_STATUSES)[number];

export const PAYMENT_GATEWAYS = ["RAZORPAY"] as const;
export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

export const LEDGER_EVENT_TYPES = ["AUTH", "CAPTURE", "FAIL", "REFUND"] as const;
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

export const WEBHOOK_INBOX_STATUSES = ["RECEIVED", "PROCESSED", "FAILED"] as const;
export type WebhookInboxStatus = (typeof WEBHOOK_INBOX_STATUSES)[number];

// Error types for provider unavailability
export const PROVIDER_UNAVAILABLE_ERRORS = [
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ESOCKETTIMEDOUT",
  "network error",
  "timeout",
  "socket hang up",
] as const;

export function isProviderUnavailableError(error: any): boolean {
  const code = String(error?.code || error?.errno || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  
  return PROVIDER_UNAVAILABLE_ERRORS.some(
    errType => code === errType.toUpperCase() || message.includes(errType.toLowerCase())
  );
}
