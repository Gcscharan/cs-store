/**
 * Unit tests for OrderEventBroadcaster
 * Requirements: 1.5, 1.6
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";

// ── Mock DeliverySocketEmitter ──────────────────────────────────────────────
const mockEmitStatusChanged = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

jest.mock("../../src/domains/delivery/services/deliverySocketEmitter", () => ({
  DeliverySocketEmitter: jest.fn().mockImplementation(() => ({
    emitStatusChanged: mockEmitStatusChanged,
  })),
}));

// ── Mock Order model ────────────────────────────────────────────────────────
const mockOrderFindById = jest.fn();

jest.mock("../../src/models/Order", () => ({
  Order: {
    findById: mockOrderFindById,
  },
}));

// ── Mock OrderEvent model ───────────────────────────────────────────────────
jest.mock("../../src/models/OrderEvent", () => ({
  OrderEvent: {
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    }),
    updateOne: jest.fn().mockResolvedValue({}),
  },
}));

// ── Mock logger ─────────────────────────────────────────────────────────────
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: jest.fn(),
  },
}));

import { OrderEventBroadcaster } from "../../src/domains/orders/services/orderEventBroadcaster";
import { DeliverySocketEmitter } from "../../src/domains/delivery/services/deliverySocketEmitter";

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildMockIo() {
  return {} as any;
}

function buildOrder(overrides: Partial<{ userId: string | null; deliveryBoyId: string | null }> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    userId: overrides.userId !== undefined ? overrides.userId : new mongoose.Types.ObjectId().toHexString(),
    deliveryBoyId: overrides.deliveryBoyId !== undefined ? overrides.deliveryBoyId : new mongoose.Types.ObjectId().toHexString(),
    deliveryPartnerId: null,
  };
}

function buildSelectLeanChain(result: any) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result) as any,
  };
  mockOrderFindById.mockReturnValue(chain);
  return chain;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("OrderEventBroadcaster", () => {
  const orderId = new mongoose.Types.ObjectId().toHexString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("broadcastOrderStatusChanged", () => {
    it("emits to all three rooms via DeliverySocketEmitter when both IDs are present", async () => {
      const order = buildOrder();
      buildSelectLeanChain(order);

      const broadcaster = new OrderEventBroadcaster(buildMockIo());
      await broadcaster.broadcastOrderStatusChanged({
        orderId,
        from: "ASSIGNED" as any,
        to: "PICKED_UP" as any,
        actorRole: "DELIVERY_PARTNER",
        actorId: "actor1",
        timestamp: new Date(),
      });

      expect(DeliverySocketEmitter).toHaveBeenCalledWith(expect.anything());
      expect(mockEmitStatusChanged).toHaveBeenCalledTimes(1);
      expect(mockEmitStatusChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          order,
          previousStatus: "ASSIGNED",
          options: expect.objectContaining({
            codCollected: false,
            isNext: true,
            riderHasLocation: false,
          }),
        })
      );
    });

    it("handles null deliveryBoyId gracefully — does not throw", async () => {
      const order = buildOrder({ deliveryBoyId: null });
      buildSelectLeanChain(order);

      const broadcaster = new OrderEventBroadcaster(buildMockIo());

      await expect(
        broadcaster.broadcastOrderStatusChanged({
          orderId,
          from: "ASSIGNED" as any,
          to: "PICKED_UP" as any,
          actorRole: "DELIVERY_PARTNER",
          actorId: "actor1",
          timestamp: new Date(),
        })
      ).resolves.not.toThrow();

      // emitStatusChanged is still called — DeliverySocketEmitter handles null internally
      expect(mockEmitStatusChanged).toHaveBeenCalledTimes(1);
    });

    it("handles null userId gracefully — does not throw", async () => {
      const order = buildOrder({ userId: null });
      buildSelectLeanChain(order);

      const broadcaster = new OrderEventBroadcaster(buildMockIo());

      await expect(
        broadcaster.broadcastOrderStatusChanged({
          orderId,
          from: "ASSIGNED" as any,
          to: "IN_TRANSIT" as any,
          actorRole: "DELIVERY_PARTNER",
          actorId: "actor1",
          timestamp: new Date(),
        })
      ).resolves.not.toThrow();

      expect(mockEmitStatusChanged).toHaveBeenCalledTimes(1);
    });

    it("does not call emitStatusChanged when order is not found", async () => {
      buildSelectLeanChain(null);

      const broadcaster = new OrderEventBroadcaster(buildMockIo());
      await broadcaster.broadcastOrderStatusChanged({
        orderId,
        from: "ASSIGNED" as any,
        to: "PICKED_UP" as any,
        actorRole: "ADMIN",
        actorId: "admin1",
        timestamp: new Date(),
      });

      expect(mockEmitStatusChanged).not.toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("not found")
      );
    });

    it("catches and logs errors from emitStatusChanged without rethrowing", async () => {
      const order = buildOrder();
      buildSelectLeanChain(order);
      mockEmitStatusChanged.mockRejectedValueOnce(new Error("socket failure"));

      const broadcaster = new OrderEventBroadcaster(buildMockIo());

      await expect(
        broadcaster.broadcastOrderStatusChanged({
          orderId,
          from: "ASSIGNED" as any,
          to: "PICKED_UP" as any,
          actorRole: "DELIVERY_PARTNER",
          actorId: "actor1",
          timestamp: new Date(),
        })
      ).resolves.not.toThrow();

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining("Error broadcasting event"),
        expect.any(Error)
      );
    });

    it("passes previousStatus as the 'from' OrderStatus value", async () => {
      const order = buildOrder();
      buildSelectLeanChain(order);

      const broadcaster = new OrderEventBroadcaster(buildMockIo());
      await broadcaster.broadcastOrderStatusChanged({
        orderId,
        from: "IN_TRANSIT" as any,
        to: "ARRIVED" as any,
        actorRole: "DELIVERY_PARTNER",
        actorId: "actor1",
        timestamp: new Date(),
      });

      const callArg = mockEmitStatusChanged.mock.calls[0][0] as any;
      expect(callArg.previousStatus).toBe("IN_TRANSIT");
    });
  });
});
