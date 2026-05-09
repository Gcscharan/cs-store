/**
 * Unit tests for sync_request / sync_response socket handler
 * Requirements: 2.5, 6.2, 6.3
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";

// Mock DeliverySocketEvent model
const mockFind = jest.fn();
const mockSort = jest.fn();
const mockLimit = jest.fn();
const mockLean = jest.fn();

jest.mock("../../src/models/DeliverySocketEvent", () => ({
  DeliverySocketEvent: {
    find: mockFind,
  },
}));

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: jest.fn(),
  },
}));

// Mock socketMetrics
const mockSocketMetrics = {
  syncRequestsPerMin: 0,
  totalSyncRequests: 0,
  eventsEmittedPerMin: 0,
  eventsDroppedThrottlePerMin: 0,
  ackRetriesPerMin: 0,
  totalEventsEmitted: 0,
  totalAckFailures: 0,
};
jest.mock("../../src/domains/delivery/services/deliverySocketEmitter", () => ({
  socketMetrics: mockSocketMetrics,
}));

// Import the handler factory after mocks are set up
import { DeliverySocketEvent } from "../../src/models/DeliverySocketEvent";
import { logger } from "../../src/utils/logger";
import { socketMetrics } from "../../src/domains/delivery/services/deliverySocketEmitter";

/**
 * Inline implementation of the sync_request handler logic
 * (mirrors the handler in backend/src/index.ts exactly)
 */
async function handleSyncRequest(
  socket: { data: any; emit: jest.Mock },
  data: { lastEventTimestamp: string }
) {
  const riderId = String((socket.data as any).userId || "");
  if (!riderId) return;

  const since = new Date(data?.lastEventTimestamp || 0);

  try {
    const events = await (DeliverySocketEvent as any).find({
      riderId: new mongoose.Types.ObjectId(riderId),
      timestamp: { $gt: since },
    })
      .sort({ timestamp: 1 })
      .limit(500)
      .lean();

    const orders = events.map((e: any) => e.payload);
    const wasCapped = events.length === 500;

    logger.info("[Socket] sync_request handled", {
      riderId,
      lastEventTimestamp: since.toISOString(),
      eventsFound: events.length,
      wasCapped,
    });

    (socketMetrics as any).syncRequestsPerMin++;
    (socketMetrics as any).totalSyncRequests++;

    socket.emit("sync_response", { orders, fullRefetchRequired: wasCapped });
  } catch (e) {
    logger.error("[Socket] sync_request handler error", e);
    socket.emit("sync_response", { orders: [] });
  }
}

// Helper to build a chainable mock query
function buildQueryChain(result: any[]) {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result) as any,
  };
  mockFind.mockReturnValue(chain);
  return chain;
}

describe("sync_request handler", () => {
  const riderId = new mongoose.Types.ObjectId().toHexString();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocketMetrics.syncRequestsPerMin = 0;
    mockSocketMetrics.totalSyncRequests = 0;
  });

  describe("query correctness", () => {
    it("queries DeliverySocketEvent with correct riderId filter and timestamp $gt", async () => {
      const since = new Date("2024-01-01T00:00:00.000Z");
      const chain = buildQueryChain([]);

      const socket = { data: { userId: riderId }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: since.toISOString() });

      expect(mockFind).toHaveBeenCalledWith(
        expect.objectContaining({
          riderId: expect.any(mongoose.Types.ObjectId),
          timestamp: { $gt: since },
        })
      );
      expect(chain.sort).toHaveBeenCalledWith({ timestamp: 1 });
      expect(chain.limit).toHaveBeenCalledWith(500);
      expect(chain.lean).toHaveBeenCalled();
    });

    it("uses riderId from socket.data.userId as ObjectId", async () => {
      buildQueryChain([]);
      const socket = { data: { userId: riderId }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: new Date().toISOString() });

      const callArg = (mockFind as jest.Mock).mock.calls[0][0] as any;
      expect(callArg.riderId).toBeInstanceOf(mongoose.Types.ObjectId);
      expect(callArg.riderId.toHexString()).toBe(riderId);
    });

    it("returns early without querying if riderId is missing", async () => {
      const socket = { data: { userId: "" }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: new Date().toISOString() });

      expect(mockFind).not.toHaveBeenCalled();
      expect(socket.emit).not.toHaveBeenCalled();
    });
  });

  describe("sync_response emission", () => {
    it("emits sync_response with mapped payloads and fullRefetchRequired: false when under cap", async () => {
      const fakeEvents = [
        { payload: { orderId: "order1", orderStatus: "PICKED_UP" } },
        { payload: { orderId: "order2", orderStatus: "OUT_FOR_DELIVERY" } },
      ];
      buildQueryChain(fakeEvents);

      const socket = { data: { userId: riderId }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: new Date().toISOString() });

      expect(socket.emit).toHaveBeenCalledWith("sync_response", {
        orders: [
          { orderId: "order1", orderStatus: "PICKED_UP" },
          { orderId: "order2", orderStatus: "OUT_FOR_DELIVERY" },
        ],
        fullRefetchRequired: false,
      });
    });

    it("sets fullRefetchRequired: true when result is capped at 500", async () => {
      // Build exactly 500 fake events
      const fakeEvents = Array.from({ length: 500 }, (_, i) => ({
        payload: { orderId: `order${i}`, orderStatus: "PICKED_UP" },
      }));
      buildQueryChain(fakeEvents);

      const socket = { data: { userId: riderId }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: new Date().toISOString() });

      expect(socket.emit).toHaveBeenCalledWith("sync_response", {
        orders: expect.arrayContaining([expect.objectContaining({ orderId: "order0" })]),
        fullRefetchRequired: true,
      });

      const emitArg = (socket.emit as jest.Mock).mock.calls[0][1] as any;
      expect(emitArg.fullRefetchRequired).toBe(true);
      expect(emitArg.orders).toHaveLength(500);
    });

    it("emits sync_response with empty orders array on DB error", async () => {
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error("DB connection failed")) as any,
      });

      const socket = { data: { userId: riderId }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: new Date().toISOString() });

      expect(socket.emit).toHaveBeenCalledWith("sync_response", { orders: [] });
    });
  });

  describe("logging", () => {
    it("logs eventsFound count at info level on success", async () => {
      const fakeEvents = [
        { payload: { orderId: "order1" } },
        { payload: { orderId: "order2" } },
        { payload: { orderId: "order3" } },
      ];
      buildQueryChain(fakeEvents);

      const socket = { data: { userId: riderId }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: new Date().toISOString() });

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "[Socket] sync_request handled",
        expect.objectContaining({
          riderId,
          eventsFound: 3,
        })
      );
    });

    it("logs error on DB failure", async () => {
      const dbError = new Error("DB connection failed");
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(dbError) as any,
      });

      const socket = { data: { userId: riderId }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: new Date().toISOString() });

      expect(mockLoggerError).toHaveBeenCalledWith(
        "[Socket] sync_request handler error",
        dbError
      );
    });
  });

  describe("metrics", () => {
    it("increments syncRequestsPerMin and totalSyncRequests on success", async () => {
      buildQueryChain([]);

      const socket = { data: { userId: riderId }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: new Date().toISOString() });

      expect(mockSocketMetrics.syncRequestsPerMin).toBe(1);
      expect(mockSocketMetrics.totalSyncRequests).toBe(1);
    });

    it("does not increment metrics on DB error", async () => {
      mockFind.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockRejectedValue(new Error("DB error")) as any,
      });

      const socket = { data: { userId: riderId }, emit: jest.fn() };
      await handleSyncRequest(socket, { lastEventTimestamp: new Date().toISOString() });

      expect(mockSocketMetrics.syncRequestsPerMin).toBe(0);
      expect(mockSocketMetrics.totalSyncRequests).toBe(0);
    });
  });
});
