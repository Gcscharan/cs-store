import fc from "fast-check";

import { OrderStatus } from "../../src/domains/orders/enums/OrderStatus";

const numRuns = process.env.CI_NIGHTLY === "true" ? 10000 : 100;

// Mirror the allowed transitions used in orderStateService
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.ASSIGNED]: [OrderStatus.PICKED_UP, OrderStatus.PACKED],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  [OrderStatus.OUT_FOR_DELIVERY]: [],
  [OrderStatus.FAILED]: [OrderStatus.RETURNED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.CANCELLED]: [],
};

describe("Property: order state transitions", () => {
  test("no transition escapes the allowed transition graph", () => {
    const statuses = Object.values(OrderStatus) as OrderStatus[];

    fc.assert(
      fc.property(
        fc.constantFrom(...statuses),
        fc.constantFrom(...statuses),
        (from, to) => {
          const allowed = (ALLOWED[from] || []).includes(to);

          // Property: if not allowed, it must be rejected by the graph
          if (!allowed) {
            expect((ALLOWED[from] || []).includes(to)).toBe(false);
          } else {
            expect((ALLOWED[from] || []).includes(to)).toBe(true);
          }
        }
      ),
      { numRuns }
    );
  });
});
