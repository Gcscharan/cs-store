import {
  createDeliveryPickupReminderEvent,
  createDeliveryOtpGeneratedEvent,
  createDeliveryCompletedEvent,
  createEarningsCreditedEvent,
  createEarningsDailySummaryEvent,
  createPerformanceMilestoneEvent,
  createCodSettlementReminderEvent,
  DeliveryEvent,
} from "../../../src/domains/events/delivery.events";

describe("Delivery Event Factory Functions", () => {
  const baseParams = {
    source: "deliveryOrderController",
    actor: { type: "delivery" as const, id: "rider-123" },
    userId: "rider-123",
  };

  describe("createDeliveryPickupReminderEvent", () => {
    it("should create event with correct eventType", () => {
      const event = createDeliveryPickupReminderEvent({
        ...baseParams,
        orderId: "order-456",
      });

      expect(event.eventType).toBe("DELIVERY_PICKUP_REMINDER");
      expect(event.version).toBe(1);
      expect(event.data.userId).toBe("rider-123");
      expect(event.data.orderId).toBe("order-456");
      expect(event.source).toBe("deliveryOrderController");
      expect(event.actor).toEqual({ type: "delivery", id: "rider-123" });
    });

    it("should generate eventId and occurredAt when not provided", () => {
      const event = createDeliveryPickupReminderEvent(baseParams);

      expect(event.eventId).toBeDefined();
      expect(event.eventId.length).toBeGreaterThan(0);
      expect(event.occurredAt).toBeDefined();
      expect(new Date(event.occurredAt).getTime()).not.toBeNaN();
    });

    it("should use provided eventId and occurredAt", () => {
      const event = createDeliveryPickupReminderEvent({
        ...baseParams,
        eventId: "custom-id",
        occurredAt: "2024-01-01T00:00:00.000Z",
      });

      expect(event.eventId).toBe("custom-id");
      expect(event.occurredAt).toBe("2024-01-01T00:00:00.000Z");
    });
  });

  describe("createDeliveryOtpGeneratedEvent", () => {
    it("should create event with OTP data", () => {
      const event = createDeliveryOtpGeneratedEvent({
        ...baseParams,
        orderId: "order-789",
        otp: "1234",
      });

      expect(event.eventType).toBe("DELIVERY_OTP_GENERATED");
      expect(event.data.userId).toBe("rider-123");
      expect(event.data.orderId).toBe("order-789");
      expect(event.data.otp).toBe("1234");
    });

    it("should not include otp field when not provided", () => {
      const event = createDeliveryOtpGeneratedEvent({
        ...baseParams,
        orderId: "order-789",
      });

      expect(event.data.otp).toBeUndefined();
    });
  });

  describe("createDeliveryCompletedEvent", () => {
    it("should create event with earnings data", () => {
      const event = createDeliveryCompletedEvent({
        ...baseParams,
        orderId: "order-111",
        amount: 50,
        totalEarnings: 5000,
      });

      expect(event.eventType).toBe("DELIVERY_COMPLETED");
      expect(event.data.userId).toBe("rider-123");
      expect(event.data.orderId).toBe("order-111");
      expect(event.data.amount).toBe(50);
      expect(event.data.totalEarnings).toBe(5000);
    });

    it("should handle zero amount", () => {
      const event = createDeliveryCompletedEvent({
        ...baseParams,
        orderId: "order-111",
        amount: 0,
        totalEarnings: 0,
      });

      expect(event.data.amount).toBe(0);
      expect(event.data.totalEarnings).toBe(0);
    });
  });

  describe("createEarningsCreditedEvent", () => {
    it("should create event with amount and totalEarnings", () => {
      const event = createEarningsCreditedEvent({
        ...baseParams,
        orderId: "order-222",
        amount: 75,
        totalEarnings: 10000,
      });

      expect(event.eventType).toBe("EARNINGS_CREDITED");
      expect(event.data.userId).toBe("rider-123");
      expect(event.data.orderId).toBe("order-222");
      expect(event.data.amount).toBe(75);
      expect(event.data.totalEarnings).toBe(10000);
    });

    it("should not include optional fields when not provided", () => {
      const event = createEarningsCreditedEvent(baseParams);

      expect(event.data.orderId).toBeUndefined();
      expect(event.data.amount).toBeUndefined();
      expect(event.data.totalEarnings).toBeUndefined();
    });
  });

  describe("createEarningsDailySummaryEvent", () => {
    it("should create event with daily summary data", () => {
      const event = createEarningsDailySummaryEvent({
        ...baseParams,
        deliveriesCompleted: 12,
        dailyEarnings: 600,
      });

      expect(event.eventType).toBe("EARNINGS_DAILY_SUMMARY");
      expect(event.data.userId).toBe("rider-123");
      expect(event.data.deliveriesCompleted).toBe(12);
      expect(event.data.dailyEarnings).toBe(600);
    });

    it("should handle zero deliveries and earnings", () => {
      const event = createEarningsDailySummaryEvent({
        ...baseParams,
        deliveriesCompleted: 0,
        dailyEarnings: 0,
      });

      expect(event.data.deliveriesCompleted).toBe(0);
      expect(event.data.dailyEarnings).toBe(0);
    });
  });

  describe("createPerformanceMilestoneEvent", () => {
    it("should create event with milestone count", () => {
      const event = createPerformanceMilestoneEvent({
        ...baseParams,
        milestoneCount: 100,
      });

      expect(event.eventType).toBe("PERFORMANCE_MILESTONE");
      expect(event.data.userId).toBe("rider-123");
      expect(event.data.milestoneCount).toBe(100);
    });

    it("should work with various milestone values", () => {
      const milestones = [10, 25, 50, 100, 250, 500];
      milestones.forEach((count) => {
        const event = createPerformanceMilestoneEvent({
          ...baseParams,
          milestoneCount: count,
        });
        expect(event.data.milestoneCount).toBe(count);
      });
    });
  });

  describe("createCodSettlementReminderEvent", () => {
    it("should create event with COD amount", () => {
      const event = createCodSettlementReminderEvent({
        ...baseParams,
        codAmount: 1500,
      });

      expect(event.eventType).toBe("COD_SETTLEMENT_REMINDER");
      expect(event.data.userId).toBe("rider-123");
      expect(event.data.codAmount).toBe(1500);
    });

    it("should not include codAmount when not provided", () => {
      const event = createCodSettlementReminderEvent(baseParams);

      expect(event.data.codAmount).toBeUndefined();
    });
  });

  describe("Common event structure", () => {
    it("should produce events conforming to BaseEvent structure", () => {
      const event: DeliveryEvent = createDeliveryCompletedEvent({
        ...baseParams,
        orderId: "order-test",
        amount: 100,
      });

      // Validate BaseEvent fields
      expect(event).toHaveProperty("eventId");
      expect(event).toHaveProperty("eventType");
      expect(event).toHaveProperty("version");
      expect(event).toHaveProperty("occurredAt");
      expect(event).toHaveProperty("actor");
      expect(event).toHaveProperty("source");
      expect(event).toHaveProperty("data");
      expect(event.version).toBe(1);
    });

    it("should not include undefined optional data fields", () => {
      const event = createDeliveryCompletedEvent({
        ...baseParams,
        orderId: "order-test",
      });

      // Only userId and orderId should be present
      expect(Object.keys(event.data)).toEqual(
        expect.arrayContaining(["userId", "orderId"])
      );
      expect(event.data).not.toHaveProperty("amount");
      expect(event.data).not.toHaveProperty("totalEarnings");
      expect(event.data).not.toHaveProperty("milestoneCount");
      expect(event.data).not.toHaveProperty("codAmount");
      expect(event.data).not.toHaveProperty("otp");
    });

    it("should support custom title and body in all event types", () => {
      const factories = [
        createDeliveryPickupReminderEvent,
        createDeliveryOtpGeneratedEvent,
        createDeliveryCompletedEvent,
        createEarningsCreditedEvent,
        createEarningsDailySummaryEvent,
        createPerformanceMilestoneEvent,
        createCodSettlementReminderEvent,
      ];

      factories.forEach((factory) => {
        const event = factory({
          ...baseParams,
          title: "Custom Title",
          body: "Custom Body",
        });

        expect(event.data.title).toBe("Custom Title");
        expect(event.data.body).toBe("Custom Body");
      });
    });
  });
});
