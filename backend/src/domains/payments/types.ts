export type PaymentMethod = "RAZORPAY" | "COD";

export const PAYMENT_INTENT_STATUSES = [
  "CREATED",
  "GATEWAY_ORDER_CREATED",
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
