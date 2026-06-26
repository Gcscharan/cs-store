/**
 * Unit tests for the (intentionally small) payment health/readiness service.
 */

const mockWebhookCount = jest.fn();
jest.mock("../../../src/domains/payments/models/WebhookEventInbox", () => ({
  WebhookEventInbox: { countDocuments: (...a: any[]) => mockWebhookCount(...a) },
}));

const mockRefundCount = jest.fn();
jest.mock("../../../src/domains/payments/models/RefundRequest", () => ({
  RefundRequest: { countDocuments: (...a: any[]) => mockRefundCount(...a) },
}));

const mockIntentCount = jest.fn();
jest.mock("../../../src/domains/payments/models/PaymentIntent", () => ({
  PaymentIntent: { countDocuments: (...a: any[]) => mockIntentCount(...a) },
}));

const mockPing = jest.fn();
jest.mock("../../../src/config/redis", () => ({
  __esModule: true,
  default: { ping: (...a: any[]) => mockPing(...a) },
}));

jest.mock("mongoose", () => ({
  __esModule: true,
  default: { connection: { get readyState() { return (globalThis as any).__pmReadyState ?? 1; } } },
  connection: { get readyState() { return (globalThis as any).__pmReadyState ?? 1; } },
}));

jest.mock("../../../src/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import {
  getPaymentHealth,
  getPaymentReadiness,
  _resolveOverallStatus,
} from "../../../src/domains/payments/services/paymentHealthService";

describe("PaymentHealthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebhookCount.mockResolvedValue(0);
    mockRefundCount.mockResolvedValue(0);
    mockIntentCount.mockResolvedValue(0);
    mockPing.mockResolvedValue("PONG");
    (globalThis as any).__pmReadyState = 1;
  });

  afterEach(() => delete (globalThis as any).__pmReadyState);

  test("healthy when all clear", async () => {
    const h = await getPaymentHealth();
    expect(h.status).toBe("healthy");
    expect(h.overall).toBe(100);
  });

  test("stuck PROCESSING refunds (critical) force degradation", async () => {
    // refunds check: countDocuments returns stuck count
    mockRefundCount.mockResolvedValue(25); // >= crit → score 0
    const h = await getPaymentHealth();
    expect(h.components.refunds.score).toBe(0);
    expect(h.status).toBe("unhealthy"); // critical floor
  });

  test("stuck intents (non-critical) do NOT force unhealthy on their own", async () => {
    mockIntentCount.mockResolvedValue(250); // crit for intents → score 0, but non-critical
    const h = await getPaymentHealth();
    expect(h.components.intents.score).toBe(0);
    // blended still high (intents weight 0.1), and intents not critical → not forced unhealthy
    expect(h.status).not.toBe("unhealthy");
  });

  test("hard-floor: critical component < 40 → unhealthy regardless of blend", () => {
    const status = _resolveOverallStatus(96, [
      { score: 30, status: "unhealthy", critical: true, detail: {} },
      { score: 100, status: "healthy", critical: false, detail: {} },
    ]);
    expect(status).toBe("unhealthy");
  });

  test("never throws — degraded report on internal error", async () => {
    mockWebhookCount.mockRejectedValue(new Error("db down"));
    const h = await getPaymentHealth();
    expect(h.status).toBe("unhealthy");
    expect(h.overall).toBe(0);
  });

  describe("readiness", () => {
    test("ready when mongo + redis up", async () => {
      const r = await getPaymentReadiness();
      expect(r.ready).toBe(true);
      expect(r.checks).toEqual({ mongo: true, redis: true });
    });

    test("not ready when mongo down", async () => {
      (globalThis as any).__pmReadyState = 0;
      const r = await getPaymentReadiness();
      expect(r.ready).toBe(false);
      expect(r.reason).toContain("MongoDB");
    });

    test("not ready when redis down", async () => {
      mockPing.mockRejectedValue(new Error("down"));
      const r = await getPaymentReadiness();
      expect(r.ready).toBe(false);
      expect(r.reason).toContain("Redis");
    });
  });
});
