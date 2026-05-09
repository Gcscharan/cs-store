/**
 * Property-Based Tests for computeAllowedActions and isValidFailureReason
 *
 * Uses fast-check to verify correctness properties defined in the spec.
 * These tests validate pure function behavior across arbitrary inputs.
 */

import * as fc from "fast-check";
import {
  computeAllowedActions,
  DeliveryAction,
} from "../allowedActions";
import {
  isValidFailureReason,
  FAILURE_REASONS,
} from "../../enums/FailureReason";
import { DELIVERY_ALLOWED_TRANSITIONS } from "../../../../domains/orders/services/orderStateService";
import { OrderStatus } from "../../../../domains/orders/enums/OrderStatus";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const orderStatusArb = fc.constantFrom(
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
  "RETURNED",
  "CREATED",
  "CONFIRMED",
  "PACKED",
  "unknown_status",
  ""
);

const deliveryStatusArb = fc.constantFrom(
  "unassigned",
  "assigned",
  "picked_up",
  "in_transit",
  "arrived",
  "delivered",
  "failed",
  ""
);

const paymentMethodArb = fc.constantFrom("cod", "COD", "prepaid", "upi", "online", "");

const optionalDateArb = fc.option(fc.date(), { nil: undefined });

const addressArb = fc.record({
  lat: fc.option(fc.float({ min: -90, max: 90, noNaN: true }), { nil: undefined }),
  lng: fc.option(fc.float({ min: -180, max: 180, noNaN: true }), { nil: undefined }),
});

/** Arbitrary for a full order object with all fields relevant to computeAllowedActions */
const orderArb = fc.record({
  orderStatus: orderStatusArb,
  deliveryStatus: deliveryStatusArb,
  arrivedAt: optionalDateArb,
  deliveryOtpGeneratedAt: optionalDateArb,
  paymentMethod: paymentMethodArb,
  address: addressArb,
});

const optionsArb = fc.record({
  codCollected: fc.boolean(),
  isNext: fc.boolean(),
  riderHasLocation: fc.boolean(),
});

// ---------------------------------------------------------------------------
// Task 11.1 — Property 4: computeAllowedActions is a pure function
// Validates: Requirements 6.2; Correctness Property 4
// ---------------------------------------------------------------------------

describe("Property 4 — computeAllowedActions is a pure function", () => {
  it("returns identical arrays for identical inputs", () => {
    fc.assert(
      fc.property(orderArb, optionsArb, (order, options) => {
        const result1 = computeAllowedActions(order, options);
        const result2 = computeAllowedActions(order, options);

        // Same length
        expect(result1.length).toBe(result2.length);
        // Same elements in same order
        result1.forEach((action, i) => {
          expect(action).toBe(result2[i]);
        });
      }),
      { numRuns: 500 }
    );
  });

  it("does not mutate the input order object", () => {
    fc.assert(
      fc.property(orderArb, optionsArb, (order, options) => {
        // Capture original field values before the call
        const originalStatus = order.orderStatus;
        const originalDeliveryStatus = order.deliveryStatus;
        const originalPaymentMethod = order.paymentMethod;
        const originalArrivedAt = order.arrivedAt;
        const originalOtpGeneratedAt = order.deliveryOtpGeneratedAt;

        computeAllowedActions(order, options);

        // Verify none of the relevant fields were mutated
        expect(order.orderStatus).toBe(originalStatus);
        expect(order.deliveryStatus).toBe(originalDeliveryStatus);
        expect(order.paymentMethod).toBe(originalPaymentMethod);
        expect(order.arrivedAt).toBe(originalArrivedAt);
        expect(order.deliveryOtpGeneratedAt).toBe(originalOtpGeneratedAt);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 11.2 — Property 5: allowedActions and state machine are consistent
// Validates: Requirements 6.3, 6.4; Correctness Property 5
//
// Action → state transition mapping:
//   PICKUP              : ASSIGNED → PICKED_UP
//   START_DELIVERY      : PICKED_UP → IN_TRANSIT
//   MARK_ARRIVED        : IN_TRANSIT → ARRIVED
//   VERIFY_OTP          : ARRIVED → DELIVERED
//   CUSTOMER_NOT_AVAILABLE: ARRIVED → FAILED
//   SEND_OTP, COLLECT_COD, NAVIGATE → informational (no state transition)
// ---------------------------------------------------------------------------

/** Map from action to the [from, to] state transition it triggers */
const ACTION_TRANSITIONS: Partial<Record<DeliveryAction, [OrderStatus, OrderStatus]>> = {
  PICKUP: [OrderStatus.ASSIGNED, OrderStatus.PICKED_UP],
  START_DELIVERY: [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT],
  MARK_ARRIVED: [OrderStatus.IN_TRANSIT, OrderStatus.ARRIVED],
  VERIFY_OTP: [OrderStatus.ARRIVED, OrderStatus.DELIVERED],
  CUSTOMER_NOT_AVAILABLE: [OrderStatus.ARRIVED, OrderStatus.FAILED],
};

describe("Property 5 — allowedActions and state machine are consistent", () => {
  it("every state-changing action corresponds to a valid DELIVERY_ALLOWED_TRANSITIONS entry", () => {
    fc.assert(
      fc.property(orderArb, optionsArb, (order, options) => {
        const actions = computeAllowedActions(order, options);
        const currentStatus = String(order.orderStatus || "").toUpperCase() as OrderStatus;

        for (const action of actions) {
          const transition = ACTION_TRANSITIONS[action as DeliveryAction];
          if (!transition) {
            // Informational actions (SEND_OTP, COLLECT_COD, NAVIGATE, RECORD_ATTEMPT)
            // have no state transition — skip
            continue;
          }

          const [expectedFrom, expectedTo] = transition;

          // The action should only appear when the order is in the expected "from" state
          expect(currentStatus).toBe(expectedFrom);

          // The transition must be present in DELIVERY_ALLOWED_TRANSITIONS
          const allowedTos = DELIVERY_ALLOWED_TRANSITIONS[expectedFrom] ?? [];
          expect(allowedTos).toContain(expectedTo);
        }
      }),
      { numRuns: 500 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 11.3 — Property 2: COD gate is unconditional
// Validates: Requirements 3.1–3.3; Correctness Property 2
// ---------------------------------------------------------------------------

describe("Property 2 — COD gate is unconditional", () => {
  /** COD order with arrivedAt set and codCollected: false */
  const codOrderArb = fc.record({
    orderStatus: fc.constantFrom("ARRIVED", "IN_TRANSIT"),
    deliveryStatus: deliveryStatusArb,
    arrivedAt: fc.date(), // always set
    deliveryOtpGeneratedAt: optionalDateArb,
    paymentMethod: fc.constantFrom("cod", "COD"),
    address: addressArb,
  });

  it("never includes SEND_OTP or VERIFY_OTP for COD orders where codCollected is false", () => {
    fc.assert(
      fc.property(
        codOrderArb,
        fc.record({
          codCollected: fc.constant(false),
          isNext: fc.boolean(),
          riderHasLocation: fc.boolean(),
        }),
        (order, options) => {
          const actions = computeAllowedActions(order, options);
          expect(actions).not.toContain("SEND_OTP");
          expect(actions).not.toContain("VERIFY_OTP");
        }
      ),
      { numRuns: 300 }
    );
  });

  it("allows SEND_OTP or VERIFY_OTP for COD orders once codCollected is true", () => {
    fc.assert(
      fc.property(
        fc.record({
          orderStatus: fc.constant("ARRIVED"),
          deliveryStatus: deliveryStatusArb,
          arrivedAt: fc.date(),
          deliveryOtpGeneratedAt: optionalDateArb,
          paymentMethod: fc.constantFrom("cod", "COD"),
          address: addressArb,
        }),
        fc.record({
          codCollected: fc.constant(true),
          isNext: fc.constant(true),
          riderHasLocation: fc.boolean(),
        }),
        (order, options) => {
          const actions = computeAllowedActions(order, options);
          // Must include either SEND_OTP or VERIFY_OTP (depending on otpSentAt)
          const hasOtpAction =
            actions.includes("SEND_OTP") || actions.includes("VERIFY_OTP");
          expect(hasOtpAction).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 11.4 — Property 3: Failure reason validation is exhaustive
// Validates: Requirements 4.5, 4.6; Correctness Property 3
// ---------------------------------------------------------------------------

describe("Property 3 — Failure reason validation is exhaustive", () => {
  it("accepts exactly the three canonical failure reasons", () => {
    for (const reason of FAILURE_REASONS) {
      expect(isValidFailureReason(reason)).toBe(true);
    }
  });

  it("rejects any string not in the canonical list", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const isCanonical = (FAILURE_REASONS as readonly string[]).includes(value);
        expect(isValidFailureReason(value)).toBe(isCanonical);
      }),
      { numRuns: 1000 }
    );
  });

  it("rejects empty string, null-like strings, and arbitrary values", () => {
    const invalidValues = [
      "",
      "null",
      "undefined",
      "UNKNOWN",
      "customer_not_available", // wrong case
      "ADDRESS ISSUE",          // space instead of underscore
      "CUSTOMER_REJECTED_EXTRA",
    ];
    for (const v of invalidValues) {
      expect(isValidFailureReason(v)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Task 11.5 — Property 9: Multi-order sequencing exclusivity
// Validates: Requirements 9.2, 9.3; Correctness Property 9
// ---------------------------------------------------------------------------

describe("Property 9 — Multi-order sequencing exclusivity", () => {
  /**
   * Generate N orders (N >= 2) where exactly one has isNext: true.
   * All orders are in a state where MARK_ARRIVED or VERIFY_OTP could appear.
   */
  const multiOrderScenarioArb = fc
    .integer({ min: 2, max: 6 })
    .chain((n) => {
      // Pick which index is the "next" order
      return fc.integer({ min: 0, max: n - 1 }).chain((nextIdx) => {
        const orderGen = (isNext: boolean) =>
          fc.record({
            order: fc.record({
              orderStatus: fc.constantFrom("IN_TRANSIT", "ARRIVED"),
              deliveryStatus: deliveryStatusArb,
              arrivedAt: optionalDateArb,
              deliveryOtpGeneratedAt: optionalDateArb,
              paymentMethod: paymentMethodArb,
              address: addressArb,
            }),
            options: fc.record({
              codCollected: fc.boolean(),
              isNext: fc.constant(isNext),
              riderHasLocation: fc.boolean(),
            }),
          });

        const generators = Array.from({ length: n }, (_, i) =>
          orderGen(i === nextIdx)
        );

        return fc.tuple(...(generators as [typeof generators[0], ...typeof generators]));
      });
    });

  it("MARK_ARRIVED and VERIFY_OTP appear in at most one order's allowedActions", () => {
    fc.assert(
      fc.property(multiOrderScenarioArb, (orderScenarios) => {
        let markArrivedCount = 0;
        let verifyOtpCount = 0;

        for (const scenario of orderScenarios) {
          const actions = computeAllowedActions(scenario.order, scenario.options);
          if (actions.includes("MARK_ARRIVED")) markArrivedCount++;
          if (actions.includes("VERIFY_OTP")) verifyOtpCount++;
        }

        expect(markArrivedCount).toBeLessThanOrEqual(1);
        expect(verifyOtpCount).toBeLessThanOrEqual(1);
      }),
      { numRuns: 300 }
    );
  });

  it("orders with isNext: false never include MARK_ARRIVED or VERIFY_OTP", () => {
    fc.assert(
      fc.property(
        fc.record({
          orderStatus: fc.constantFrom("IN_TRANSIT", "ARRIVED"),
          deliveryStatus: deliveryStatusArb,
          arrivedAt: optionalDateArb,
          deliveryOtpGeneratedAt: optionalDateArb,
          paymentMethod: paymentMethodArb,
          address: addressArb,
        }),
        fc.record({
          codCollected: fc.boolean(),
          isNext: fc.constant(false),
          riderHasLocation: fc.boolean(),
        }),
        (order, options) => {
          const actions = computeAllowedActions(order, options);
          expect(actions).not.toContain("MARK_ARRIVED");
          expect(actions).not.toContain("VERIFY_OTP");
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 11.6 — Property 8: Idempotency of attempt recording
// NOTE: This property requires integration testing with a real database.
// The DeliveryAttempt collection enforces a unique index on orderId, and
// the recordDeliveryAttempt controller returns HTTP 200 with the existing
// record on duplicate calls (see Task 9.1). Verifying this property requires
// spinning up a MongoDB instance and making real HTTP calls — it cannot be
// tested as a pure unit test.
//
// The property to verify:
//   For any sequence of N identical calls to POST /delivery/orders/:orderId/attempt
//   with the same orderId, the resulting DeliveryAttempt count for that orderId
//   SHALL be exactly 1.
//
// See: backend/tests/integration/ for the appropriate test location.
// Validates: Requirements 8.1, 8.5; Correctness Property 8
// ---------------------------------------------------------------------------

describe("Property 8 — Idempotency of attempt recording (placeholder)", () => {
  it.todo(
    "requires integration test: calling recordDeliveryAttempt N times with same orderId results in exactly 1 DeliveryAttempt document"
  );

  it.todo(
    "requires integration test: WalletTransaction count for (riderId, orderId, EARNING) is exactly 1 after N retries"
  );
});

// ---------------------------------------------------------------------------
// Task 11.7 — Fix 1: ARRIVED is the single source of truth (no arrivedAt branching)
// Validates: Fix 1 from allowedActions.ts spec
// ---------------------------------------------------------------------------

describe("Fix 1 — ARRIVED is the single source of truth (no arrivedAt branching)", () => {
  it("IN_TRANSIT orders with arrivedAt set never return SEND_OTP or COLLECT_COD", () => {
    fc.assert(
      fc.property(
        fc.record({
          orderStatus: fc.constant("IN_TRANSIT"),
          deliveryStatus: deliveryStatusArb,
          arrivedAt: fc.date(), // explicitly set
          deliveryOtpGeneratedAt: optionalDateArb,
          paymentMethod: paymentMethodArb,
          address: addressArb,
        }),
        optionsArb,
        (order, options) => {
          const actions = computeAllowedActions(order, options);
          expect(actions).not.toContain("SEND_OTP");
          expect(actions).not.toContain("COLLECT_COD");
          expect(actions).not.toContain("VERIFY_OTP");
        }
      ),
      { numRuns: 300 }
    );
  });

  it("IN_TRANSIT orders with arrivedAt set return MARK_ARRIVED (when isNext) and optionally NAVIGATE", () => {
    fc.assert(
      fc.property(
        fc.record({
          orderStatus: fc.constant("IN_TRANSIT"),
          deliveryStatus: deliveryStatusArb,
          arrivedAt: fc.date(), // explicitly set — should be ignored
          deliveryOtpGeneratedAt: optionalDateArb,
          paymentMethod: paymentMethodArb,
          address: addressArb,
        }),
        fc.record({
          codCollected: fc.boolean(),
          isNext: fc.constant(true),
          riderHasLocation: fc.boolean(),
        }),
        (order, options) => {
          const actions = computeAllowedActions(order, options);
          expect(actions).toContain("MARK_ARRIVED");
          // Only MARK_ARRIVED and optionally NAVIGATE should be present
          const unexpected = actions.filter(
            (a) => a !== "MARK_ARRIVED" && a !== "NAVIGATE"
          );
          expect(unexpected).toHaveLength(0);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("ARRIVED orders without arrivedAt still return the ARRIVED-branch actions", () => {
    fc.assert(
      fc.property(
        fc.record({
          orderStatus: fc.constant("ARRIVED"),
          deliveryStatus: deliveryStatusArb,
          arrivedAt: fc.constant(undefined), // explicitly absent
          deliveryOtpGeneratedAt: optionalDateArb,
          paymentMethod: paymentMethodArb,
          address: addressArb,
        }),
        fc.record({
          codCollected: fc.boolean(),
          isNext: fc.constant(true),
          riderHasLocation: fc.boolean(),
        }),
        (order, options) => {
          const actions = computeAllowedActions(order, options);
          // Must return ARRIVED-branch actions regardless of arrivedAt being absent
          const isCod = String(order.paymentMethod || "").toLowerCase() === "cod";
          if (isCod && !options.codCollected) {
            expect(actions).toContain("COLLECT_COD");
          } else {
            const hasOtpAction =
              actions.includes("SEND_OTP") || actions.includes("VERIFY_OTP");
            expect(hasOtpAction).toBe(true);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it("arrivedAt field is never read — ARRIVED status alone drives the branch", () => {
    // Compare two identical ARRIVED orders: one with arrivedAt, one without
    fc.assert(
      fc.property(
        fc.record({
          orderStatus: fc.constant("ARRIVED"),
          deliveryStatus: deliveryStatusArb,
          deliveryOtpGeneratedAt: optionalDateArb,
          paymentMethod: paymentMethodArb,
          address: addressArb,
        }),
        optionsArb,
        (baseOrder, options) => {
          const orderWithArrivedAt = { ...baseOrder, arrivedAt: new Date() };
          const orderWithoutArrivedAt = { ...baseOrder, arrivedAt: undefined };

          const actionsWithArrivedAt = computeAllowedActions(orderWithArrivedAt, options);
          const actionsWithoutArrivedAt = computeAllowedActions(orderWithoutArrivedAt, options);

          // Results must be identical — arrivedAt is not a branching condition
          expect(actionsWithArrivedAt).toEqual(actionsWithoutArrivedAt);
        }
      ),
      { numRuns: 300 }
    );
  });
});
