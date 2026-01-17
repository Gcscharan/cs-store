import { describe, expect, it } from "vitest";
import { buildCustomerOrderTimeline } from "./customerOrderTimeline";

const ALLOWED_LABELS = new Set([
  "Order placed",
  "Order confirmed",
  "Shipped",
  "Out for delivery",
  "Delivered",
  "Cancelled",
  "Failed",
]);

const BANNED_LABELS = ["Packed and ready", "Picked up", "On the way"];

function expectOnlyAllowedLabels(steps: Array<{ label: string }>) {
  for (const s of steps) {
    expect(ALLOWED_LABELS.has(s.label)).toBe(true);
  }
  for (const banned of BANNED_LABELS) {
    expect(steps.some((s) => s.label === banned)).toBe(false);
  }
}

describe("buildCustomerOrderTimeline", () => {
  it("Delivered order -> shows only allowed customer milestones (no internal logistics labels)", () => {
    const backendTimeline = [
      { key: "ORDER_PLACED", state: "completed", timestamp: "2026-01-01T10:00:00.000Z" },
      { key: "ORDER_CONFIRMED", state: "completed", timestamp: "2026-01-01T10:05:00.000Z" },
      { key: "ORDER_PACKED", state: "completed", timestamp: "2026-01-01T10:20:00.000Z" },
      { key: "ORDER_IN_TRANSIT", state: "completed", timestamp: "2026-01-01T11:00:00.000Z" },
      { key: "ORDER_DELIVERED", state: "current", timestamp: "2026-01-01T12:00:00.000Z" },
    ];

    const steps = buildCustomerOrderTimeline(backendTimeline);

    expectOnlyAllowedLabels(steps);
    expect(steps.map((s) => s.label)).toEqual([
      "Order placed",
      "Order confirmed",
      "Shipped",
      "Out for delivery",
      "Delivered",
    ]);

    // Delivered order is terminal in the UI: everything is completed, no current.
    expect(steps.some((s) => s.state === "current")).toBe(false);
    expect(steps.every((s) => s.state === "completed")).toBe(true);

    const shipped = steps.find((s) => s.label === "Shipped");
    expect(shipped?.timestamp).toBe("2026-01-01T10:20:00.000Z");
  });

  it("In-transit order -> collapses PACKED/ASSIGNED/PICKED_UP into single Shipped and marks only one current", () => {
    const backendTimeline = [
      { key: "ORDER_PLACED", state: "completed", timestamp: "2026-01-01T10:00:00.000Z" },
      { key: "ORDER_CONFIRMED", state: "completed", timestamp: "2026-01-01T10:05:00.000Z" },
      { key: "ORDER_PACKED", state: "completed", timestamp: "2026-01-01T10:20:00.000Z" },
      { key: "ORDER_ASSIGNED", state: "completed", timestamp: "2026-01-01T10:25:00.000Z" },
      {
        key: "ORDER_IN_TRANSIT",
        state: "current",
        timestamp: "2026-01-01T11:00:00.000Z",
        eta: {
          start: "2026-01-01T11:30:00.000Z",
          end: "2026-01-01T12:15:00.000Z",
          confidence: "high",
        },
      },
      { key: "ORDER_DELIVERED", state: "pending" },
    ];

    const steps = buildCustomerOrderTimeline(backendTimeline);

    expectOnlyAllowedLabels(steps);
    expect(steps.map((s) => s.label)).toEqual([
      "Order placed",
      "Order confirmed",
      "Shipped",
      "Out for delivery",
      "Delivered",
    ]);

    expect(steps.filter((s) => s.state === "current")).toHaveLength(1);
    expect(steps.find((s) => s.label === "Out for delivery")?.state).toBe("current");

    // ETA should appear only on the customer Out for delivery step.
    const out = steps.find((s: any) => s.label === "Out for delivery") as any;
    expect(out?.eta?.start).toBe("2026-01-01T11:30:00.000Z");
    expect(out?.eta?.end).toBe("2026-01-01T12:15:00.000Z");
    expect(steps.filter((s: any) => Boolean((s as any).eta))).toHaveLength(1);

    // ETA should not appear on shipped steps.
    expect(steps.find((s: any) => s.label === "Shipped")?.eta).toBeUndefined();
  });

  it("Cancelled order -> terminal Cancelled/Failed replaces remaining steps and shows reason when present", () => {
    const backendTimeline = [
      { key: "ORDER_PLACED", state: "completed", timestamp: "2026-01-01T10:00:00.000Z" },
      { key: "ORDER_CONFIRMED", state: "completed", timestamp: "2026-01-01T10:05:00.000Z" },
      {
        key: "ORDER_CANCELLED",
        state: "failed",
        timestamp: "2026-01-01T10:06:00.000Z",
        description: "Cancelled by you: changed mind",
      },
    ];

    const steps = buildCustomerOrderTimeline(backendTimeline);

    expectOnlyAllowedLabels(steps);
    expect(steps.map((s) => s.label)).toEqual(["Order placed", "Order confirmed", "Cancelled"]);

    const terminal = steps[steps.length - 1];
    expect(terminal.state).toBe("failed");
    expect(terminal.description).toBe("Cancelled by you: changed mind");

    // Terminal timeline never includes ETA.
    expect(steps.some((s: any) => Boolean((s as any).eta))).toBe(false);

    // ETA should not appear on cancelled steps.
    expect(steps.find((s: any) => s.label === "Cancelled")?.eta).toBeUndefined();
  });
});
