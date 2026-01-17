export type BackendTimelineStep = {
  key?: string;
  label?: string;
  description?: string;
  timestamp?: string;
  state?: "completed" | "current" | "pending" | "failed";
  eta?: {
    start: string;
    end: string;
    confidence?: "high" | "medium";
  };
};

export type CustomerTimelineStepState = "completed" | "current" | "pending" | "failed";

export type CustomerTimelineStep = {
  key: string;
  label: string;
  description?: string;
  timestamp?: string;
  state: CustomerTimelineStepState;
  eta?: {
    start: string;
    end: string;
    confidence?: "high" | "medium";
  };
};

type CustomerMilestone = "ORDER_PLACED" | "ORDER_CONFIRMED" | "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED";

type TerminalMilestone = "CANCELLED" | "FAILED";

const CUSTOMER_MILESTONES: Array<{ id: CustomerMilestone; key: string; label: string }> = [
  { id: "ORDER_PLACED", key: "CUSTOMER_ORDER_PLACED", label: "Order placed" },
  { id: "ORDER_CONFIRMED", key: "CUSTOMER_ORDER_CONFIRMED", label: "Order confirmed" },
  { id: "SHIPPED", key: "CUSTOMER_SHIPPED", label: "Shipped" },
  { id: "OUT_FOR_DELIVERY", key: "CUSTOMER_OUT_FOR_DELIVERY", label: "Out for delivery" },
  { id: "DELIVERED", key: "CUSTOMER_DELIVERED", label: "Delivered" },
];

function normalizeKey(raw: unknown): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();
}

function mapBackendKeyToCustomerMilestone(rawKey: unknown): CustomerMilestone | null {
  const k = normalizeKey(rawKey);
  if (!k) return null;

  if (k === "ORDER_PLACED") return "ORDER_PLACED";
  if (k === "ORDER_CONFIRMED") return "ORDER_CONFIRMED";

  // Collapse internal warehouse/logistics states into one customer step.
  if (k === "ORDER_PACKED" || k === "ORDER_ASSIGNED" || k === "ORDER_PICKED_UP") {
    return "SHIPPED";
  }

  if (k === "ORDER_IN_TRANSIT") return "OUT_FOR_DELIVERY";
  if (k === "ORDER_DELIVERED") return "DELIVERED";

  return null;
}

function mapBackendKeyToTerminalMilestone(rawKey: unknown): TerminalMilestone | null {
  const k = normalizeKey(rawKey);
  if (k === "ORDER_CANCELLED") return "CANCELLED";
  if (k === "ORDER_FAILED") return "FAILED";
  if (k === "ORDER_RETURNED") return "FAILED";
  return null;
}

function earliestIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  const da = new Date(a);
  const db = new Date(b);
  if (!Number.isFinite(da.getTime())) return b;
  if (!Number.isFinite(db.getTime())) return a;
  return da.getTime() <= db.getTime() ? a : b;
}

export function buildCustomerOrderTimeline(rawBackendSteps: unknown): CustomerTimelineStep[] {
  const backendSteps: BackendTimelineStep[] = Array.isArray(rawBackendSteps)
    ? (rawBackendSteps as BackendTimelineStep[])
    : [];

  const terminalBackendStep = backendSteps.find((s) => {
    const terminal = mapBackendKeyToTerminalMilestone(s?.key);
    return Boolean(terminal) || s?.state === "failed";
  });

  const terminalMilestone = terminalBackendStep
    ? mapBackendKeyToTerminalMilestone(terminalBackendStep?.key) || "FAILED"
    : null;

  // Terminal state: show completed milestones that occurred + a single terminal step.
  if (terminalBackendStep && terminalMilestone) {
    const occurred: Partial<Record<CustomerMilestone, CustomerTimelineStep>> = {};

    for (const s of backendSteps) {
      if (s?.state === "pending") continue;
      const m = mapBackendKeyToCustomerMilestone(s?.key);
      if (!m) continue;

      const existing = occurred[m];
      const ts = earliestIso(existing?.timestamp, s?.timestamp);
      occurred[m] = {
        key: CUSTOMER_MILESTONES.find((x) => x.id === m)!.key,
        label: CUSTOMER_MILESTONES.find((x) => x.id === m)!.label,
        timestamp: ts,
        state: "completed",
      };
    }

    const steps: CustomerTimelineStep[] = [];
    for (const milestone of CUSTOMER_MILESTONES) {
      const step = occurred[milestone.id];
      if (step) steps.push(step);
    }

    steps.push({
      key: terminalMilestone === "CANCELLED" ? "CUSTOMER_CANCELLED" : "CUSTOMER_FAILED",
      label: terminalMilestone === "CANCELLED" ? "Cancelled" : "Failed",
      description: String(terminalBackendStep?.description || "").trim() || undefined,
      timestamp: terminalBackendStep?.timestamp,
      state: "failed",
    });

    return steps;
  }

  // Non-terminal flow: always show the five customer milestones with a single current.
  const currentBackendStep = backendSteps.find((s) => s?.state === "current");
  const currentMilestone = mapBackendKeyToCustomerMilestone(currentBackendStep?.key) || "ORDER_PLACED";
  const etaForOutForDelivery =
    currentMilestone === "OUT_FOR_DELIVERY" && currentBackendStep?.eta?.start && currentBackendStep?.eta?.end
      ? {
          start: currentBackendStep.eta.start,
          end: currentBackendStep.eta.end,
          confidence: currentBackendStep.eta.confidence,
        }
      : undefined;

  const timestampsByMilestone: Partial<Record<CustomerMilestone, string>> = {};

  for (const s of backendSteps) {
    if (!s?.timestamp) continue;
    const m = mapBackendKeyToCustomerMilestone(s?.key);
    if (!m) continue;
    timestampsByMilestone[m] = earliestIso(timestampsByMilestone[m], s.timestamp);
  }

  const currentIndex = CUSTOMER_MILESTONES.findIndex((m) => m.id === currentMilestone);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;

  // For delivered orders, show all steps as completed (Amazon-style), no active current step.
  if (currentMilestone === "DELIVERED") {
    return CUSTOMER_MILESTONES.map((m) => ({
      key: m.key,
      label: m.label,
      timestamp: timestampsByMilestone[m.id],
      state: "completed",
      eta: undefined,
    }));
  }

  return CUSTOMER_MILESTONES.map((m, idx) => {
    const state: CustomerTimelineStepState =
      idx < safeCurrentIndex ? "completed" : idx === safeCurrentIndex ? "current" : "pending";

    return {
      key: m.key,
      label: m.label,
      timestamp: state === "pending" ? undefined : timestampsByMilestone[m.id],
      state,
      eta: m.id === "OUT_FOR_DELIVERY" && state === "current" ? etaForOutForDelivery : undefined,
    };
  });
}
