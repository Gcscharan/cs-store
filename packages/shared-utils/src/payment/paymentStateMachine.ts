/**
 * Payment State Machine
 * 
 * Shared utility for managing payment state transitions.
 * Used by both web and mobile apps.
 */

// ============================================================================
// Types
// ============================================================================

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "CANCELLED";

export type PaymentMethod = "UPI" | "CARD" | "COD" | "WALLET" | "NETBANKING";

export type PaymentEvent =
  | "INITIATE"
  | "CONFIRM"
  | "FAIL"
  | "CANCEL"
  | "REFUND"
  | "PARTIAL_REFUND";

export interface PaymentState {
  status: PaymentStatus;
  method?: PaymentMethod;
  transactionId?: string;
  amount: number;
  refundedAmount?: number;
  failureReason?: string;
  timestamp: string;
}

export interface PaymentTransition {
  from: PaymentStatus;
  to: PaymentStatus;
  event: PaymentEvent;
  allowed: boolean;
}

// ============================================================================
// State Machine Configuration
// ============================================================================

/**
 * Valid state transitions for payment
 */
export const PAYMENT_TRANSITIONS: PaymentTransition[] = [
  // From PENDING
  { from: "PENDING", to: "PROCESSING", event: "INITIATE", allowed: true },
  { from: "PENDING", to: "CANCELLED", event: "CANCEL", allowed: true },

  // From PROCESSING
  { from: "PROCESSING", to: "PAID", event: "CONFIRM", allowed: true },
  { from: "PROCESSING", to: "FAILED", event: "FAIL", allowed: true },
  { from: "PROCESSING", to: "CANCELLED", event: "CANCEL", allowed: true },

  // From PAID
  { from: "PAID", to: "REFUNDED", event: "REFUND", allowed: true },
  { from: "PAID", to: "PARTIALLY_REFUNDED", event: "PARTIAL_REFUND", allowed: true },

  // From PARTIALLY_REFUNDED
  { from: "PARTIALLY_REFUNDED", to: "REFUNDED", event: "REFUND", allowed: true },
  { from: "PARTIALLY_REFUNDED", to: "PARTIALLY_REFUNDED", event: "PARTIAL_REFUND", allowed: true },

  // Terminal states (no transitions)
  { from: "FAILED", to: "PENDING", event: "INITIATE", allowed: true }, // Retry allowed
  { from: "CANCELLED", to: "PENDING", event: "INITIATE", allowed: true }, // Retry allowed
];

/**
 * Terminal states (no further transitions except retry)
 */
export const TERMINAL_STATES: PaymentStatus[] = ["REFUNDED", "FAILED", "CANCELLED"];

/**
 * Success states
 */
export const SUCCESS_STATES: PaymentStatus[] = ["PAID", "PARTIALLY_REFUNDED"];

/**
 * Refundable states
 */
export const REFUNDABLE_STATES: PaymentStatus[] = ["PAID", "PARTIALLY_REFUNDED"];

// ============================================================================
// State Machine Functions
// ============================================================================

/**
 * Check if a transition is valid
 * @param currentStatus - Current payment status
 * @param event - Event to apply
 * @returns True if transition is allowed
 */
export function canTransition(currentStatus: PaymentStatus, event: PaymentEvent): boolean {
  const transition = PAYMENT_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.event === event
  );
  return transition?.allowed ?? false;
}

/**
 * Get the next status after an event
 * @param currentStatus - Current payment status
 * @param event - Event to apply
 * @returns New status or null if invalid transition
 */
export function getNextStatus(
  currentStatus: PaymentStatus,
  event: PaymentEvent
): PaymentStatus | null {
  const transition = PAYMENT_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.event === event && t.allowed
  );
  return transition?.to ?? null;
}

/**
 * Check if payment is in a terminal state
 * @param status - Payment status
 * @returns True if terminal
 */
export function isTerminalState(status: PaymentStatus): boolean {
  return TERMINAL_STATES.includes(status);
}

/**
 * Check if payment is successful
 * @param status - Payment status
 * @returns True if successful
 */
export function isSuccessfulPayment(status: PaymentStatus): boolean {
  return SUCCESS_STATES.includes(status);
}

/**
 * Check if payment can be refunded
 * @param status - Payment status
 * @returns True if refundable
 */
export function canRefund(status: PaymentStatus): boolean {
  return REFUNDABLE_STATES.includes(status);
}

/**
 * Check if payment is pending
 * @param status - Payment status
 * @returns True if pending or processing
 */
export function isPending(status: PaymentStatus): boolean {
  return status === "PENDING" || status === "PROCESSING";
}

/**
 * Get valid events for a status
 * @param status - Current payment status
 * @returns Array of valid events
 */
export function getValidEvents(status: PaymentStatus): PaymentEvent[] {
  return PAYMENT_TRANSITIONS
    .filter((t) => t.from === status && t.allowed)
    .map((t) => t.event);
}

/**
 * Create initial payment state
 * @param amount - Payment amount
 * @param method - Payment method
 * @returns Initial payment state
 */
export function createInitialPaymentState(
  amount: number,
  method?: PaymentMethod
): PaymentState {
  return {
    status: "PENDING",
    method,
    amount,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Apply an event to a payment state
 * @param state - Current payment state
 * @param event - Event to apply
 * @param data - Additional data for the transition
 * @returns New payment state or null if invalid
 */
export function applyPaymentEvent(
  state: PaymentState,
  event: PaymentEvent,
  data?: {
    transactionId?: string;
    failureReason?: string;
    refundedAmount?: number;
  }
): PaymentState | null {
  const newStatus = getNextStatus(state.status, event);
  
  if (!newStatus) {
    return null;
  }

  return {
    ...state,
    status: newStatus,
    transactionId: data?.transactionId ?? state.transactionId,
    failureReason: data?.failureReason,
    refundedAmount: data?.refundedAmount ?? state.refundedAmount,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get payment status display text
 * @param status - Payment status
 * @returns Human-readable status
 */
export function getPaymentStatusText(status: PaymentStatus): string {
  const statusText: Record<PaymentStatus, string> = {
    PENDING: "Pending",
    PROCESSING: "Processing",
    PAID: "Paid",
    FAILED: "Failed",
    REFUNDED: "Refunded",
    PARTIALLY_REFUNDED: "Partially Refunded",
    CANCELLED: "Cancelled",
  };
  return statusText[status];
}

/**
 * Get payment status color for UI
 * @param status - Payment status
 * @returns Color code
 */
export function getPaymentStatusColor(status: PaymentStatus): string {
  const colors: Record<PaymentStatus, string> = {
    PENDING: "#FFA500", // Orange
    PROCESSING: "#007AFF", // Blue
    PAID: "#34C759", // Green
    FAILED: "#FF3B30", // Red
    REFUNDED: "#8E8E93", // Gray
    PARTIALLY_REFUNDED: "#FF9500", // Orange
    CANCELLED: "#8E8E93", // Gray
  };
  return colors[status];
}
