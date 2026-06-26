import {
  resolveTemplate,
  interpolateTemplate,
  defaultTitleForEvent,
  getTemplateRegistry,
  NotificationTemplate,
  NotificationRole,
} from "../../../src/domains/communication/templates/notificationTemplates";

// Suppress logger output during tests
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from "../../../src/utils/logger";

describe("Notification Template Registry", () => {
  describe("Registry Structure", () => {
    it("should have templates registered in the registry", () => {
      const registry = getTemplateRegistry();
      expect(registry.size).toBeGreaterThan(0);
    });

    it("should contain templates for all 18 existing event types", () => {
      const existingEventTypes = [
        "ORDER_CREATED",
        "ORDER_CONFIRMED",
        "ORDER_PACKED",
        "DELIVERY_ASSIGNED",
        "ORDER_PICKED_UP",
        "ORDER_IN_TRANSIT",
        "ORDER_DELIVERED",
        "ORDER_FAILED",
        "ORDER_CANCELLED",
        "PAYMENT_PENDING",
        "PAYMENT_SUCCESS",
        "PAYMENT_FAILED",
        "REFUND_INITIATED",
        "REFUND_COMPLETED",
        "ACCOUNT_PROFILE_UPDATED",
        "ACCOUNT_PASSWORD_CHANGED",
        "ACCOUNT_NEW_LOGIN",
        "PROMO_CAMPAIGN",
        "SYSTEM_ANNOUNCEMENT",
      ];

      const registry = getTemplateRegistry();
      for (const eventType of existingEventTypes) {
        expect(registry.has(eventType)).toBe(true);
      }
    });

    it("should contain templates for new delivery/admin event types", () => {
      const newEventTypes = [
        "DELIVERY_PICKUP_REMINDER",
        "DELIVERY_OTP_GENERATED",
        "DELIVERY_COMPLETED",
        "EARNINGS_CREDITED",
        "EARNINGS_DAILY_SUMMARY",
        "PERFORMANCE_MILESTONE",
        "COD_SETTLEMENT_REMINDER",
        "ADMIN_SECURITY_EVENT",
      ];

      const registry = getTemplateRegistry();
      for (const eventType of newEventTypes) {
        expect(registry.has(eventType)).toBe(true);
      }
    });

    it("should have role-specific templates for DELIVERY_ASSIGNED (customer and delivery_partner)", () => {
      const registry = getTemplateRegistry();
      const deliveryAssigned = registry.get("DELIVERY_ASSIGNED");
      expect(deliveryAssigned).toBeDefined();
      expect(deliveryAssigned!.has("customer")).toBe(true);
      expect(deliveryAssigned!.has("delivery_partner")).toBe(true);
    });

    it("should have admin templates for ORDER_CREATED, ORDER_FAILED, and PAYMENT_FAILED", () => {
      const registry = getTemplateRegistry();
      expect(registry.get("ORDER_CREATED")!.has("admin")).toBe(true);
      expect(registry.get("ORDER_FAILED")!.has("admin")).toBe(true);
      expect(registry.get("PAYMENT_FAILED")!.has("admin")).toBe(true);
    });
  });

  describe("NotificationTemplate Interface Compliance", () => {
    it("each template should have all required fields", () => {
      const registry = getTemplateRegistry();
      registry.forEach((roleMap, eventType) => {
        roleMap.forEach((template, role) => {
          expect(template.eventType).toBe(eventType);
          expect(template.role).toBe(role);
          expect(typeof template.title).toBe("string");
          expect(template.title.length).toBeGreaterThan(0);
          expect(typeof template.body).toBe("string");
          expect(template.body.length).toBeGreaterThan(0);
          expect(typeof template.deepLinkPattern).toBe("string");
          expect(["order", "delivery", "payment", "account", "promo"]).toContain(template.category);
          expect(["P0", "P1", "P2", "P3"]).toContain(template.priority);
          expect(Array.isArray(template.channels)).toBe(true);
          expect(template.channels.length).toBeGreaterThan(0);
          expect(typeof template.sound).toBe("boolean");
        });
      });
    });
  });

  describe("resolveTemplate()", () => {
    it("should resolve exact role match for customer", () => {
      const template = resolveTemplate("ORDER_CREATED", "customer");
      expect(template).not.toBeNull();
      expect(template!.eventType).toBe("ORDER_CREATED");
      expect(template!.role).toBe("customer");
      expect(template!.title).toBe("Order Placed");
    });

    it("should resolve exact role match for delivery_partner", () => {
      const template = resolveTemplate("DELIVERY_ASSIGNED", "delivery_partner");
      expect(template).not.toBeNull();
      expect(template!.eventType).toBe("DELIVERY_ASSIGNED");
      expect(template!.role).toBe("delivery_partner");
      expect(template!.title).toBe("New Order Assigned");
    });

    it("should resolve exact role match for admin", () => {
      const template = resolveTemplate("ORDER_CREATED", "admin");
      expect(template).not.toBeNull();
      expect(template!.eventType).toBe("ORDER_CREATED");
      expect(template!.role).toBe("admin");
      expect(template!.title).toBe("New Order Received");
    });

    it("should return null for unmapped event types", () => {
      const template = resolveTemplate("UNKNOWN_EVENT_TYPE", "customer");
      expect(template).toBeNull();
    });

    it("should return null for an event type that has no matching role and no 'all' fallback", () => {
      // ORDER_CONFIRMED only has customer role registered
      const template = resolveTemplate("ORDER_CONFIRMED", "admin");
      expect(template).toBeNull();
    });

    it("should resolve DELIVERY_ASSIGNED differently for customer and delivery_partner", () => {
      const customerTemplate = resolveTemplate("DELIVERY_ASSIGNED", "customer");
      const riderTemplate = resolveTemplate("DELIVERY_ASSIGNED", "delivery_partner");

      expect(customerTemplate).not.toBeNull();
      expect(riderTemplate).not.toBeNull();
      expect(customerTemplate!.title).not.toBe(riderTemplate!.title);
      expect(customerTemplate!.deepLinkPattern).not.toBe(riderTemplate!.deepLinkPattern);
    });

    it("should resolve P0 priority for PAYMENT_FAILED customer template", () => {
      const template = resolveTemplate("PAYMENT_FAILED", "customer");
      expect(template).not.toBeNull();
      expect(template!.priority).toBe("P0");
      expect(template!.sound).toBe(true);
    });

    it("should resolve P0 priority for ORDER_FAILED customer template", () => {
      const template = resolveTemplate("ORDER_FAILED", "customer");
      expect(template).not.toBeNull();
      expect(template!.priority).toBe("P0");
    });

    it("should resolve P0 priority for ADMIN_SECURITY_EVENT admin template", () => {
      const template = resolveTemplate("ADMIN_SECURITY_EVENT", "admin");
      expect(template).not.toBeNull();
      expect(template!.priority).toBe("P0");
    });

    it("should resolve P3 priority for PROMO_CAMPAIGN", () => {
      const template = resolveTemplate("PROMO_CAMPAIGN", "customer");
      expect(template).not.toBeNull();
      expect(template!.priority).toBe("P3");
    });
  });

  describe("interpolateTemplate()", () => {
    it("should replace variables with provided data values", () => {
      const result = interpolateTemplate(
        "Your order #{orderNumber} has been placed.",
        { orderNumber: "12345" }
      );
      expect(result).toBe("Your order #12345 has been placed.");
    });

    it("should handle multiple variables", () => {
      const result = interpolateTemplate(
        "Payment of ₹{amount} via {paymentMethod} for order #{orderNumber} was successful.",
        { amount: "500", paymentMethod: "UPI", orderNumber: "ORD-001" }
      );
      expect(result).toBe("Payment of ₹500 via UPI for order #ORD-001 was successful.");
    });

    it("should replace missing variables with empty string", () => {
      const result = interpolateTemplate(
        "Your order #{orderNumber} has been confirmed. Estimated delivery: {estimatedDelivery}.",
        { orderNumber: "12345" }
      );
      expect(result).toBe("Your order #12345 has been confirmed. Estimated delivery: .");
    });

    it("should log a warning for missing variables", () => {
      (logger.warn as jest.Mock).mockClear();

      interpolateTemplate(
        "Hello {userName}, your order #{orderNumber} is ready.",
        { orderNumber: "123" }
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("userName"),
        expect.objectContaining({ variableName: "userName" })
      );
    });

    it("should not log a warning when all variables are present", () => {
      (logger.warn as jest.Mock).mockClear();

      interpolateTemplate(
        "Hello {userName}",
        { userName: "John" }
      );

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should handle numeric values by converting to string", () => {
      const result = interpolateTemplate(
        "Amount: ₹{amount}",
        { amount: 500 }
      );
      expect(result).toBe("Amount: ₹500");
    });

    it("should handle null values as missing (empty string fallback)", () => {
      (logger.warn as jest.Mock).mockClear();

      const result = interpolateTemplate(
        "Value: {someField}",
        { someField: null }
      );
      expect(result).toBe("Value: ");
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should handle undefined values as missing (empty string fallback)", () => {
      (logger.warn as jest.Mock).mockClear();

      const result = interpolateTemplate(
        "Value: {someField}",
        { someField: undefined }
      );
      expect(result).toBe("Value: ");
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should handle empty data object", () => {
      (logger.warn as jest.Mock).mockClear();

      const result = interpolateTemplate(
        "Hello {name}",
        {}
      );
      expect(result).toBe("Hello ");
      expect(logger.warn).toHaveBeenCalled();
    });

    it("should leave non-variable text unchanged", () => {
      const result = interpolateTemplate(
        "No variables here, just plain text!",
        { someKey: "value" }
      );
      expect(result).toBe("No variables here, just plain text!");
    });

    it("should handle templates with no variables", () => {
      const result = interpolateTemplate("Static notification title", {});
      expect(result).toBe("Static notification title");
    });

    it("should work with full template resolution flow", () => {
      const template = resolveTemplate("ORDER_DELIVERED", "customer");
      expect(template).not.toBeNull();

      const title = interpolateTemplate(template!.title, { orderNumber: "ORD-999" });
      const body = interpolateTemplate(template!.body, { orderNumber: "ORD-999" });
      const deepLink = interpolateTemplate(template!.deepLinkPattern, { orderId: "abc123" });

      expect(title).toBe("Order Delivered");
      expect(body).toBe("Your order #ORD-999 has been delivered. We'd love your feedback!");
      expect(deepLink).toBe("/orders/abc123");
    });
  });

  describe("defaultTitleForEvent()", () => {
    it("should return 'Order placed successfully' for ORDER_CREATED", () => {
      expect(defaultTitleForEvent("ORDER_CREATED")).toBe("Order placed successfully");
    });

    it("should replace underscores with spaces for other event types", () => {
      expect(defaultTitleForEvent("ORDER_CONFIRMED")).toBe("ORDER CONFIRMED");
      expect(defaultTitleForEvent("PAYMENT_SUCCESS")).toBe("PAYMENT SUCCESS");
      expect(defaultTitleForEvent("SOME_UNKNOWN_EVENT")).toBe("SOME UNKNOWN EVENT");
    });
  });

  describe("Template Content Validation", () => {
    it("ORDER_FAILED customer template should include failureReason variable", () => {
      const template = resolveTemplate("ORDER_FAILED", "customer");
      expect(template!.body).toContain("{failureReason}");
    });

    it("ORDER_CANCELLED customer template should include cancellationReason variable", () => {
      const template = resolveTemplate("ORDER_CANCELLED", "customer");
      expect(template!.body).toContain("{cancellationReason}");
    });

    it("DELIVERY_ASSIGNED delivery_partner template should include pickup info", () => {
      const template = resolveTemplate("DELIVERY_ASSIGNED", "delivery_partner");
      expect(template!.body).toContain("{pickupAddress}");
    });

    it("EARNINGS_CREDITED template should include amount and balance", () => {
      const template = resolveTemplate("EARNINGS_CREDITED", "delivery_partner");
      expect(template!.body).toContain("{amount}");
      expect(template!.body).toContain("{totalBalance}");
    });

    it("deep link patterns should contain variable placeholders", () => {
      const orderTemplate = resolveTemplate("ORDER_CREATED", "customer");
      expect(orderTemplate!.deepLinkPattern).toContain("{orderId}");

      const adminOrderTemplate = resolveTemplate("ORDER_CREATED", "admin");
      expect(adminOrderTemplate!.deepLinkPattern).toContain("{orderId}");
    });
  });
});
