export type VerificationDiscrepancy =
  | "WEBHOOK_MISSING"
  | "AWAITING_CAPTURE"
  | "NO_GATEWAY_PAYMENT"
  | "GATEWAY_FAILED"
  | "CONSISTENT_PAID";

export type RecoveryRecommendedAction =
  | "MARK_VERIFYING"
  | "MARK_RECOVERABLE"
  | "LOCK_PERMANENTLY"
  | "WAIT_AND_RECHECK"
  | "NO_ACTION";

export type RecoverySuggestion = {
  discrepancy: VerificationDiscrepancy;
  recommendedAction: RecoveryRecommendedAction;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  safe: true;
  canAutoExecute: boolean;
  reason: string;
  nextSteps: string[];
};
