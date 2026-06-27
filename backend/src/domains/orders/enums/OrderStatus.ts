export enum OrderStatus {
  CREATED = "CREATED",
  CONFIRMED = "CONFIRMED",
  PACKED = "PACKED",
  ASSIGNED = "ASSIGNED",
  PICKED_UP = "PICKED_UP",
  IN_TRANSIT = "IN_TRANSIT",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  // Delivery sub-state: rider has arrived at the customer location. Persisted on
  // the Order model and used by the delivery UI (computeAllowedActions) to gate
  // the COD/OTP/verify phase. The authoritative orderStatus transition to
  // DELIVERED/FAILED is still permitted from IN_TRANSIT for backward compat.
  ARRIVED = "ARRIVED",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  RETURNED = "RETURNED",
  CANCELLED = "CANCELLED",
}
