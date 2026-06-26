/**
 * Pure, testable helpers for fanning rider GPS out to customer order rooms.
 *
 * These were extracted from the inline socket fan-out in index.ts because that
 * logic carried real production bugs (singular `orderId` vs the stored plural
 * `orderIds`, and an event/payload shape that did not match what the customer
 * app consumes). Keeping it pure lets us prove the contract with unit tests.
 *
 * Customer contract (apps/customer-app socketClient.ts):
 *   event:   "delivery_location_updated"
 *   payload: { orderId, latitude, longitude, heading?, speed?, ... }
 */

export const TERMINAL_ORDER_STATUSES = [
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
  "RETURNED",
];

export const CUSTOMER_LOCATION_EVENT = "delivery_location_updated";

export interface RiderLocationEvent {
  driverId?: string;
  orderIds?: unknown;
  orderId?: unknown;
  lat?: unknown;
  lng?: unknown;
  heading?: unknown;
  speed?: unknown;
  accuracy?: unknown;
  receivedAt?: unknown;
}

export interface CustomerLocationPayload {
  orderId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  etaMinutes?: number;
  distanceRemainingM?: number;
  lastUpdated: string;
}

/**
 * Normalize a rider location event's target order ids. Accepts the canonical
 * plural `orderIds`, falls back to a singular `orderId`, and always returns a
 * de-duplicated array of non-empty string ids.
 */
export function normalizeOrderIds(loc: RiderLocationEvent | null | undefined): string[] {
  if (!loc) return [];
  const raw = Array.isArray(loc.orderIds)
    ? loc.orderIds
    : loc.orderId != null
    ? [loc.orderId]
    : [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const s = String(x ?? "").trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** An order is trackable (customer should receive live location) unless terminal. */
export function isTrackableStatus(status: unknown): boolean {
  const s = String(status ?? "").toUpperCase();
  if (!s) return false;
  return !TERMINAL_ORDER_STATUSES.includes(s);
}

/** Round to ~111m for customer-facing privacy. */
export function roundCoordinate(n: unknown): number {
  return Math.round(Number(n) * 1000) / 1000;
}

/**
 * Build the exact payload the customer app consumes for a single order. ETA
 * fields are optional and supplied by the caller (ETA calc is async/IO).
 */
export function buildCustomerLocationPayload(
  loc: RiderLocationEvent,
  orderId: string,
  eta?: { etaMinutes?: number; distanceRemainingM?: number }
): CustomerLocationPayload {
  const headingNum = Number(loc.heading);
  const speedNum = Number(loc.speed);
  return {
    orderId,
    latitude: roundCoordinate(loc.lat),
    longitude: roundCoordinate(loc.lng),
    heading: Number.isFinite(headingNum) ? headingNum : undefined,
    speed: Number.isFinite(speedNum) ? speedNum : undefined,
    etaMinutes: eta?.etaMinutes,
    distanceRemainingM: eta?.distanceRemainingM,
    lastUpdated: new Date(Number(loc.receivedAt) || Date.now()).toISOString(),
  };
}

export function customerRoom(orderId: string): string {
  return `order:${orderId}`;
}
