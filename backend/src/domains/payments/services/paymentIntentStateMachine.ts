import { PaymentIntentStatus } from "../types";

const ALLOWED: Record<PaymentIntentStatus, PaymentIntentStatus[]> = {
  CREATED: ["GATEWAY_ORDER_CREATED", "PAYMENT_RECOVERABLE", "FAILED", "CANCELLED", "EXPIRED"],
  GATEWAY_ORDER_CREATED: ["PAYMENT_PROCESSING", "PAYMENT_RECOVERABLE", "CAPTURED", "FAILED", "CANCELLED", "EXPIRED"],
  PAYMENT_PROCESSING: ["VERIFYING", "CAPTURED", "FAILED", "CANCELLED", "EXPIRED"],
  PAYMENT_RECOVERABLE: ["VERIFYING", "PAYMENT_PROCESSING", "CAPTURED", "FAILED", "CANCELLED", "EXPIRED"],
  VERIFYING: ["CAPTURED", "FAILED", "CANCELLED", "EXPIRED"],
  CAPTURED: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function isAllowedTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): boolean {
  return (ALLOWED[from] || []).includes(to);
}

export function assertAllowedTransition(from: PaymentIntentStatus, to: PaymentIntentStatus): void {
  if (!isAllowedTransition(from, to)) {
    throw new Error(`Forbidden PaymentIntent transition: ${from} -> ${to}`);
  }
}
