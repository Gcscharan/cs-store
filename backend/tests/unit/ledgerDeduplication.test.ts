import { appendLedgerEntry } from "../../src/domains/payments/services/ledgerService";
import { LedgerEntry } from "../../src/domains/payments/models/LedgerEntry";

describe("LedgerEntry deduplication (dedupeKey)", () => {
  it("returns created=false and does not create a second row when dedupeKey is reused", async () => {
    const user = await (global as any).createTestUser({ email: "ledger-dedupe@example.com" });
    const order = await (global as any).createTestOrder(user, { paymentStatus: "PENDING", totalAmount: 100 });

    const dedupeKey = "dedupe:test:one";

    const r1 = await appendLedgerEntry({
      paymentIntentId: "507f191e810c19729de860ea",
      orderId: String(order._id),
      gateway: "RAZORPAY",
      eventType: "CAPTURE",
      amount: 100,
      currency: "INR",
      gatewayEventId: "pay_dedupe_1",
      dedupeKey,
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "captured" },
    });

    const r2 = await appendLedgerEntry({
      paymentIntentId: "507f191e810c19729de860ea",
      orderId: String(order._id),
      gateway: "RAZORPAY",
      eventType: "CAPTURE",
      amount: 100,
      currency: "INR",
      gatewayEventId: "pay_dedupe_1_dup",
      dedupeKey,
      occurredAt: new Date("2026-01-01T00:00:00.000Z"),
      raw: { status: "captured" },
    });

    expect(r1).toEqual({ created: true });
    expect(r2).toEqual({ created: false });

    const count = await LedgerEntry.countDocuments({ dedupeKey });
    expect(count).toBe(1);
  });
});
