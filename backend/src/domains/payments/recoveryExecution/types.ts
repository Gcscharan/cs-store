import type { PaymentIntentStatus } from "../types";

export type RecoveryExecuteAction = "MARK_VERIFYING" | "MARK_RECOVERABLE";

export type RecoveryExecuteRequest = {
  paymentIntentId: string;
  action: RecoveryExecuteAction;
  reason: string;
  adminUserId: string;
  adminEmail: string;
  featureFlagVersion: string;
};

export type RecoveryExecuteResult = {
  executed: true;
  paymentIntentId: string;
  orderId: string;
  previousStatus: PaymentIntentStatus;
  newStatus: PaymentIntentStatus;
  auditId: string;
};
