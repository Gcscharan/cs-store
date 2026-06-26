import {
  sendPush,
  flushBatch,
  getAndroidChannelId,
  _resetBatchQueue,
  _resetRateLimitState,
  _getBatchQueueLength,
  _cleanupInvalidToken,
  _processTickets,
  _sendBatchWithRetry,
  BATCH_WINDOW_MS,
  MAX_BATCH_SIZE,
  MAX_RATE_LIMIT_RETRIES,
  INITIAL_BACKOFF_MS,
  PushMessage,
  QueuedPush,
  ExpoPushTicket,
  ExpoPushMessage,
} from "../../../src/domains/communication/services/pushGateway";
import { User } from "../../../src/models/User";

// Mock fetch
jest.mock("node-fetch", () => jest.fn());
import fetch from "node-fetch";
const mockFetch = fetch as unknown as jest.Mock;

// Mock User model
jest.mock("../../../src/models/User", () => ({
  User: {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));

// Mock multi-device token registry (cleanup target)
jest.mock("../../../src/models/UserDeviceToken", () => ({
  __esModule: true,
  default: {
    find: jest.fn(() => ({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }) })),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  },
}));

// Mock push receipt model (recorded on ok tickets)
jest.mock("../../../src/models/PushReceipt", () => ({
  __esModule: true,
  default: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFindById = User.findById as jest.Mock;
const mockFindByIdAndUpdate = (User as any).findByIdAndUpdate as jest.Mock;
const mockUserUpdateOne = (User as any).updateOne as jest.Mock;
import UserDeviceToken from "../../../src/models/UserDeviceToken";
const mockDeviceDeleteOne = (UserDeviceToken as any).deleteOne as jest.Mock;

describe("PushGateway", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetBatchQueue();
    _resetRateLimitState();
  });

  afterEach(() => {
    _resetBatchQueue();
    _resetRateLimitState();
  });

  describe("getAndroidChannelId", () => {
    it("should return 'orders' for order category", () => {
      expect(getAndroidChannelId("order")).toBe("orders");
    });

    it("should return 'orders' for delivery category", () => {
      expect(getAndroidChannelId("delivery")).toBe("orders");
    });

    it("should return 'payments' for payment category", () => {
      expect(getAndroidChannelId("payment")).toBe("payments");
    });

    it("should return 'promotions' for promo category", () => {
      expect(getAndroidChannelId("promo")).toBe("promotions");
    });

    it("should return 'default' for account category", () => {
      expect(getAndroidChannelId("account")).toBe("default");
    });

    it("should return 'default' for undefined category", () => {
      expect(getAndroidChannelId(undefined)).toBe("default");
    });
  });

  describe("Token Cleanup (_cleanupInvalidToken)", () => {
    it("should remove expoPushToken from user document", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({});

      await _cleanupInvalidToken("user123");

      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith("user123", {
        $unset: { expoPushToken: 1 },
      });
    });

    it("should handle errors gracefully without throwing", async () => {
      mockFindByIdAndUpdate.mockRejectedValue(new Error("DB error"));

      // Should not throw
      await expect(_cleanupInvalidToken("user123")).resolves.toBeUndefined();
    });
  });

  describe("processTickets (_processTickets)", () => {
    it("should resolve on successful tickets", async () => {
      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];

      const batch: QueuedPush[] = [
        createQueuedPush("user1", resolves, rejects),
        createQueuedPush("user2", resolves, rejects),
      ];

      const tickets: ExpoPushTicket[] = [
        { status: "ok", id: "ticket-1" },
        { status: "ok", id: "ticket-2" },
      ];

      await _processTickets(batch, tickets);

      expect(resolves[0]).toHaveBeenCalled();
      expect(resolves[1]).toHaveBeenCalled();
      expect(rejects[0]).not.toHaveBeenCalled();
      expect(rejects[1]).not.toHaveBeenCalled();
    });

    it("should cleanup token and resolve on DeviceNotRegistered error", async () => {
      mockDeviceDeleteOne.mockResolvedValue({ deletedCount: 1 });
      mockUserUpdateOne.mockResolvedValue({ modifiedCount: 0 });

      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];

      const batch: QueuedPush[] = [
        createQueuedPush("user-bad-token", resolves, rejects),
      ];

      const tickets: ExpoPushTicket[] = [
        {
          status: "error",
          message: "Device not registered",
          details: { error: "DeviceNotRegistered" },
        },
      ];

      await _processTickets(batch, tickets);

      // Should remove ONLY the offending device token from the registry
      expect(mockDeviceDeleteOne).toHaveBeenCalledWith({ token: "ExponentPushToken[test]" });
      // And clear the legacy field only if it matches that token (scoped)
      expect(mockUserUpdateOne).toHaveBeenCalledWith(
        { _id: "user-bad-token", expoPushToken: "ExponentPushToken[test]" },
        { $unset: { expoPushToken: 1 } }
      );
      // Should resolve (graceful handling)
      expect(resolves[0]).toHaveBeenCalled();
      expect(rejects[0]).not.toHaveBeenCalled();
    });

    it("should reject on non-DeviceNotRegistered errors", async () => {
      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];

      const batch: QueuedPush[] = [
        createQueuedPush("user1", resolves, rejects),
      ];

      const tickets: ExpoPushTicket[] = [
        {
          status: "error",
          message: "Message too large",
          details: { error: "MessageTooBig" },
        },
      ];

      await _processTickets(batch, tickets);

      expect(rejects[0]).toHaveBeenCalledWith(expect.any(Error));
      expect(resolves[0]).not.toHaveBeenCalled();
    });

    it("should resolve when no ticket exists for a message", async () => {
      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];

      const batch: QueuedPush[] = [
        createQueuedPush("user1", resolves, rejects),
      ];

      // Empty tickets array
      await _processTickets(batch, []);

      expect(resolves[0]).toHaveBeenCalled();
    });
  });

  describe("sendBatchWithRetry (_sendBatchWithRetry)", () => {
    it("should send batch and process tickets on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [{ status: "ok", id: "t1" }],
        }),
      });

      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];
      const batch: QueuedPush[] = [createQueuedPush("user1", resolves, rejects)];

      await _sendBatchWithRetry(batch, 0);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(resolves[0]).toHaveBeenCalled();

      // Verify the request body
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body).toHaveLength(1);
      expect(body[0].to).toBe("ExponentPushToken[test]");
    });

    it("should retry on 429 response with exponential backoff", async () => {
      // First 429, then success
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429, json: jest.fn().mockResolvedValue({}) })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue({
            data: [{ status: "ok", id: "t1" }],
          }),
        });

      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];
      const batch: QueuedPush[] = [createQueuedPush("user1", resolves, rejects)];

      await _sendBatchWithRetry(batch, 0);

      // Should have called fetch twice (429 + retry success)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(resolves[0]).toHaveBeenCalled();
    });

    it("should reject after exhausting all rate-limit retries", async () => {
      // Always 429
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: jest.fn().mockResolvedValue({}),
      });

      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];
      const batch: QueuedPush[] = [createQueuedPush("user1", resolves, rejects)];

      // Start at attempt = MAX_RATE_LIMIT_RETRIES (already exhausted)
      await _sendBatchWithRetry(batch, MAX_RATE_LIMIT_RETRIES);

      expect(rejects[0]).toHaveBeenCalledWith(expect.any(Error));
      expect(resolves[0]).not.toHaveBeenCalled();
    });

    it("should reject all batch items on non-OK non-429 response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({}),
      });

      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];
      const batch: QueuedPush[] = [
        createQueuedPush("user1", resolves, rejects),
        createQueuedPush("user2", resolves, rejects),
      ];

      await _sendBatchWithRetry(batch, 0);

      expect(rejects[0]).toHaveBeenCalled();
      expect(rejects[1]).toHaveBeenCalled();
    });

    it("should reject all batch items on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];
      const batch: QueuedPush[] = [createQueuedPush("user1", resolves, rejects)];

      await _sendBatchWithRetry(batch, 0);

      expect(rejects[0]).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should handle mixed ticket results (some ok, some errors)", async () => {
      mockFindByIdAndUpdate.mockResolvedValue({});

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [
            { status: "ok", id: "t1" },
            { status: "error", message: "Device not registered", details: { error: "DeviceNotRegistered" } },
            { status: "error", message: "Too big", details: { error: "MessageTooBig" } },
          ],
        }),
      });

      const resolves: jest.Mock[] = [];
      const rejects: jest.Mock[] = [];
      const batch: QueuedPush[] = [
        createQueuedPush("user1", resolves, rejects),
        createQueuedPush("user2", resolves, rejects),
        createQueuedPush("user3", resolves, rejects),
      ];

      await _sendBatchWithRetry(batch, 0);

      // user1 - ok → resolve
      expect(resolves[0]).toHaveBeenCalled();
      // user2 - DeviceNotRegistered → resolve (graceful), token cleaned from registry
      expect(resolves[1]).toHaveBeenCalled();
      expect(mockDeviceDeleteOne).toHaveBeenCalledWith({ token: "ExponentPushToken[test]" });
      // user3 - MessageTooBig → reject
      expect(rejects[2]).toHaveBeenCalled();
    });
  });

  describe("Batching Integration (sendPush + flushBatch)", () => {
    it("should queue a message when sendPush is called", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            expoPushToken: "ExponentPushToken[test]",
          }),
        }),
      });

      // Don't await - just start the send (it will be queued)
      const promise = sendPush({
        userId: "user1",
        title: "Test",
        body: "Body",
        category: "order",
      });

      // Wait for findById to complete
      await new Promise((r) => setImmediate(r));

      expect(_getBatchQueueLength()).toBe(1);

      // Now flush manually and let it complete
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [{ status: "ok", id: "t1" }],
        }),
      });

      await flushBatch();
      await promise;

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body[0].channelId).toBe("orders");
      expect(body[0].title).toBe("Test");
    });

    it("should not queue if user has no push token", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ expoPushToken: null }),
        }),
      });

      await sendPush({
        userId: "user-no-token",
        title: "Test",
        body: "Body",
      });

      expect(_getBatchQueueLength()).toBe(0);
    });

    it("should not queue if user is not found", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(null),
        }),
      });

      await sendPush({
        userId: "nonexistent",
        title: "Test",
        body: "Body",
      });

      expect(_getBatchQueueLength()).toBe(0);
    });

    it("should include sound=default when sound is true", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            expoPushToken: "ExponentPushToken[test]",
          }),
        }),
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [{ status: "ok", id: "t1" }],
        }),
      });

      const promise = sendPush({
        userId: "user1",
        title: "Test",
        body: "Body",
        sound: true,
      });

      await new Promise((r) => setImmediate(r));
      await flushBatch();
      await promise;

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body[0].sound).toBe("default");
    });

    it("should include sound=null when sound is false", async () => {
      mockFindById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            expoPushToken: "ExponentPushToken[test]",
          }),
        }),
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          data: [{ status: "ok", id: "t1" }],
        }),
      });

      const promise = sendPush({
        userId: "user1",
        title: "Test",
        body: "Body",
        sound: false,
      });

      await new Promise((r) => setImmediate(r));
      await flushBatch();
      await promise;

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body[0].sound).toBeNull();
    });
  });

  describe("Constants", () => {
    it("should have correct batch window of 500ms", () => {
      expect(BATCH_WINDOW_MS).toBe(500);
    });

    it("should have correct max batch size of 100", () => {
      expect(MAX_BATCH_SIZE).toBe(100);
    });

    it("should have correct max rate limit retries of 5", () => {
      expect(MAX_RATE_LIMIT_RETRIES).toBe(5);
    });

    it("should have correct initial backoff of 1000ms", () => {
      expect(INITIAL_BACKOFF_MS).toBe(1000);
    });
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createQueuedPush(
  userId: string,
  resolves: jest.Mock[],
  rejects: jest.Mock[]
): QueuedPush {
  const resolve = jest.fn();
  const reject = jest.fn();
  resolves.push(resolve);
  rejects.push(reject);

  return {
    message: {
      to: "ExponentPushToken[test]",
      title: "Test",
      body: "Test body",
      channelId: "orders",
    },
    userId,
    resolve,
    reject,
  };
}
