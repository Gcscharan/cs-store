export type PaymentGateway = "RAZORPAY";

export type PaymentIntentStatus =
  | "CREATED"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export type PaymentsReconciliationItem = {
  paymentIntentId: string;
  orderId: string;
  orderPaymentStatus?: string;
  gateway: PaymentGateway;
  status: PaymentIntentStatus | string;
  isLocked: boolean;
  lockReason?: string;
  createdAt: string;
  updatedAt: string;
  ageMinutes: number;
  lastScannedAt?: string;
};

export type PaymentVerificationResponse = {
  source: "RAZORPAY";
  verifiedAt: string;
  internal?: {
    paymentIntentId: string;
    orderId: string;
    status: string;
    isLocked: boolean;
  };
  gateway: {
    order?: {
      id: string;
      status: string;
      amount: number;
      currency: string;
    };
    payment?: {
      id: string;
      status: string;
      method: string;
    };
    refunds: Array<{ id: string; amount: number; status: string }>;
  };
  assessment: {
    isPaidAtGateway: boolean;
    isPaidInternally: boolean;
    discrepancy:
      | "WEBHOOK_MISSING"
      | "AWAITING_CAPTURE"
      | "NO_GATEWAY_PAYMENT"
      | "GATEWAY_FAILED"
      | "CONSISTENT_PAID";
  };
};

export type RecoverySuggestionResponse = {
  orderId: string;
  paymentIntentId: string;
  discrepancy:
    | "WEBHOOK_MISSING"
    | "AWAITING_CAPTURE"
    | "NO_GATEWAY_PAYMENT"
    | "GATEWAY_FAILED"
    | "CONSISTENT_PAID";
  suggestion: {
    discrepancy:
      | "WEBHOOK_MISSING"
      | "AWAITING_CAPTURE"
      | "NO_GATEWAY_PAYMENT"
      | "GATEWAY_FAILED"
      | "CONSISTENT_PAID";
    recommendedAction:
      | "MARK_VERIFYING"
      | "MARK_RECOVERABLE"
      | "LOCK_PERMANENTLY"
      | "WAIT_AND_RECHECK"
      | "NO_ACTION";
    confidence: "HIGH" | "MEDIUM" | "LOW";
    safe: true;
    canAutoExecute: boolean;
    reason: string;
    nextSteps: string[];
  };
};

export type PaymentsRecoveryRowEnrichment = {
  verification?: PaymentVerificationResponse;
  suggestion?: RecoverySuggestionResponse;
};

export type RecoveryExecuteAction = "MARK_VERIFYING" | "MARK_RECOVERABLE";

export type RecoveryExecuteRequest = {
  action: RecoveryExecuteAction;
  reason: string;
  confirm: "YES_I_UNDERSTAND_THIS_CHANGES_STATE";
};

export type RecoveryExecuteResponse = {
  executed: true;
  previousStatus: string;
  newStatus: string;
  auditId: string;
};
