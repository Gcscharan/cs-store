import {
  calculateNextRetryAt,
  enqueuePushRetry,
  _tick,
  _processRetry,
  _resetWorker,
  initializePushRetryWorker,
  stopPushRetryWorker,
  RETRY_INTERVALS_MS,
  MAX_RETRY_ATTEMPTS,
  POLL_INTERVAL_MS,
} from "../../../src/domains/communication/services/pushRetryWorker";
import PushRetry from "../../../src/models/PushRetry";
import Notification from "../../../src/models/Notification";

// Mock PushRetry model
jest.mock("../../../src/models/PushRetry", () => {
  const mockCreate = jest.fn();
  const mockFind = jest.fn();
  const mockUpdateOne = jest.fn();

  return {
    __esModule: true,
    default: {
      create: mockCreate,
      find: mockFind,
      updateOne: mockUpdateOne,
    },
  };
});

// Mock Notification model
jest.mock("../../../src/models/Notification", () => ({
  __esModule: true,
  default: {
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  },
}));

// Mock pushGateway
jest.mock("../../../src/domains/communication/services/pushGateway", () => ({
  sendPush: jest.fn(),
}));

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    opsAlert: jest.fn(),
  },
}));

import { sendPush } from "../../../src/domains/communication/services/pushGateway";

const mockSendPush = sendPush as jest.Mock;
const mockPushRetryCreate = (PushRetry as any).create as jest.Mock;
const mockPushRetryFind = (PushRetry as any).find as jest.Mock;
const mockPushRetryUpdateOne = (PushRetry as any).updateOne as jest.Mock;
const mockNotificationUpdateOne = (Notification as any).updateOne as jest.Mock;

describe("PushRetryWorker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetWorker();
  });

  afterEach(() => {
    _resetWorker();
  });

  describe("calculateNextRetryAt", () => {
    it("should return 1 minute for attempt 0", () => {
      const now = Date.now();
      const result = calculateNextRetryAt(0);
      expect(result).not.toBeNull();
      const diffMs = result!.getTime() - now;
      // Allow 100ms tolerance for test execution time
      expect(diffMs).toBeGreaterThanOrEqual(RETRY_INTERVALS_MS[0] - 100);
      expect(diffMs).toBeLessThanOrEqual(RETRY_INTERVALS_MS[0] + 100);
    });

    it("should return 5 minutes for attempt 1", () => {
      const now = Date.now();
      const result = calculateNextRetryAt(1);
      expect(result).not.toBeNull();
      const diffMs = result!.getTime() - now;
      expect(diffMs).toBeGreaterThanOrEqual(RETRY_INTERVALS_MS[1] - 100);
      expect(diffMs).toBeLessThanOrEqual(RETRY_INTERVALS_MS[1] + 100);
    });

    it("should return 15 minutes for attempt 2", () => {
      const now = Date.now();
      const result = calculateNextRetryAt(2);
      expect(result).not.toBeNull();
      const diffMs = result!.getTime() - now;
      expect(diffMs).toBeGreaterThanOrEqual(RETRY_INTERVALS_MS[2] - 100);
      expect(diffMs).toBeLessThanOrEqual(RETRY_INTERVALS_MS[2] + 100);
    });

    it("should return 30 minutes for attempt 3", () => {
      const now = Date.now();
      const result = calculateNextRetryAt(3);
      expect(result).not.toBeNull();
      const diffMs = result!.getTime() - now;
      expect(diffMs).toBeGreaterThanOrEqual(RETRY_INTERVALS_MS[3] - 100);
      expect(diffMs).toBeLessThanOrEqual(RETRY_INTERVALS_MS[3] + 100);
    });

    it("should return 1 hour for attempt 4", () => {
      const now = Date.now();
      const result = calculateNextRetryAt(4);
      expect(result).not.toBeNull();
      const diffMs = result!.getTime() - now;
      expect(diffMs).toBeGreaterThanOrEqual(RETRY_INTERVALS_MS[4] - 100);
      expect(diffMs).toBeLessThanOrEqual(RETRY_INTERVALS_MS[4] + 100);
    });

    it("should return null when max retries exhausted (attempt >= 5)", () => {
      expect(calculateNextRetryAt(5)).toBeNull();
      expect(calculateNextRetryAt(6)).toBeNull();
      expect(calculateNextRetryAt(10)).toBeNull();
    });

    it("should follow the correct schedule: 1m, 5m, 15m, 30m, 1h", () => {
      expect(RETRY_INTERVALS_MS).toEqual([
        60_000,      // 1 minute
        300_000,     // 5 minutes
        900_000,     // 15 minutes
        1_800_000,   // 30 minutes
        3_600_000,   // 1 hour
      ]);
    });
  });

  describe("enqueuePushRetry", () => {
    it("should create a PushRetry document with correct fields", async () => {
      mockPushRetryCreate.mockResolvedValue({});

      await enqueuePushRetry({
        notificationId: "notif-123",
        userId: "user-456",
        title: "Test Title",
        body: "Test Body",
        data: { orderId: "order-789" },
        error: "Connection timeout",
      });

      expect(mockPushRetryCreate).toHaveBeenCalledTimes(1);
      const createArg = mockPushRetryCreate.mock.calls[0][0];
      expect(createArg.notificationId).toBe("notif-123");
      expect(createArg.userId).toBe("user-456");
      expect(createArg.title).toBe("Test Title");
      expect(createArg.body).toBe("Test Body");
      expect(createArg.data).toEqual({ orderId: "order-789" });
      expect(createArg.attempts).toBe(0);
      expect(createArg.lastError).toBe("Connection timeout");
      expect(createArg.status).toBe("pending");
      expect(createArg.nextAttemptAt).toBeInstanceOf(Date);
    });

    it("should set nextAttemptAt to 1 minute from now for first retry", async () => {
      mockPushRetryCreate.mockResolvedValue({});
      const before = Date.now();

      await enqueuePushRetry({
        notificationId: "notif-123",
        userId: "user-456",
        title: "Test",
        body: "Body",
        error: "Some error",
      });

      const createArg = mockPushRetryCreate.mock.calls[0][0];
      const nextAttemptTime = createArg.nextAttemptAt.getTime();
      expect(nextAttemptTime).toBeGreaterThanOrEqual(before + 60_000 - 100);
      expect(nextAttemptTime).toBeLessThanOrEqual(Date.now() + 60_000 + 100);
    });

    it("should default data to empty object when not provided", async () => {
      mockPushRetryCreate.mockResolvedValue({});

      await enqueuePushRetry({
        notificationId: "notif-123",
        userId: "user-456",
        title: "Test",
        body: "Body",
        error: "Error",
      });

      const createArg = mockPushRetryCreate.mock.calls[0][0];
      expect(createArg.data).toEqual({});
    });

    it("should handle DB errors gracefully without throwing", async () => {
      mockPushRetryCreate.mockRejectedValue(new Error("DB write error"));

      // Should not throw
      await expect(
        enqueuePushRetry({
          notificationId: "notif-123",
          userId: "user-456",
          title: "Test",
          body: "Body",
          error: "Error",
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("_processRetry — success path", () => {
    it("should mark retry as succeeded when push delivery succeeds", async () => {
      mockSendPush.mockResolvedValue(undefined);
      mockPushRetryUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      mockNotificationUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const retry = createMockRetry({ attempts: 2 });

      await _processRetry(retry);

      expect(mockSendPush).toHaveBeenCalledWith({
        userId: "user-456",
        title: "Test Title",
        body: "Test Body",
        data: { orderId: "order-789" },
      });

      expect(mockPushRetryUpdateOne).toHaveBeenCalledWith(
        { _id: "retry-id" },
        {
          $set: { status: "succeeded", lastError: null },
          $inc: { attempts: 1 },
        }
      );
    });

    it("should update notification lifecycle on success", async () => {
      mockSendPush.mockResolvedValue(undefined);
      mockPushRetryUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      mockNotificationUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const retry = createMockRetry({ attempts: 1 });

      await _processRetry(retry);

      expect(mockNotificationUpdateOne).toHaveBeenCalledWith(
        { _id: "notif-123" },
        {
          $set: {
            "lifecycle.push.status": "delivered",
            "lifecycle.push.updatedAt": expect.any(Date),
          },
        }
      );
    });
  });

  describe("_processRetry — failure path with retries remaining", () => {
    it("should schedule next retry when attempts < MAX_RETRY_ATTEMPTS", async () => {
      mockSendPush.mockRejectedValue(new Error("Network timeout"));
      mockPushRetryUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const retry = createMockRetry({ attempts: 2 }); // After this failure, attempts becomes 3

      await _processRetry(retry);

      expect(mockPushRetryUpdateOne).toHaveBeenCalledWith(
        { _id: "retry-id" },
        {
          $set: {
            attempts: 3,
            nextAttemptAt: expect.any(Date),
            lastError: "Network timeout",
          },
        }
      );

      // The nextAttemptAt should correspond to RETRY_INTERVALS_MS[3] = 30 minutes
      const updateArg = mockPushRetryUpdateOne.mock.calls[0][1];
      const nextAttempt = updateArg.$set.nextAttemptAt.getTime();
      const expectedInterval = RETRY_INTERVALS_MS[3]; // 30 minutes
      expect(nextAttempt).toBeGreaterThanOrEqual(Date.now() + expectedInterval - 200);
    });
  });

  describe("_processRetry — dead-letter path", () => {
    it("should move to dead_letter when attempts reach MAX_RETRY_ATTEMPTS", async () => {
      mockSendPush.mockRejectedValue(new Error("Server error"));
      mockPushRetryUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      // attempts = 4, after failure newAttempts = 5 which equals MAX_RETRY_ATTEMPTS
      const retry = createMockRetry({ attempts: 4 });

      await _processRetry(retry);

      expect(mockPushRetryUpdateOne).toHaveBeenCalledWith(
        { _id: "retry-id" },
        {
          $set: {
            status: "dead_letter",
            lastError: "Server error",
            attempts: 5,
          },
        }
      );
    });

    it("should move to dead_letter when already at max-1 attempts and fails again", async () => {
      mockSendPush.mockRejectedValue(new Error("Final failure"));
      mockPushRetryUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      const retry = createMockRetry({ attempts: 4 });

      await _processRetry(retry);

      const updateCall = mockPushRetryUpdateOne.mock.calls[0][1];
      expect(updateCall.$set.status).toBe("dead_letter");
      expect(updateCall.$set.attempts).toBe(5);
    });
  });

  describe("_tick — polling", () => {
    it("should find pending retries with nextAttemptAt <= now", async () => {
      mockPushRetryFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await _tick();

      expect(mockPushRetryFind).toHaveBeenCalledWith({
        status: "pending",
        nextAttemptAt: { $lte: expect.any(Date) },
      });
    });

    it("should do nothing when no retries are due", async () => {
      mockPushRetryFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await _tick();

      expect(mockSendPush).not.toHaveBeenCalled();
    });

    it("should process due retries independently", async () => {
      const retry1 = createMockRetry({ id: "retry-1", attempts: 0 });
      const retry2 = createMockRetry({ id: "retry-2", attempts: 1 });

      mockPushRetryFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([retry1, retry2]),
          }),
        }),
      });

      mockSendPush.mockResolvedValue(undefined);
      mockPushRetryUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      mockNotificationUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await _tick();

      // Both retries should be processed
      expect(mockSendPush).toHaveBeenCalledTimes(2);
    });

    it("should continue processing remaining retries if one fails unexpectedly", async () => {
      const retry1 = createMockRetry({ id: "retry-1", attempts: 0 });
      const retry2 = createMockRetry({ id: "retry-2", attempts: 0 });

      mockPushRetryFind.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([retry1, retry2]),
          }),
        }),
      });

      // First push throws an unexpected error during processing (not just push failure)
      mockSendPush
        .mockRejectedValueOnce(new Error("Unexpected"))
        .mockResolvedValueOnce(undefined);

      mockPushRetryUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      mockNotificationUpdateOne.mockResolvedValue({ modifiedCount: 1 });

      await _tick();

      // Both retries attempted
      expect(mockSendPush).toHaveBeenCalledTimes(2);
    });
  });

  describe("Constants", () => {
    it("should have MAX_RETRY_ATTEMPTS = 5", () => {
      expect(MAX_RETRY_ATTEMPTS).toBe(5);
    });

    it("should have POLL_INTERVAL_MS = 30000 (30 seconds)", () => {
      expect(POLL_INTERVAL_MS).toBe(30_000);
    });

    it("should have 5 retry intervals", () => {
      expect(RETRY_INTERVALS_MS).toHaveLength(5);
    });
  });

  describe("initializePushRetryWorker / stopPushRetryWorker", () => {
    it("should not initialize twice", () => {
      // Using a custom interval to ensure it works
      initializePushRetryWorker({ pollIntervalMs: 60000 });
      initializePushRetryWorker({ pollIntervalMs: 60000 });
      // Should not throw — second call is a no-op
      stopPushRetryWorker();
    });

    it("should stop worker cleanly", () => {
      initializePushRetryWorker({ pollIntervalMs: 60000 });
      stopPushRetryWorker();
      // Should not throw and worker should be stoppable
    });
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockRetry(opts: { id?: string; attempts?: number } = {}): any {
  return {
    _id: opts.id || "retry-id",
    notificationId: "notif-123",
    userId: { toString: () => "user-456" },
    title: "Test Title",
    body: "Test Body",
    data: { orderId: "order-789" },
    attempts: opts.attempts ?? 0,
    nextAttemptAt: new Date(Date.now() - 1000), // overdue
    lastError: "Previous error",
    status: "pending",
  };
}
