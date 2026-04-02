/**
 * Customer Order Timeline
 * 
 * Shared utility for building customer-facing order timelines.
 * Collapses internal backend states into customer-friendly milestones.
 * Used by both web and mobile apps.
 */

// ============================================================================
// Types
// ============================================================================

export type TimelineStepState = "completed" | "current" | "pending" | "failed";

export interface BackendTimelineStep {
  key?: string;
  label?: string;
  description?: string;
  timestamp?: string;
  state?: TimelineStepState;
  eta?: {
    start: string;
    end: string;
    confidence?: "high" | "medium";
  };
}

export interface CustomerTimelineStep {
  key: string;
  label: string;
  description?: string;
  timestamp?: string;
  state: TimelineStepState;
  eta?: {
    start: string;
    end: string;
    confidence?: "high" | "medium";
  };
}

type CustomerMilestone = "ORDER_PLACED" | "ORDER_CONFIRMED" | "IN_TRANSIT" | "DELIVERED";

type TerminalMilestone = "CANCELLED" | "FAILED";

// ============================================================================
// Milestone Definitions
// ============================================================================

/**
 * Customer-facing milestones (4 steps, simplified)
 */
export const CUSTOMER_MILESTONES: Array<{ id: CustomerMilestone; key: string; label: string }> = [
  { id: "ORDER_PLACED", key: "CUSTOMER_ORDER_PLACED", label: "Order placed" },
  { id: "ORDER_CONFIRMED", key: "CUSTOMER_ORDER_CONFIRMED", label: "Confirmed" },
  { id: "IN_TRANSIT", key: "CUSTOMER_IN_TRANSIT", label: "In transit" },
  { id: "DELIVERED", key: "CUSTOMER_DELIVERED", label: "Delivered" },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize a backend key to uppercase underscore format
 */
function normalizeKey(raw: unknown): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_")
    .toUpperCase();
}

/**
 * Map backend status key to customer milestone
 */
function mapBackendKeyToCustomerMilestone(rawKey: unknown): CustomerMilestone | null {
  const k = normalizeKey(rawKey);
  if (!k) return null;

  if (k === "ORDER_PLACED") return "ORDER_PLACED";
  if (k === "ORDER_CONFIRMED" || k === "PROCESSING") return "ORDER_CONFIRMED";

  // Collapse internal warehouse/logistics states into "In Transit"
  if (k === "ORDER_PACKED" || k === "ORDER_ASSIGNED" || k === "ORDER_PICKED_UP" || k === "ORDER_IN_TRANSIT" || k === "OUT_FOR_DELIVERY" || k === "SHIPPED") {
    return "IN_TRANSIT";
  }

  if (k === "ORDER_DELIVERED") return "DELIVERED";

  return null;
}

/**
 * Map backend key to terminal milestone
 */
function mapBackendKeyToTerminalMilestone(rawKey: unknown): TerminalMilestone | null {
  const k = normalizeKey(rawKey);
  if (k === "ORDER_CANCELLED") return "CANCELLED";
  if (k === "ORDER_FAILED") return "FAILED";
  if (k === "ORDER_RETURNED") return "FAILED";
  return null;
}

/**
 * Return the earlier of two ISO timestamps
 */
function earliestIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  const da = new Date(a);
  const db = new Date(b);
  if (!Number.isFinite(da.getTime())) return b;
  if (!Number.isFinite(db.getTime())) return a;
  return da.getTime() <= db.getTime() ? a : b;
}

// ============================================================================
// Timeline Builder
// ============================================================================

/**
 * Build a customer-facing timeline from backend timeline steps
 * 
 * @param rawBackendSteps - Raw timeline steps from backend API
 * @returns Customer-friendly timeline with 5 milestones
 * 
 * @example
 * ```ts
 * const backendSteps = [
 *   { key: "ORDER_PLACED", state: "completed", timestamp: "2024-01-01T10:00:00Z" },
 *   { key: "ORDER_CONFIRMED", state: "completed", timestamp: "2024-01-01T10:05:00Z" },
 *   { key: "ORDER_PACKED", state: "current", timestamp: "2024-01-01T11:00:00Z" },
 * ];
 * 
 * const customerTimeline = buildCustomerOrderTimeline(backendSteps);
 * // Returns 5 steps with ORDER_PLACED and ORDER_CONFIRMED completed,
 * // SHIPPED as current, and OUT_FOR_DELIVERY and DELIVERED as pending
 * ```
 */
export function buildCustomerOrderTimeline(rawBackendSteps: unknown): CustomerTimelineStep[] {
  const backendSteps: BackendTimelineStep[] = Array.isArray(rawBackendSteps)
    ? (rawBackendSteps as BackendTimelineStep[])
    : [];

  // Check for terminal state (cancelled/failed)
  const terminalBackendStep = backendSteps.find((s) => {
    const terminal = mapBackendKeyToTerminalMilestone(s?.key);
    return Boolean(terminal) || s?.state === "failed";
  });

  const terminalMilestone = terminalBackendStep
    ? mapBackendKeyToTerminalMilestone(terminalBackendStep?.key) || "FAILED"
    : null;

  // Terminal state: show completed milestones + terminal step
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

  // Non-terminal flow: find current step
  const currentBackendStep = backendSteps.find((s) => s?.state === "current");
  const currentMilestone = mapBackendKeyToCustomerMilestone(currentBackendStep?.key) || "ORDER_PLACED";
  
  const etaForInTransit =
    currentMilestone === "IN_TRANSIT" &&
    currentBackendStep?.eta?.start &&
    currentBackendStep?.eta?.end
      ? {
          start: currentBackendStep.eta.start,
          end: currentBackendStep.eta.end,
          confidence: currentBackendStep.eta.confidence,
        }
      : undefined;

  // Collect timestamps
  const timestampsByMilestone: Partial<Record<CustomerMilestone, string>> = {};
  for (const s of backendSteps) {
    if (!s?.timestamp) continue;
    const m = mapBackendKeyToCustomerMilestone(s?.key);
    if (!m) continue;
    timestampsByMilestone[m] = earliestIso(timestampsByMilestone[m], s.timestamp);
  }

  const currentIndex = CUSTOMER_MILESTONES.findIndex((m) => m.id === currentMilestone);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;

  // Delivered: all steps completed
  if (currentMilestone === "DELIVERED") {
    return CUSTOMER_MILESTONES.map((m) => ({
      key: m.key,
      label: m.label,
      timestamp: timestampsByMilestone[m.id],
      state: "completed" as const,
      eta: undefined,
    }));
  }

  // Normal flow: show progress
  return CUSTOMER_MILESTONES.map((m, idx) => {
    const state: TimelineStepState =
      idx < safeCurrentIndex ? "completed" : idx === safeCurrentIndex ? "current" : "pending";

    return {
      key: m.key,
      label: m.label,
      timestamp: state === "pending" ? undefined : timestampsByMilestone[m.id],
      state,
      eta: m.id === "IN_TRANSIT" && state === "current" ? etaForInTransit : undefined,
    };
  });
}

/**
 * Get the current milestone from a timeline
 * @param timeline - Customer timeline steps
 * @returns Current milestone or null if terminal
 */
export function getCurrentMilestone(timeline: CustomerTimelineStep[]): CustomerMilestone | null {
  const current = timeline.find((s) => s.state === "current");
  if (!current) return null;
  return CUSTOMER_MILESTONES.find((m) => m.key === current.key)?.id || null;
}

/**
 * Check if timeline is in terminal state
 * @param timeline - Customer timeline steps
 * @returns True if cancelled or failed
 */
export function isTerminalState(timeline: CustomerTimelineStep[]): boolean {
  return timeline.some((s) => s.state === "failed");
}

/**
 * Get ETA from timeline if available
 * @param timeline - Customer timeline steps
 * @returns ETA object or undefined
 */
export function getTimelineEta(
  timeline: CustomerTimelineStep[]
): { start: string; end: string; confidence?: "high" | "medium" } | undefined {
  const inTransit = timeline.find((s) => s.key === "CUSTOMER_IN_TRANSIT");
  return inTransit?.eta;
}
