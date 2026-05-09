/**
 * Canonical failure reasons — shared across backend and frontend.
 * Any reason not in this list is rejected at the API boundary.
 */
export const FAILURE_REASONS = [
  "CUSTOMER_NOT_AVAILABLE",
  "ADDRESS_ISSUE",
  "CUSTOMER_REJECTED",
] as const;

export type FailureReason = typeof FAILURE_REASONS[number];

export function isValidFailureReason(value: string): value is FailureReason {
  return FAILURE_REASONS.includes(value as FailureReason);
}
