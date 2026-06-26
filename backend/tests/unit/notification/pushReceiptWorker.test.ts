/**
 * Unit tests for the Push Receipt Worker.
 *
 * Proves the "was the push actually delivered?" observability path:
 *   - ok receipt        → status delivered + lifecycle delivered
 *   - error receipt     → status failed + lifecycle failed
 *   - DeviceNotRegistered receipt → invalid token cleaned up
 *   - missing receipt   → rescheduled, then gives up after MAX attempts
 */

// ── Mocks ──
jest.mock("node-fetch", () => jest.fn());
import fetch from "node-fetch";
const mockFetch = fetch as unknown as jest.Mock;

const mockReceiptFind = jest.fn();
const mockReceiptUpdateOne = jest.fn();
jest.mock("../../../src/models/PushReceipt", () => ({
  __esModule: true,
  default: {
    find: (...args: any[]) => mockReceiptFind(...args),
    updateOne: (...args: any[]) => mockReceiptUpdateOne(...args),
  },
}));

const mockDeviceDeleteOne = jest.fn();
jest.mock("../../../src/models/UserDeviceToken", () => ({
  __esModule: true,
  default: { deleteOne: (...args: any[]) => mockDeviceDeleteOne(...args) },
}));

const mockUserUpdateOne = jest.fn();
jest.mock("../../../src/models/User", () => ({
  User: { updateOne: (...args: any[]) => mockUserUpdateOne(...args) },
}));

const mockUpdateLifecycle = jest.fn();
jest.mock("../../../src/domains/communication/services/deliveryTracker", () => ({
  updateLifecycleStatus: (...args: any[]) => mockUpdateLifecycle(...args),
}));

jest.mock("../../../src/ops/opsMetrics", () => ({
  incCounterWithLabels: jest.fn(),
}));

jest.mock("../../../src/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { _tick, _resetReceiptWorker, MAX_RECEIPT_ATTEMPTS } from "../../../src/domains/communication/services/pushReceiptWorker";

function mockDueReceipts(rows: any[]) {
  mockReceiptFind.mockReturnValue({
    sort: jest.fn().mockReturnValue({
      limit: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

describe("PushReceiptWorker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetReceiptWorker();
    mockReceiptUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockDeviceDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockUserUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    mockUpdateLifecycle.mockResolvedValue(undefined);
  });

  afterEach(() => _resetReceiptWorker());

  test("ok receipt → marks delivered and updates lifecycle", async () => {
    mockDueReceipts([
      { _id: "r1", ticketId: "t1", notificationId: { toString: () => "n1" }, attempts: 0 },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: { t1: { status: "ok" } } }),
    });

    await _tick();

    expect(mockReceiptUpdateOne).toHaveBeenCalledWith(
      { _id: "r1" },
      { $set: { status: "delivered" } }
    );
    expect(mockUpdateLifecycle).toHaveBeenCalledWith("n1", "push", "delivered");
  });

  test("error receipt → marks failed and updates lifecycle", async () => {
    mockDueReceipts([
      { _id: "r2", ticketId: "t2", notificationId: { toString: () => "n2" }, attempts: 0 },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: { t2: { status: "error", message: "boom", details: { error: "MessageTooBig" } } },
      }),
    });

    await _tick();

    expect(mockReceiptUpdateOne).toHaveBeenCalledWith(
      { _id: "r2" },
      { $set: { status: "failed", errorCode: "MessageTooBig", lastError: "boom" } }
    );
    expect(mockUpdateLifecycle).toHaveBeenCalledWith("n2", "push", "failed", "boom");
  });

  test("DeviceNotRegistered receipt → cleans up the invalid token", async () => {
    mockDueReceipts([
      {
        _id: "r3",
        ticketId: "t3",
        notificationId: { toString: () => "n3" },
        userId: "u3",
        token: "ExponentPushToken[DEAD]",
        attempts: 0,
      },
    ]);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        data: { t3: { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } } },
      }),
    });

    await _tick();

    expect(mockDeviceDeleteOne).toHaveBeenCalledWith({ token: "ExponentPushToken[DEAD]" });
    expect(mockUserUpdateOne).toHaveBeenCalledWith(
      { _id: "u3", expoPushToken: "ExponentPushToken[DEAD]" },
      { $unset: { expoPushToken: 1 } }
    );
  });

  test("missing receipt → reschedules (not yet ready)", async () => {
    mockDueReceipts([{ _id: "r4", ticketId: "t4", attempts: 0 }]);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: {} }), // no receipt for t4 yet
    });

    await _tick();

    const call = mockReceiptUpdateOne.mock.calls.find((c) => c[0]._id === "r4");
    expect(call).toBeDefined();
    expect(call![1].$set.attempts).toBe(1);
    expect(call![1].$set.checkAfter).toBeInstanceOf(Date);
  });

  test("missing receipt at max attempts → gives up (marks failed/unconfirmed)", async () => {
    mockDueReceipts([{ _id: "r5", ticketId: "t5", attempts: MAX_RECEIPT_ATTEMPTS - 1 }]);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ data: {} }),
    });

    await _tick();

    const call = mockReceiptUpdateOne.mock.calls.find((c) => c[0]._id === "r5");
    expect(call![1].$set.status).toBe("failed");
    expect(String(call![1].$set.lastError)).toContain("Unconfirmed");
  });

  test("Expo getReceipts unreachable → reschedules all due rows", async () => {
    mockDueReceipts([
      { _id: "r6", ticketId: "t6", attempts: 0 },
      { _id: "r7", ticketId: "t7", attempts: 0 },
    ]);
    mockFetch.mockResolvedValue({ ok: false, status: 503, json: jest.fn().mockResolvedValue({}) });

    await _tick();

    // Both rows rescheduled (attempts incremented), none marked delivered.
    expect(mockReceiptUpdateOne).toHaveBeenCalledTimes(2);
  });
});
