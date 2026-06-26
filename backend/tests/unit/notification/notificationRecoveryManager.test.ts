/**
 * Unit tests for the Notification Recovery Manager.
 *
 * Proves the self-healing supervisor:
 *   - detects stuck outbox events / stuck receipts / dead-letter buildup / redis down
 *   - runs bounded recovery (release locks, reschedule)
 *   - escalates (opsAlert) when recovery repeatedly fails or for non-recoverable issues
 */

const mockOutboxCount = jest.fn();
const mockOutboxUpdateMany = jest.fn();
jest.mock("../../../src/models/OutboxEvent", () => ({
  OutboxEvent: {
    countDocuments: (...a: any[]) => mockOutboxCount(...a),
    updateMany: (...a: any[]) => mockOutboxUpdateMany(...a),
  },
}));

const mockReceiptCount = jest.fn();
const mockReceiptUpdateMany = jest.fn();
jest.mock("../../../src/models/PushReceipt", () => ({
  __esModule: true,
  default: {
    countDocuments: (...a: any[]) => mockReceiptCount(...a),
    updateMany: (...a: any[]) => mockReceiptUpdateMany(...a),
  },
}));

const mockPing = jest.fn();
jest.mock("../../../src/config/redis", () => ({
  __esModule: true,
  default: { ping: (...a: any[]) => mockPing(...a) },
}));

const mockOpsAlert = jest.fn();
jest.mock("../../../src/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), opsAlert: (...a: any[]) => mockOpsAlert(...a) },
}));

jest.mock("../../../src/ops/opsMetrics", () => ({ incCounterWithLabels: jest.fn() }));

import {
  sweep,
  _detectStuckOutbox,
  _recoverStuckOutbox,
  _resetRecoveryManager,
  _failureStreak,
  MAX_RECOVERY_ATTEMPTS,
} from "../../../src/domains/communication/services/notificationRecoveryManager";

describe("NotificationRecoveryManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetRecoveryManager();
    // Healthy defaults
    mockPing.mockResolvedValue("PONG");
    mockOutboxCount.mockResolvedValue(0);
    mockReceiptCount.mockResolvedValue(0);
    mockOutboxUpdateMany.mockResolvedValue({ modifiedCount: 0 });
    mockReceiptUpdateMany.mockResolvedValue({ modifiedCount: 0 });
  });

  afterEach(() => _resetRecoveryManager());

  test("detectStuckOutbox reports detected when stuck events exist", async () => {
    mockOutboxCount.mockResolvedValue(4);
    const d = await _detectStuckOutbox();
    expect(d.detected).toBe(true);
    expect(d.detail.count).toBe(4);
  });

  test("recoverStuckOutbox releases stale locks", async () => {
    mockOutboxUpdateMany.mockResolvedValue({ modifiedCount: 3 });
    const ok = await _recoverStuckOutbox();
    expect(ok).toBe(true);
    const callArg = mockOutboxUpdateMany.mock.calls[0][1];
    expect(callArg.$set.status).toBe("PENDING");
    expect(callArg.$set.lockedAt).toBeNull();
  });

  test("healthy system: sweep performs no escalation", async () => {
    await sweep();
    expect(mockOpsAlert).not.toHaveBeenCalled();
  });

  test("stuck outbox: sweep recovers and does not escalate on first occurrence", async () => {
    // countDocuments is called for outbox(stuck), receipts, deadletters.
    mockOutboxCount
      .mockResolvedValueOnce(5) // detectStuckOutbox
      .mockResolvedValueOnce(0); // detectDeadLetters
    mockReceiptCount.mockResolvedValue(0);
    mockOutboxUpdateMany.mockResolvedValue({ modifiedCount: 5 });

    await sweep();

    expect(mockOutboxUpdateMany).toHaveBeenCalled(); // recovery ran
    expect(mockOpsAlert).not.toHaveBeenCalled();      // recovered → no escalation
  });

  test("dead-letter buildup escalates immediately (no auto-recovery)", async () => {
    mockOutboxCount
      .mockResolvedValueOnce(0)   // detectStuckOutbox
      .mockResolvedValueOnce(50); // detectDeadLetters (>= threshold)
    mockReceiptCount.mockResolvedValue(0);

    await sweep();

    expect(mockOpsAlert).toHaveBeenCalledWith(
      expect.stringContaining("dead_letters"),
      expect.objectContaining({ issue: "dead_letters" })
    );
  });

  test("redis down escalates", async () => {
    mockPing.mockRejectedValue(new Error("ECONNREFUSED"));

    await sweep();

    expect(mockOpsAlert).toHaveBeenCalledWith(
      expect.stringContaining("redis_down"),
      expect.objectContaining({ issue: "redis_down" })
    );
  });

  test("repeated failed recovery escalates after MAX_RECOVERY_ATTEMPTS", async () => {
    // Stuck outbox persists and recovery throws every time.
    mockOutboxCount.mockImplementation(async (q: any) => {
      // dead-letter query has status DEAD_LETTER; stuck query has $in
      if (q?.status === "DEAD_LETTER") return 0;
      return 5;
    });
    mockReceiptCount.mockResolvedValue(0);
    mockOutboxUpdateMany.mockRejectedValue(new Error("db error"));

    for (let i = 0; i < MAX_RECOVERY_ATTEMPTS; i++) {
      await sweep();
    }

    expect(_failureStreak.stuck_outbox).toBeGreaterThanOrEqual(MAX_RECOVERY_ATTEMPTS);
    expect(mockOpsAlert).toHaveBeenCalledWith(
      expect.stringContaining("stuck_outbox"),
      expect.objectContaining({ issue: "stuck_outbox" })
    );
  });
});
