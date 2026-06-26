/**
 * Unit tests for the Notification Health Service scoring + aggregation.
 */

const mockOutboxCount = jest.fn();
jest.mock("../../../src/models/OutboxEvent", () => ({
  OutboxEvent: { countDocuments: (...a: any[]) => mockOutboxCount(...a) },
}));

const mockRetryCount = jest.fn();
jest.mock("../../../src/models/PushRetry", () => ({
  __esModule: true,
  default: { countDocuments: (...a: any[]) => mockRetryCount(...a) },
}));

const mockReceiptCount = jest.fn();
jest.mock("../../../src/models/PushReceipt", () => ({
  __esModule: true,
  default: { countDocuments: (...a: any[]) => mockReceiptCount(...a) },
}));

const mockPing = jest.fn();
jest.mock("../../../src/config/redis", () => ({
  __esModule: true,
  default: { ping: (...a: any[]) => mockPing(...a) },
}));

const mockAuditFindOne = jest.fn();
jest.mock("../../../src/models/NotificationAudit", () => ({
  __esModule: true,
  default: {
    findOne: (...a: any[]) => ({
      sort: () => ({ select: () => ({ lean: () => mockAuditFindOne(...a) }) }),
    }),
  },
}));

const mockSnapshotFind = jest.fn();
jest.mock("../../../src/models/NotificationHealthSnapshot", () => ({
  __esModule: true,
  default: {
    find: () => ({ sort: () => ({ lean: () => mockSnapshotFind() }) }),
    create: jest.fn(),
  },
}));

// Mongoose connection state for readiness checks.
jest.mock("mongoose", () => ({
  __esModule: true,
  default: { connection: { get readyState() { return (globalThis as any).__mongoReadyState ?? 1; } } },
  connection: { get readyState() { return (globalThis as any).__mongoReadyState ?? 1; } },
}));

jest.mock("../../../src/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  getNotificationHealth,
  getNotificationHealthHistory,
  getNotificationReadiness,
  _scoreFromBacklog,
  _statusFromScore,
  _resolveOverallStatus,
} from "../../../src/domains/communication/services/notificationHealthService";

describe("NotificationHealthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPing.mockResolvedValue("PONG");
    mockOutboxCount.mockResolvedValue(0);
    mockRetryCount.mockResolvedValue(0);
    mockReceiptCount.mockResolvedValue(0);
    mockAuditFindOne.mockResolvedValue({ createdAt: new Date() });
    mockSnapshotFind.mockResolvedValue([]);
  });

  describe("scoring helpers", () => {
    test("scoreFromBacklog: 100 at/under warn, 0 at/over crit, interpolated between", () => {
      expect(_scoreFromBacklog(0, 100, 1000)).toBe(100);
      expect(_scoreFromBacklog(100, 100, 1000)).toBe(100);
      expect(_scoreFromBacklog(1000, 100, 1000)).toBe(0);
      expect(_scoreFromBacklog(2000, 100, 1000)).toBe(0);
      const mid = _scoreFromBacklog(550, 100, 1000); // halfway
      expect(mid).toBeGreaterThan(40);
      expect(mid).toBeLessThan(60);
    });

    test("statusFromScore thresholds", () => {
      expect(_statusFromScore(95)).toBe("healthy");
      expect(_statusFromScore(90)).toBe("healthy");
      expect(_statusFromScore(75)).toBe("degraded");
      expect(_statusFromScore(70)).toBe("degraded");
      expect(_statusFromScore(50)).toBe("unhealthy");
    });
  });

  test("healthy system → overall healthy, 100", async () => {
    const h = await getNotificationHealth();
    expect(h.status).toBe("healthy");
    expect(h.overall).toBe(100);
    expect(h.components.outbox.status).toBe("healthy");
    expect(h.components.redis.status).toBe("healthy");
  });

  test("dead-letter buildup degrades outbox and overall", async () => {
    // outbox: backlog query=0, dead_letter=50 (crit), failed=0
    mockOutboxCount
      .mockResolvedValueOnce(0)   // backlog
      .mockResolvedValueOnce(50)  // deadLetters (>= crit 50 → score 0)
      .mockResolvedValueOnce(0);  // failed

    const h = await getNotificationHealth();
    expect(h.components.outbox.score).toBe(0);
    expect(h.components.outbox.status).toBe("unhealthy");
    expect(h.overall).toBeLessThan(90);
  });

  test("redis down → redis unhealthy and overall drops", async () => {
    mockPing.mockRejectedValue(new Error("ECONNREFUSED"));
    const h = await getNotificationHealth();
    expect(h.components.redis.status).toBe("unhealthy");
    expect(h.components.redis.score).toBe(0);
    expect(h.overall).toBeLessThan(90);
  });

  test("never throws — returns degraded report on internal error", async () => {
    mockOutboxCount.mockRejectedValue(new Error("db blew up"));
    const h = await getNotificationHealth();
    expect(h.status).toBe("unhealthy");
    expect(h.overall).toBe(0);
  });

  describe("hard-floor rules (failing critical component can't hide behind average)", () => {
    test("resolveOverallStatus: critical component < 40 → unhealthy even if blend is high", () => {
      const status = _resolveOverallStatus(96, [
        { score: 30, status: "unhealthy", critical: true, detail: {} },
        { score: 100, status: "healthy", critical: false, detail: {} },
      ]);
      expect(status).toBe("unhealthy");
    });

    test("resolveOverallStatus: critical component < 70 → at least degraded", () => {
      const status = _resolveOverallStatus(95, [
        { score: 65, status: "degraded", critical: true, detail: {} },
        { score: 100, status: "healthy", critical: false, detail: {} },
      ]);
      expect(status).toBe("degraded");
    });

    test("resolveOverallStatus: non-critical low score does NOT force degradation", () => {
      const status = _resolveOverallStatus(95, [
        { score: 100, status: "healthy", critical: true, detail: {} },
        { score: 10, status: "unhealthy", critical: false, detail: {} },
      ]);
      expect(status).toBe("healthy");
    });

    test("redis (critical) down forces overall unhealthy despite high blend", async () => {
      mockPing.mockRejectedValue(new Error("down")); // redis score 0, critical
      const h = await getNotificationHealth();
      expect(h.status).toBe("unhealthy");
    });
  });

  describe("lastSuccessfulNotification", () => {
    test("reports timestamp + secondsSinceLastSuccess when an audit exists", async () => {
      const ts = new Date(Date.now() - 18_000);
      mockAuditFindOne.mockResolvedValue({ createdAt: ts });
      const h = await getNotificationHealth();
      expect(h.lastSuccessfulNotification).toBe(ts.toISOString());
      expect(h.secondsSinceLastSuccess).toBeGreaterThanOrEqual(17);
      expect(h.secondsSinceLastSuccess).toBeLessThanOrEqual(20);
    });

    test("null when no successful notification found", async () => {
      mockAuditFindOne.mockResolvedValue(null);
      const h = await getNotificationHealth();
      expect(h.lastSuccessfulNotification).toBeNull();
      expect(h.secondsSinceLastSuccess).toBeNull();
    });
  });

  describe("history", () => {
    test("empty window returns zeroed stats", async () => {
      mockSnapshotFind.mockResolvedValue([]);
      const hist = await getNotificationHealthHistory(24);
      expect(hist.sampleCount).toBe(0);
      expect(hist.score.avg).toBeNull();
    });

    test("aggregates avg/min/max and deltas over the window", async () => {
      const base = new Date(Date.now() - 60_000);
      mockSnapshotFind.mockResolvedValue([
        { overall: 100, recoveriesRun: 2, escalations: 0, recentDeadLetters: 0, outboxBacklog: 0, secondsSinceLastSuccess: 5, createdAt: base },
        { overall: 80, recoveriesRun: 5, escalations: 1, recentDeadLetters: 3, outboxBacklog: 12, secondsSinceLastSuccess: 9, createdAt: new Date() },
      ]);
      const hist = await getNotificationHealthHistory(24);
      expect(hist.sampleCount).toBe(2);
      expect(hist.score.avg).toBe(90);
      expect(hist.score.min).toBe(80);
      expect(hist.score.max).toBe(100);
      expect(hist.recoveriesRun).toBe(3); // 5 - 2
      expect(hist.escalations).toBe(1);   // 1 - 0
      expect(hist.maxRecentDeadLetters).toBe(3);
      expect(hist.maxOutboxBacklog).toBe(12);
    });
  });

  describe("readiness (distinct from health)", () => {
    afterEach(() => {
      delete (globalThis as any).__mongoReadyState;
    });

    test("ready when Mongo connected and Redis reachable", async () => {
      (globalThis as any).__mongoReadyState = 1;
      mockPing.mockResolvedValue("PONG");
      const r = await getNotificationReadiness();
      expect(r.ready).toBe(true);
      expect(r.reason).toBeNull();
      expect(r.checks).toEqual({ mongo: true, redis: true });
    });

    test("not ready when Mongo disconnected (hard requirement)", async () => {
      (globalThis as any).__mongoReadyState = 0;
      mockPing.mockResolvedValue("PONG");
      const r = await getNotificationReadiness();
      expect(r.ready).toBe(false);
      expect(r.reason).toContain("MongoDB");
      expect(r.checks.mongo).toBe(false);
    });

    test("not ready when Redis down (dedup/cache degraded)", async () => {
      (globalThis as any).__mongoReadyState = 1;
      mockPing.mockRejectedValue(new Error("down"));
      const r = await getNotificationReadiness();
      expect(r.ready).toBe(false);
      expect(r.reason).toContain("Redis");
      expect(r.checks.redis).toBe(false);
    });
  });
});
