import { buildOrderTimeline } from "../../src/domains/orders/services/orderTimeline";

function stepMap(steps: any[]) {
  const map: Record<string, any> = {};
  for (const s of steps) map[s.key] = s;
  return map;
}

describe("Order timeline builder", () => {
  test("Delivered order -> full timeline with delivered as current/completed (no pending after)", () => {
    const now = new Date();
    const order: any = {
      orderStatus: "DELIVERED",
      createdAt: new Date(now.getTime() - 60_000 * 60).toISOString(),
      confirmedAt: new Date(now.getTime() - 50_000 * 60).toISOString(),
      packedAt: new Date(now.getTime() - 40_000 * 60).toISOString(),
      pickedUpAt: new Date(now.getTime() - 30_000 * 60).toISOString(),
      inTransitAt: new Date(now.getTime() - 20_000 * 60).toISOString(),
      deliveredAt: new Date(now.getTime() - 10_000 * 60).toISOString(),
      history: [
        { to: "CONFIRMED", at: new Date(now.getTime() - 50_000 * 60).toISOString(), actorRole: "ADMIN" },
        { to: "PACKED", at: new Date(now.getTime() - 40_000 * 60).toISOString(), actorRole: "ADMIN" },
        { to: "ASSIGNED", at: new Date(now.getTime() - 35_000 * 60).toISOString(), actorRole: "ADMIN" },
        { to: "PICKED_UP", at: new Date(now.getTime() - 30_000 * 60).toISOString(), actorRole: "DELIVERY_PARTNER" },
        { to: "IN_TRANSIT", at: new Date(now.getTime() - 20_000 * 60).toISOString(), actorRole: "DELIVERY_PARTNER" },
        { to: "DELIVERED", at: new Date(now.getTime() - 10_000 * 60).toISOString(), actorRole: "DELIVERY_PARTNER" },
      ],
      assignmentHistory: [{ offeredAt: new Date(now.getTime() - 36_000 * 60).toISOString() }],
    };

    const steps = buildOrderTimeline(order);
    expect(steps.map((s: any) => s.key)).toEqual([
      "ORDER_PLACED",
      "ORDER_CONFIRMED",
      "ORDER_PACKED",
      "ORDER_ASSIGNED",
      "ORDER_PICKED_UP",
      "ORDER_IN_TRANSIT",
      "ORDER_DELIVERED",
    ]);

    const byKey = stepMap(steps);
    expect(byKey.ORDER_DELIVERED.state).toBe("current");
    expect(byKey.ORDER_DELIVERED.timestamp).toBeDefined();
    expect(byKey.ORDER_PLACED.state).toBe("completed");
  });

  test("Cancelled before assignment -> timeline truncated with failed cancellation step", () => {
    const now = new Date();
    const order: any = {
      orderStatus: "cancelled",
      createdAt: new Date(now.getTime() - 60_000 * 60).toISOString(),
      confirmedAt: new Date(now.getTime() - 50_000 * 60).toISOString(),
      cancelledAt: new Date(now.getTime() - 45_000 * 60).toISOString(),
      cancelledBy: "customer",
      cancelReason: "Changed my mind",
      history: [
        { to: "CONFIRMED", at: new Date(now.getTime() - 50_000 * 60).toISOString(), actorRole: "ADMIN" },
        { to: "CANCELLED", at: new Date(now.getTime() - 45_000 * 60).toISOString(), actorRole: "CUSTOMER" },
      ],
    };

    const steps = buildOrderTimeline(order);
    expect(steps[steps.length - 1].key).toBe("ORDER_CANCELLED");
    expect(steps[steps.length - 1].state).toBe("failed");
    expect(String(steps[steps.length - 1].description || "")).toContain("Changed my mind");

    // Should not include later steps like PICKED_UP
    expect(steps.some((s: any) => s.key === "ORDER_PICKED_UP")).toBe(false);
  });

  test("In-transit with mixed casing -> current step correct and resilient", () => {
    const now = new Date();
    const order: any = {
      orderStatus: "in_transit",
      createdAt: new Date(now.getTime() - 60_000 * 60).toISOString(),
      packedAt: new Date(now.getTime() - 40_000 * 60).toISOString(),
      inTransitAt: new Date(now.getTime() - 10_000 * 60).toISOString(),
      history: [
        { to: "packed", at: new Date(now.getTime() - 40_000 * 60).toISOString(), actorRole: "ADMIN" },
        { to: "ASSIGNED", at: new Date(now.getTime() - 20_000 * 60).toISOString(), actorRole: "ADMIN" },
        { to: "In_Transit", at: new Date(now.getTime() - 10_000 * 60).toISOString(), actorRole: "DELIVERY_PARTNER" },
      ],
    };

    const steps = buildOrderTimeline(order);
    const byKey = stepMap(steps);
    expect(byKey.ORDER_IN_TRANSIT.state).toBe("current");
    expect(byKey.ORDER_IN_TRANSIT.timestamp).toBeDefined();
    expect(byKey.ORDER_DELIVERED.state).toBe("pending");
    expect(byKey.ORDER_DELIVERED.timestamp).toBeUndefined();
  });
});
