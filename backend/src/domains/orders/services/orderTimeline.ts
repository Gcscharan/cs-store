import { OrderStatus } from "../enums/OrderStatus";

export type OrderTimelineStepState = "completed" | "current" | "pending" | "failed";
export type OrderTimelineActor = "system" | "admin" | "delivery";

export type OrderTimelineStep = {
  key: string;
  label: string;
  description?: string;
  timestamp?: string;
  state: OrderTimelineStepState;
  actor?: OrderTimelineActor;
  eta?: {
    start: string;
    end: string;
    confidence?: "high" | "medium";
  };
};

const BASE_STEPS: Array<{ key: string; label: string; actor?: OrderTimelineActor }> = [
  { key: "ORDER_PLACED", label: "Order placed", actor: "system" },
  { key: "ORDER_CONFIRMED", label: "Order confirmed", actor: "admin" },
  { key: "ORDER_PACKED", label: "Packed and ready", actor: "admin" },
  { key: "ORDER_ASSIGNED", label: "Out for delivery", actor: "admin" },
  { key: "ORDER_PICKED_UP", label: "Picked up", actor: "delivery" },
  { key: "ORDER_IN_TRANSIT", label: "On the way", actor: "delivery" },
  { key: "ORDER_DELIVERED", label: "Delivered", actor: "delivery" },
];

const FAILURE_STEPS: Record<string, { label: string; actor?: OrderTimelineActor }> = {
  ORDER_CANCELLED: { label: "Cancelled" },
  ORDER_FAILED: { label: "Delivery failed", actor: "delivery" },
  ORDER_RETURNED: { label: "Returned", actor: "delivery" },
};

function parseDate(value: any): Date | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(d.getTime())) return undefined;
  return d;
}

function normalizeRawStatus(raw: any): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();
}

export function normalizeToTimelineKey(raw: any): string | null {
  const v = normalizeRawStatus(raw);
  if (!v) return null;

  if (v === "PENDING" || v === "PENDING_PAYMENT" || v === "PENDINGPAYMENT") return "ORDER_PLACED";
  if (v === "ORDER_PLACED" || v === "ORDER_CREATED" || v === "CREATED" || v === "ORDER_CREATED_V2") return "ORDER_PLACED";

  if (v === "CONFIRMED" || v === "ORDER_CONFIRMED") return "ORDER_CONFIRMED";
  if (v === "PACKED" || v === "ORDER_PACKED") return "ORDER_PACKED";
  if (v === "ASSIGNED" || v === "ORDER_ASSIGNED" || v === "DELIVERY_ASSIGNED") return "ORDER_ASSIGNED";
  if (v === "PICKED_UP" || v === "ORDER_PICKED_UP") return "ORDER_PICKED_UP";
  if (v === "IN_TRANSIT" || v === "ORDER_IN_TRANSIT") return "ORDER_IN_TRANSIT";
  if (v === "OUT_FOR_DELIVERY") return "ORDER_IN_TRANSIT";
  if (v === "DELIVERED" || v === "ORDER_DELIVERED") return "ORDER_DELIVERED";

  if (v === "CANCELLED" || v === "ORDER_CANCELLED") return "ORDER_CANCELLED";
  if (v === "FAILED" || v === "ORDER_FAILED") return "ORDER_FAILED";
  if (v === "RETURNED" || v === "ORDER_RETURNED") return "ORDER_RETURNED";

  if (v === OrderStatus.CREATED) return "ORDER_PLACED";
  if (v === OrderStatus.CONFIRMED) return "ORDER_CONFIRMED";
  if (v === OrderStatus.PACKED) return "ORDER_PACKED";
  if (v === OrderStatus.ASSIGNED) return "ORDER_ASSIGNED";
  if (v === OrderStatus.PICKED_UP) return "ORDER_PICKED_UP";
  if (v === OrderStatus.IN_TRANSIT) return "ORDER_IN_TRANSIT";
  if (v === OrderStatus.DELIVERED) return "ORDER_DELIVERED";
  if (v === OrderStatus.CANCELLED) return "ORDER_CANCELLED";
  if (v === OrderStatus.FAILED) return "ORDER_FAILED";
  if (v === OrderStatus.RETURNED) return "ORDER_RETURNED";

  return null;
}

function bestTimestampForStep(order: any, key: string): Date | undefined {
  const tsFieldMap: Record<string, string> = {
    ORDER_PLACED: "createdAt",
    ORDER_CONFIRMED: "confirmedAt",
    ORDER_PACKED: "packedAt",
    ORDER_PICKED_UP: "pickedUpAt",
    ORDER_IN_TRANSIT: "inTransitAt",
    ORDER_DELIVERED: "deliveredAt",
    ORDER_CANCELLED: "cancelledAt",
    ORDER_FAILED: "failedAt",
    ORDER_RETURNED: "returnedAt",
  };

  const directField = tsFieldMap[key];
  const direct = directField ? parseDate(order?.[directField]) : undefined;

  const history = Array.isArray(order?.history) ? order.history : [];
  const historyDates = history
    .map((h: any) => {
      const k = normalizeToTimelineKey(h?.to);
      if (k !== key) return null;
      const at = parseDate(h?.at);
      return at ? at : null;
    })
    .filter(Boolean) as Date[];

  const historyBest = historyDates.length
    ? new Date(Math.min(...historyDates.map((d) => d.getTime())))
    : undefined;

  if (direct && historyBest) {
    return direct.getTime() <= historyBest.getTime() ? direct : historyBest;
  }

  if (direct) return direct;
  if (historyBest) return historyBest;

  if (key === "ORDER_ASSIGNED") {
    const assignedFromHistory = history
      .map((h: any) => {
        const k = normalizeToTimelineKey(h?.to);
        if (k !== "ORDER_ASSIGNED") return null;
        const at = parseDate(h?.at);
        return at ? at : null;
      })
      .filter(Boolean) as Date[];

    if (assignedFromHistory.length) {
      return new Date(Math.min(...assignedFromHistory.map((d) => d.getTime())));
    }

    const assignmentHistory = Array.isArray(order?.assignmentHistory) ? order.assignmentHistory : [];
    const accepted = assignmentHistory
      .map((a: any) => parseDate(a?.acceptedAt))
      .filter(Boolean) as Date[];
    if (accepted.length) {
      return new Date(Math.min(...accepted.map((d) => d.getTime())));
    }

    const offered = assignmentHistory
      .map((a: any) => parseDate(a?.offeredAt))
      .filter(Boolean) as Date[];
    if (offered.length) {
      return new Date(Math.min(...offered.map((d) => d.getTime())));
    }
  }

  return undefined;
}

function failureDescription(order: any, failureKey: string): string | undefined {
  if (failureKey === "ORDER_CANCELLED") {
    const by = String(order?.cancelledBy || "").toLowerCase();
    const reason = String(order?.cancelReason || "").trim();
    const byText = by === "customer" ? "Cancelled by you" : by === "admin" ? "Cancelled by seller" : by ? "Cancelled" : "Cancelled";
    if (reason) return `${byText}: ${reason}`;
    return byText;
  }

  if (failureKey === "ORDER_FAILED") {
    const notes = String(order?.failureNotes || "").trim();
    const code = String(order?.failureReasonCode || "").trim();
    if (notes) return notes;
    if (code) return `Delivery failed: ${code}`;
    return "Delivery failed";
  }

  if (failureKey === "ORDER_RETURNED") {
    const reason = String(order?.returnReason || "").trim();
    return reason ? `Returned: ${reason}` : "Returned";
  }

  return undefined;
}

function actorForFailure(order: any, failureKey: string): OrderTimelineActor | undefined {
  if (failureKey === "ORDER_CANCELLED") {
    const by = String(order?.cancelledBy || "").toLowerCase();
    if (by === "admin") return "admin";
    return "system";
  }
  return FAILURE_STEPS[failureKey]?.actor;
}

export function buildOrderTimeline(order: any): OrderTimelineStep[] {
  const currentKey =
    normalizeToTimelineKey(order?.orderStatus) ||
    normalizeToTimelineKey(order?.deliveryStatus) ||
    "ORDER_PLACED";

  const isFailure = ["ORDER_CANCELLED", "ORDER_FAILED", "ORDER_RETURNED"].includes(currentKey);

  const baseWithTs = BASE_STEPS.map((s) => ({
    ...s,
    ts: bestTimestampForStep(order, s.key),
  }));

  if (isFailure) {
    const failureKey = currentKey;
    const failureTs = bestTimestampForStep(order, failureKey);

    const completedBase = baseWithTs
      .filter((s) => Boolean(s.ts))
      .filter((s) => (failureTs ? (s.ts as Date).getTime() <= failureTs.getTime() : true));

    const steps: OrderTimelineStep[] = completedBase.map((s) => ({
      key: s.key,
      label: s.label,
      timestamp: s.ts ? (s.ts as Date).toISOString() : undefined,
      state: "completed",
      actor: s.actor,
    }));

    steps.push({
      key: failureKey,
      label: FAILURE_STEPS[failureKey]?.label || "Update",
      description: failureDescription(order, failureKey),
      timestamp: failureTs ? failureTs.toISOString() : undefined,
      state: "failed",
      actor: actorForFailure(order, failureKey),
    });

    return steps;
  }

  const idx = BASE_STEPS.findIndex((s) => s.key === currentKey);
  const currentIndex = idx >= 0 ? idx : 0;

  return baseWithTs.map((s, i) => {
    const ts = s.ts;
    const state: OrderTimelineStepState = i < currentIndex ? "completed" : i === currentIndex ? "current" : "pending";

    const etaWindow =
      s.key === "ORDER_IN_TRANSIT" &&
      state === "current" &&
      order?.estimatedDeliveryWindow?.start &&
      order?.estimatedDeliveryWindow?.end
        ? {
            start: new Date(order.estimatedDeliveryWindow.start).toISOString(),
            end: new Date(order.estimatedDeliveryWindow.end).toISOString(),
            confidence: order?.estimatedDeliveryWindow?.confidence,
          }
        : undefined;

    return {
      key: s.key,
      label: s.label,
      timestamp: state === "pending" ? undefined : ts ? ts.toISOString() : undefined,
      state,
      actor: s.actor,
      eta: etaWindow,
    };
  });
}
