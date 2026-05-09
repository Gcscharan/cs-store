/**
 * allowedActions — single source of truth for delivery UI state
 *
 * Backend computes what actions are allowed for a given order.
 * Frontend renders ONLY based on this list — no hardcoded status checks.
 *
 * IMPORTANT — delivery_attempt is an event, not a state:
 *   SEND_OTP and VERIFY_OTP do NOT change orderStatus.
 *   Only VERIFY_OTP (success) → DELIVERED and /attempt FAILED → FAILED are
 *   actual orderStatus state transitions. All other OTP-phase actions are
 *   transient events recorded in the DeliveryAttempt collection.
 *
 * Actions:
 *   PICKUP                 → Mark as Picked Up
 *   START_DELIVERY         → Start Delivery (go in transit)
 *   MARK_ARRIVED           → Mark as Arrived at customer location
 *   COLLECT_COD            → Collect Cash / UPI (COD only, before OTP)
 *   SEND_OTP               → Send OTP to customer (start delivery attempt)
 *   VERIFY_OTP             → Enter OTP + Complete Delivery
 *   RECORD_ATTEMPT         → Record a delivery attempt result
 *   CUSTOMER_NOT_AVAILABLE → Record failed attempt (customer not reachable)
 *   NAVIGATE               → Open navigation to order address
 *
 * Fix 1 — ARRIVED is the single source of truth:
 *   arrivedAt is metadata only. It is NEVER used as a branching condition
 *   inside computeAllowedActions. Status drives all branching.
 *
 * Fix 2 — delivery_attempt is an event, not a state (see above).
 *
 * Fix 3 — NAVIGATE requires both order coords AND rider location.
 */

export type DeliveryAction =
  | "PICKUP"
  | "START_DELIVERY"
  | "MARK_ARRIVED"
  | "COLLECT_COD"
  | "SEND_OTP"
  | "VERIFY_OTP"
  | "RECORD_ATTEMPT"
  | "CUSTOMER_NOT_AVAILABLE"
  | "NAVIGATE";

export interface ComputeAllowedActionsOptions {
  codCollected: boolean;
  isNext: boolean;
  riderHasLocation: boolean;
}

/**
 * Compute the list of actions a delivery partner may perform on an order.
 *
 * This is a pure synchronous function — all required state (codCollected,
 * isNext, riderHasLocation) must be pre-fetched by the caller.
 *
 * @param order   - The order document (any shape; relevant fields accessed safely)
 * @param options - Pre-fetched delivery context flags
 * @returns       - Array of permitted DeliveryAction keys
 */
export function computeAllowedActions(
  order: any,
  options: ComputeAllowedActionsOptions
): DeliveryAction[] {
  const { codCollected, riderHasLocation } = options;
  // Default isNext to true so solo deliveries (no route context) are never blocked
  const isNext = options.isNext !== false;

  const status = String(order.orderStatus || "").toUpperCase();
  const deliveryStatus = String(order.deliveryStatus || "").toLowerCase();
  const isCod = String(order.paymentMethod || "").toLowerCase() === "cod";
  const otpSentAt = !!order.deliveryOtpGeneratedAt;

  // Helper: include NAVIGATE only when order has coords AND rider has location
  const canNavigate =
    !!order.address?.lat && !!order.address?.lng && riderHasLocation === true;

  // Terminal states — no actions
  if (["DELIVERED", "FAILED", "CANCELLED", "RETURNED"].includes(status)) {
    return [];
  }

  // ASSIGNED — only actionable if deliveryStatus is not "unassigned"
  if (status === "ASSIGNED") {
    if (deliveryStatus === "unassigned") return [];
    const actions: DeliveryAction[] = ["PICKUP"];
    if (canNavigate) actions.push("NAVIGATE");
    return actions;
  }

  // PICKED_UP → rider needs to start the delivery leg
  if (status === "PICKED_UP") {
    const actions: DeliveryAction[] = ["START_DELIVERY"];
    if (canNavigate) actions.push("NAVIGATE");
    return actions;
  }

  // IN_TRANSIT → rider is en route; next step is to mark arrival
  // arrivedAt is NOT checked here — status is the single source of truth
  if (status === "IN_TRANSIT") {
    const actions: DeliveryAction[] = [];
    // Only the isNext order may advance to MARK_ARRIVED
    if (isNext) actions.push("MARK_ARRIVED");
    if (canNavigate) actions.push("NAVIGATE");
    return actions;
  }

  // ARRIVED → OTP / COD phase
  if (status === "ARRIVED") {
    // COD gate: must collect payment before OTP
    if (isCod && !codCollected) {
      return ["COLLECT_COD"];
    }

    // Non-COD or COD already collected
    if (!otpSentAt) {
      // OTP not yet sent — rider initiates the attempt
      return ["SEND_OTP", "CUSTOMER_NOT_AVAILABLE"];
    }

    // OTP already sent — rider must verify it (or mark customer unavailable)
    const actions: DeliveryAction[] = [];
    // Only the isNext order may advance to VERIFY_OTP
    if (isNext) actions.push("VERIFY_OTP");
    actions.push("CUSTOMER_NOT_AVAILABLE");
    return actions;
  }

  // Unknown / unhandled status — no actions
  return [];
}
