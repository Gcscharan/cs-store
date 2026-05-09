/**
 * Unit tests for DeliverySocketEmitter and emitWithRetry
 * Task 3.3 — Requirements: 1.6, 1.7, 1.8, 1.9, 1b.3
 * Task 4.1 — Requirements: 6.7, 6.8
 */

import { jest } from "@jest/globals";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockFindByIdAndUpdate = jest.fn();
const mockCreate = jest.fn();

jest.mock("../../../../models/Order", () => ({
  Order: {
    findByIdAndUpdate: (...args: any[]) => mockFindByIdAndUpdate(...args),
  },
}));

jest.mock("../../../../models/DeliverySocketEvent", () => ({
  DeliverySocketEvent: {
    create: (...args: any[]) => mockCreate(...args),
  },
}));

jest.mock("../../../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { DeliverySocketEmitter, emitWithRetry, socketMetrics } from "../deliverySocketEmitter";
import { logger } from "../../../../utils/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIo() {
  const emitFn = jest.fn();
  const toFn = jest.fn().mockReturnValue({ emit: emitFn });
  return { to: toFn, emit: emitFn, _toFn: toFn, _emitFn: emitFn } as any;
}

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    _id: "order-123",
    userId: "user-456",
    deliveryBoyId: "rider-789",
    orderStatus: "PICKED_UP",
    deliveryStatus: "picked_up",
    paymentMethod: "cod",
    ...overrides,
  };
}

const defaultOptions = {
  codCollected: false,
  isNext: true,
  riderHasLocation: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DeliverySocketEmitter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // findByIdAndUpdate returns a query-like object with .lean()
    mockFindByIdAndUpdate.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ socketVersion: 1 }),
    });
    mockCreate.mockResolvedValue({});
  });

  // -------------------------------------------------------------------------
  // emitStatusChanged
  // -------------------------------------------------------------------------

  describe("emitStatusChanged", () => {
    it("emits to all three rooms when both deliveryBoyId and userId are present", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder();

      await emitter.emitStatusChanged({
        order,
        previousStatus: "ASSIGNED",
        options: defaultOptions,
      });

      const calledRooms = io._toFn.mock.calls.map((c: any[]) => c[0]);
      expect(calledRooms).toContain("delivery:rider-789");
      expect(calledRooms).toContain("admin_room");
      expect(calledRooms).toContain("order:user-456");
    });

    it("skips delivery: room and logs warn when deliveryBoyId is null", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder({ deliveryBoyId: null });

      await emitter.emitStatusChanged({
        order,
        previousStatus: "ASSIGNED",
        options: defaultOptions,
      });

      const calledRooms = io._toFn.mock.calls.map((c: any[]) => c[0]);
      expect(calledRooms).not.toContain(expect.stringMatching(/^delivery:/));
      expect(calledRooms).toContain("admin_room");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("deliveryBoyId is null"),
        expect.any(Object)
      );
    });

    it("skips order: room and logs warn when userId is null", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder({ userId: null });

      await emitter.emitStatusChanged({
        order,
        previousStatus: "ASSIGNED",
        options: defaultOptions,
      });

      const calledRooms = io._toFn.mock.calls.map((c: any[]) => c[0]);
      expect(calledRooms).not.toContain(expect.stringMatching(/^order:/));
      expect(calledRooms).toContain("admin_room");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("userId is null"),
        expect.any(Object)
      );
    });

    it("persists to DeliverySocketEvent asynchronously (fire-and-forget)", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder();

      await emitter.emitStatusChanged({
        order,
        previousStatus: "ASSIGNED",
        options: defaultOptions,
      });

      // create() is called (fire-and-forget — we don't await it)
      expect(mockCreate).toHaveBeenCalledTimes(1);
      const createArg = mockCreate.mock.calls[0][0] as any;
      expect(String(createArg.orderId)).toBe("order-123");
      expect(createArg.eventName).toBe("order:status:changed");
    });

    it("does not throw when DeliverySocketEvent.create() fails", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder();

      mockCreate.mockReturnValue(Promise.reject(new Error("DB error")));

      // Should not throw
      await expect(
        emitter.emitStatusChanged({
          order,
          previousStatus: "ASSIGNED",
          options: defaultOptions,
        })
      ).resolves.toBeUndefined();

      // Wait a tick for the fire-and-forget promise to settle
      await new Promise((r) => setImmediate(r));

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to persist DeliverySocketEvent"),
        expect.any(Object)
      );
    });

    it("increments socketVersion via $inc on the Order document", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder();

      await emitter.emitStatusChanged({
        order,
        previousStatus: "ASSIGNED",
        options: defaultOptions,
      });

      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        "order-123",
        { $inc: { socketVersion: 1 } },
        { new: true, select: "socketVersion" }
      );
    });

    it("includes the incremented version in the emitted payload", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder();

      mockFindByIdAndUpdate.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ socketVersion: 5 }),
      });

      await emitter.emitStatusChanged({
        order,
        previousStatus: "ASSIGNED",
        options: defaultOptions,
      });

      const emitCall = io._emitFn.mock.calls[0] as any[];
      const payload = emitCall[1] as any;
      expect(payload.version).toBe(5);
    });

    it("logs at info level after emission", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder();

      await emitter.emitStatusChanged({
        order,
        previousStatus: "ASSIGNED",
        options: defaultOptions,
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("emitStatusChanged"),
        expect.objectContaining({
          eventName: "order:status:changed",
          orderId: "order-123",
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // emitOrderCancelled
  // -------------------------------------------------------------------------

  describe("emitOrderCancelled", () => {
    it("emits order:cancelled to delivery room and admin_room", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);

      await emitter.emitOrderCancelled({
        orderId: "order-123",
        riderId: "rider-789",
        reason: "customer request",
      });

      const calledRooms = io._toFn.mock.calls.map((c: any[]) => c[0]);
      expect(calledRooms).toContain("delivery:rider-789");
      expect(calledRooms).toContain("admin_room");
    });

    it("skips delivery room and logs warn when riderId is null", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);

      await emitter.emitOrderCancelled({
        orderId: "order-123",
        riderId: null,
      });

      const calledRooms = io._toFn.mock.calls.map((c: any[]) => c[0]);
      expect(calledRooms).not.toContain(expect.stringMatching(/^delivery:/));
      expect(calledRooms).toContain("admin_room");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("riderId is null"),
        expect.any(Object)
      );
    });
  });

  // -------------------------------------------------------------------------
  // emitOrderReassigned
  // -------------------------------------------------------------------------

  describe("emitOrderReassigned", () => {
    it("emits order:reassigned to the old rider's room only", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);

      await emitter.emitOrderReassigned({
        orderId: "order-123",
        oldRiderId: "rider-old",
        newRiderId: "rider-new",
      });

      const calledRooms = io._toFn.mock.calls.map((c: any[]) => c[0]);
      expect(calledRooms).toContain("delivery:rider-old");
      expect(calledRooms).not.toContain("delivery:rider-new");
    });
  });

  // -------------------------------------------------------------------------
  // emitOrderAssigned
  // -------------------------------------------------------------------------

  describe("emitOrderAssigned", () => {
    it("emits order:assigned to admin_room", async () => {
      const io = makeIo();
      // emitWithRetry uses io.to(room).timeout(5000).emit() — mock the chain
      const ackEmit = jest.fn((_event: any, _payload: any, cb: any) => cb(null));
      const timeoutObj = { emit: ackEmit };
      const toFn = jest.fn().mockReturnValue({
        emit: jest.fn(),
        timeout: jest.fn().mockReturnValue(timeoutObj),
      });
      io.to = toFn;

      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder();

      await emitter.emitOrderAssigned({ order, options: defaultOptions });

      const calledRooms = toFn.mock.calls.map((c: any[]) => c[0]);
      expect(calledRooms).toContain("admin_room");
    });

    it("logs warn and skips delivery room when riderId is null", async () => {
      const io = makeIo();
      const emitter = new DeliverySocketEmitter(io);
      const order = makeOrder({ deliveryBoyId: null });

      await emitter.emitOrderAssigned({ order, options: defaultOptions });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("riderId is null"),
        expect.any(Object)
      );
    });
  });
});

// ---------------------------------------------------------------------------
// emitWithRetry — Task 4.1 (Requirements: 6.7, 6.8)
// ---------------------------------------------------------------------------

/**
 * Helper: build a mock `io` whose `.to(room).timeout(5000).emit()` invokes
 * the ACK callback synchronously with the given result sequence.
 *
 * `ackResults` is an array of booleans: `true` = ACK received (no error),
 * `false` = timeout / no ACK (err is set).
 *
 * The ACK callback is called synchronously so we don't need to advance timers
 * for the ACK resolution — only for the backoff delays between retries.
 */
function makeRetryIo(ackResults: boolean[]) {
  let callIndex = 0;
  const ackEmit = jest.fn((_event: any, _payload: any, cb: (err: any) => void) => {
    const acked = ackResults[callIndex++] ?? false;
    // Call synchronously — avoids needing to flush microtasks for ACK
    cb(acked ? null : new Error("timeout"));
  });
  const timeoutObj = { emit: ackEmit };
  const toFn = jest.fn().mockReturnValue({
    timeout: jest.fn().mockReturnValue(timeoutObj),
    emit: jest.fn(),
  });
  return { io: { to: toFn } as any, ackEmit, toFn };
}

/**
 * Patch emitWithRetry to use zero-delay backoffs so tests run instantly.
 * We do this by replacing the internal setTimeout-based delay with an
 * immediate resolution. Since we can't easily patch the module internals,
 * we instead use jest.useFakeTimers + runAllTimersAsync.
 */
describe("emitWithRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (socketMetrics as any).ackRetriesPerMin = 0;
    (socketMetrics as any).totalAckFailures = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves immediately on first ACK without retrying", async () => {
    const { io, ackEmit } = makeRetryIo([true]);

    // ACK fires synchronously, so no timer advancement needed
    await emitWithRetry(io, "delivery:rider-1", "order:assigned", { orderId: "o1" });

    expect(ackEmit).toHaveBeenCalledTimes(1);
    expect(socketMetrics.ackRetriesPerMin).toBe(0);
    expect(socketMetrics.totalAckFailures).toBe(0);
  });

  it("retries up to 3 times on no-ACK and logs warn after exhaustion", async () => {
    const { io, ackEmit } = makeRetryIo([false, false, false, false]);

    // Start the retry loop — it will pause at each backoff setTimeout
    const promise = emitWithRetry(io, "delivery:rider-1", "order:assigned", { orderId: "o1" });

    // Run all pending timers (backoff delays) until the promise resolves
    await jest.runAllTimersAsync();
    await promise;

    // 4 total emit calls: initial + 3 retries
    expect(ackEmit).toHaveBeenCalledTimes(4);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("max retries reached"),
      expect.objectContaining({ room: "delivery:rider-1", eventName: "order:assigned", orderId: "o1" })
    );
    expect(socketMetrics.totalAckFailures).toBe(1);
  });

  it("increments ackRetriesPerMin counter on each retry attempt", async () => {
    const { io } = makeRetryIo([false, false, false, false]);

    const promise = emitWithRetry(io, "delivery:rider-1", "order:assigned", { orderId: "o1" });
    await jest.runAllTimersAsync();
    await promise;

    // 3 retries → ackRetriesPerMin incremented 3 times
    expect(socketMetrics.ackRetriesPerMin).toBe(3);
  });

  it("stops retrying as soon as an ACK is received (second attempt succeeds)", async () => {
    const { io, ackEmit } = makeRetryIo([false, true]);

    const promise = emitWithRetry(io, "delivery:rider-1", "order:assigned", { orderId: "o1" });
    await jest.runAllTimersAsync();
    await promise;

    // Only 2 emit calls: initial (fail) + first retry (success)
    expect(ackEmit).toHaveBeenCalledTimes(2);
    expect(socketMetrics.totalAckFailures).toBe(0);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("uses io.to(room).timeout(5000).emit() for each attempt", async () => {
    const { io, toFn } = makeRetryIo([true]);

    await emitWithRetry(io, "delivery:rider-99", "order:assigned", { orderId: "o2" });

    expect(toFn).toHaveBeenCalledWith("delivery:rider-99");
    const timeoutFn = toFn.mock.results[0].value.timeout;
    expect(timeoutFn).toHaveBeenCalledWith(5000);
  });

  it("uses the correct exponential backoff delays: 1s, 3s, 5s", async () => {
    const { io } = makeRetryIo([false, false, false, false]);
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");

    const promise = emitWithRetry(io, "delivery:rider-1", "order:assigned", { orderId: "o1" });
    await jest.runAllTimersAsync();
    await promise;

    // Extract delay values passed to setTimeout that match the backoff schedule
    const backoffDelays = setTimeoutSpy.mock.calls
      .map((c) => c[1] as number)
      .filter((d) => [1000, 3000, 5000].includes(d));

    expect(backoffDelays).toEqual(expect.arrayContaining([1000, 3000, 5000]));
  });
});
