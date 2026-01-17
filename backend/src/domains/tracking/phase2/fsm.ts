import { haversineMeters } from "../services/trackingValidation";

export type InternalSemanticState =
  | "AT_PICKUP"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "NEAR_DESTINATION"
  | "DELIVERED_CANDIDATE";

export type CustomerCheckpointState = "PICKED_UP" | "ON_THE_WAY" | "NEARBY" | "DELIVERED";

export type StateTransition = {
  from: InternalSemanticState | null;
  to: InternalSemanticState;
  reason: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeOrderLifecycle(v: string | undefined | null): string {
  return String(v || "").toLowerCase();
}

function isDeliveredByLifecycle(orderStatus?: string | null, deliveryStatus?: string | null): boolean {
  const o = normalizeOrderLifecycle(orderStatus);
  const d = normalizeOrderLifecycle(deliveryStatus);
  return o === "delivered" || o === "delivered" || d === "delivered";
}

function hasPickedUpByLifecycle(orderStatus?: string | null, deliveryStatus?: string | null): boolean {
  const o = normalizeOrderLifecycle(orderStatus);
  const d = normalizeOrderLifecycle(deliveryStatus);
  return o === "picked_up" || o === "in_transit" || o === "out_for_delivery" || d === "picked_up" || d === "in_transit" || d === "arrived" || d === "delivered";
}

function mapToCustomerCheckpoint(internal: InternalSemanticState): CustomerCheckpointState {
  switch (internal) {
    case "DELIVERED_CANDIDATE":
      return "DELIVERED";
    case "NEAR_DESTINATION":
      return "NEARBY";
    case "IN_TRANSIT":
      return "ON_THE_WAY";
    case "PICKED_UP":
      return "PICKED_UP";
    case "AT_PICKUP":
    default:
      return "ON_THE_WAY";
  }
}

function enforceOneWayProgression(prev: CustomerCheckpointState | null, next: CustomerCheckpointState): CustomerCheckpointState {
  if (!prev) return next;
  const order: CustomerCheckpointState[] = ["PICKED_UP", "ON_THE_WAY", "NEARBY", "DELIVERED"];
  const pi = order.indexOf(prev);
  const ni = order.indexOf(next);
  return ni >= pi ? next : prev;
}

export function deriveSemanticState(params: {
  prevInternalState?: InternalSemanticState | null;
  prevCheckpointState?: CustomerCheckpointState | null;
  lastUpdatedAt?: string | null;
  movementState: "MOVING" | "STATIONARY" | "UNKNOWN";
  nowIso: string;
  smoothedLat: number;
  smoothedLng: number;
  destination?: { lat: number; lng: number };
  orderStatus?: string | null;
  deliveryStatus?: string | null;
  config?: {
    nearDestinationRadiusM?: number;
    deliveredCandidateRadiusM?: number;
    deliveredCandidateDwellSeconds?: number;
  };
}): {
  internalState: InternalSemanticState;
  checkpointState: CustomerCheckpointState;
  transition?: StateTransition;
  nearDestination: boolean;
} {
  const nearDestinationRadiusM = clamp(Number(params.config?.nearDestinationRadiusM ?? 200), 25, 5000);
  const deliveredCandidateRadiusM = clamp(Number(params.config?.deliveredCandidateRadiusM ?? 60), 10, nearDestinationRadiusM);
  const deliveredCandidateDwellSeconds = clamp(Number(params.config?.deliveredCandidateDwellSeconds ?? 45), 5, 30 * 60);

  const prevInternal = params.prevInternalState ?? null;

  const deliveredByLifecycle = isDeliveredByLifecycle(params.orderStatus, params.deliveryStatus);
  if (deliveredByLifecycle) {
    const internalState: InternalSemanticState = "DELIVERED_CANDIDATE";
    const checkpointState = enforceOneWayProgression(params.prevCheckpointState ?? null, mapToCustomerCheckpoint(internalState));
    const transition = prevInternal !== internalState ? { from: prevInternal, to: internalState, reason: "order_lifecycle" } : undefined;
    return { internalState, checkpointState, transition, nearDestination: true };
  }

  const pickedUpByLifecycle = hasPickedUpByLifecycle(params.orderStatus, params.deliveryStatus);

  let nearDestination = false;
  let distToDestM: number | null = null;
  if (params.destination && Number.isFinite(params.destination.lat) && Number.isFinite(params.destination.lng)) {
    distToDestM = haversineMeters(
      { lat: params.smoothedLat, lng: params.smoothedLng },
      { lat: params.destination.lat, lng: params.destination.lng }
    );
    nearDestination = Number.isFinite(distToDestM) ? distToDestM <= nearDestinationRadiusM : false;
  }

  // Delivered candidate is a strong signal only when near destination, stationary, and dwell time exceeded.
  let deliveredCandidate = false;
  if (distToDestM !== null && distToDestM <= deliveredCandidateRadiusM && params.movementState !== "MOVING") {
    const prevAt = params.lastUpdatedAt ? new Date(params.lastUpdatedAt) : null;
    const now = new Date(params.nowIso);
    const age = prevAt && Number.isFinite(prevAt.getTime()) ? (now.getTime() - prevAt.getTime()) / 1000 : 0;
    deliveredCandidate = age >= deliveredCandidateDwellSeconds;
  }

  let internalState: InternalSemanticState;

  if (deliveredCandidate) {
    internalState = "DELIVERED_CANDIDATE";
  } else if (nearDestination) {
    internalState = "NEAR_DESTINATION";
  } else if (pickedUpByLifecycle) {
    internalState = "IN_TRANSIT";
  } else {
    // We do not have pickup geofence coordinates in the current model.
    // Keep a conservative default that doesn't leak internal ops state.
    internalState = "AT_PICKUP";
  }

  const checkpoint = mapToCustomerCheckpoint(internalState);
  const checkpointState = enforceOneWayProgression(params.prevCheckpointState ?? null, checkpoint);

  const transition = prevInternal !== internalState ? { from: prevInternal, to: internalState, reason: "derived" } : undefined;

  return { internalState, checkpointState, transition, nearDestination };
}
