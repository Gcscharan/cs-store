/**
 * Unit tests for Priority Engine
 *
 * Tests all priority classifications and delivery behavior configurations.
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7
 */

import {
  classifyPriority,
  getDeliveryBehavior,
  PriorityLevel,
  DeliveryBehavior,
} from "../../../src/domains/communication/services/priorityEngine";

describe("Priority Engine", () => {
  describe("classifyPriority", () => {
    describe("P0 (Critical) events", () => {
      it("should classify PAYMENT_FAILED as P0", () => {
        expect(classifyPriority("PAYMENT_FAILED")).toBe("P0");
      });

      it("should classify ORDER_FAILED as P0", () => {
        expect(classifyPriority("ORDER_FAILED")).toBe("P0");
      });

      it("should classify ADMIN_SECURITY_EVENT as P0", () => {
        expect(classifyPriority("ADMIN_SECURITY_EVENT")).toBe("P0");
      });
    });

    describe("P1 (High) events", () => {
      it("should classify ORDER_DELIVERED as P1", () => {
        expect(classifyPriority("ORDER_DELIVERED")).toBe("P1");
      });

      it("should classify DELIVERY_ASSIGNED as P1", () => {
        expect(classifyPriority("DELIVERY_ASSIGNED")).toBe("P1");
      });

      it("should classify OTP_GENERATED as P1", () => {
        expect(classifyPriority("OTP_GENERATED")).toBe("P1");
      });

      it("should classify DELIVERY_OTP_GENERATED as P1", () => {
        expect(classifyPriority("DELIVERY_OTP_GENERATED")).toBe("P1");
      });
    });

    describe("P2 (Medium) events", () => {
      it("should classify ORDER_CONFIRMED as P2", () => {
        expect(classifyPriority("ORDER_CONFIRMED")).toBe("P2");
      });

      it("should classify ORDER_PACKED as P2", () => {
        expect(classifyPriority("ORDER_PACKED")).toBe("P2");
      });

      it("should classify EARNINGS_CREDITED as P2", () => {
        expect(classifyPriority("EARNINGS_CREDITED")).toBe("P2");
      });
    });

    describe("P3 (Low) events", () => {
      it("should classify PROMO_CAMPAIGN as P3", () => {
        expect(classifyPriority("PROMO_CAMPAIGN")).toBe("P3");
      });

      it("should classify SYSTEM_ANNOUNCEMENT as P3", () => {
        expect(classifyPriority("SYSTEM_ANNOUNCEMENT")).toBe("P3");
      });
    });

    describe("Unmapped events", () => {
      it("should default to P2 for unknown event types", () => {
        expect(classifyPriority("UNKNOWN_EVENT")).toBe("P2");
      });

      it("should default to P2 for empty string", () => {
        expect(classifyPriority("")).toBe("P2");
      });

      it("should default to P2 for any unregistered event", () => {
        expect(classifyPriority("SOME_FUTURE_EVENT")).toBe("P2");
      });
    });
  });

  describe("getDeliveryBehavior", () => {
    describe("P0 (Critical) behavior", () => {
      let behavior: DeliveryBehavior;

      beforeEach(() => {
        behavior = getDeliveryBehavior("P0");
      });

      it("should have sound enabled", () => {
        expect(behavior.sound).toBe(true);
      });

      it("should have badge enabled", () => {
        expect(behavior.badge).toBe(true);
      });

      it("should have 5 retry attempts", () => {
        expect(behavior.retryAttempts).toBe(5);
      });

      it("should force push and in_app channels", () => {
        expect(behavior.forceChannels).toEqual(["push", "in_app"]);
      });
    });

    describe("P1 (High) behavior", () => {
      let behavior: DeliveryBehavior;

      beforeEach(() => {
        behavior = getDeliveryBehavior("P1");
      });

      it("should have sound enabled", () => {
        expect(behavior.sound).toBe(true);
      });

      it("should have badge enabled", () => {
        expect(behavior.badge).toBe(true);
      });

      it("should have 3 retry attempts", () => {
        expect(behavior.retryAttempts).toBe(3);
      });

      it("should not force any channels", () => {
        expect(behavior.forceChannels).toEqual([]);
      });
    });

    describe("P2 (Medium) behavior", () => {
      let behavior: DeliveryBehavior;

      beforeEach(() => {
        behavior = getDeliveryBehavior("P2");
      });

      it("should have sound disabled", () => {
        expect(behavior.sound).toBe(false);
      });

      it("should have badge enabled", () => {
        expect(behavior.badge).toBe(true);
      });

      it("should have 2 retry attempts", () => {
        expect(behavior.retryAttempts).toBe(2);
      });

      it("should not force any channels", () => {
        expect(behavior.forceChannels).toEqual([]);
      });
    });

    describe("P3 (Low) behavior", () => {
      let behavior: DeliveryBehavior;

      beforeEach(() => {
        behavior = getDeliveryBehavior("P3");
      });

      it("should have sound disabled", () => {
        expect(behavior.sound).toBe(false);
      });

      it("should have badge disabled", () => {
        expect(behavior.badge).toBe(false);
      });

      it("should have 0 retry attempts", () => {
        expect(behavior.retryAttempts).toBe(0);
      });

      it("should not force any channels", () => {
        expect(behavior.forceChannels).toEqual([]);
      });
    });
  });

  describe("Integration: classifyPriority → getDeliveryBehavior", () => {
    it("should return P0 behavior for PAYMENT_FAILED", () => {
      const priority = classifyPriority("PAYMENT_FAILED");
      const behavior = getDeliveryBehavior(priority);
      expect(behavior.sound).toBe(true);
      expect(behavior.retryAttempts).toBe(5);
      expect(behavior.forceChannels).toContain("push");
      expect(behavior.forceChannels).toContain("in_app");
    });

    it("should return P1 behavior for ORDER_DELIVERED", () => {
      const priority = classifyPriority("ORDER_DELIVERED");
      const behavior = getDeliveryBehavior(priority);
      expect(behavior.sound).toBe(true);
      expect(behavior.retryAttempts).toBe(3);
      expect(behavior.forceChannels).toEqual([]);
    });

    it("should return P2 behavior for ORDER_CONFIRMED", () => {
      const priority = classifyPriority("ORDER_CONFIRMED");
      const behavior = getDeliveryBehavior(priority);
      expect(behavior.sound).toBe(false);
      expect(behavior.badge).toBe(true);
      expect(behavior.retryAttempts).toBe(2);
    });

    it("should return P3 behavior for PROMO_CAMPAIGN", () => {
      const priority = classifyPriority("PROMO_CAMPAIGN");
      const behavior = getDeliveryBehavior(priority);
      expect(behavior.sound).toBe(false);
      expect(behavior.badge).toBe(false);
      expect(behavior.retryAttempts).toBe(0);
    });

    it("should return P2 (default) behavior for unmapped events", () => {
      const priority = classifyPriority("SOME_RANDOM_EVENT");
      const behavior = getDeliveryBehavior(priority);
      expect(behavior.sound).toBe(false);
      expect(behavior.badge).toBe(true);
      expect(behavior.retryAttempts).toBe(2);
      expect(behavior.forceChannels).toEqual([]);
    });
  });
});
