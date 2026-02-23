import { Order } from "../../src/models/Order";

// NOTE: This test enforces the global invariant:
// PAID is unreachable without source === WEBHOOK_PAYMENT_CAPTURED.

describe("Order paymentStatus authority invariant", () => {
  it("blocks any attempt to set paymentStatus=PAID without WEBHOOK_PAYMENT_CAPTURED source", async () => {
    const user = await (global as any).createTestUser({ email: `pta-${Date.now()}@example.com` });
    const order = await (global as any).createTestOrder(user, { paymentStatus: "PENDING", totalAmount: 100 });

    await expect(
      Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "PAID" } })
    ).rejects.toMatchObject({ code: "ILLEGAL_PAID_TRANSITION" });

    const after = await Order.findById(order._id).select("paymentStatus").lean();
    expect(String((after as any)?.paymentStatus || "").toUpperCase()).not.toBe("PAID");
  });

  it("allows paymentStatus=PAID only when source is WEBHOOK_PAYMENT_CAPTURED", async () => {
    const user = await (global as any).createTestUser({ email: `pta-ok-${Date.now()}@example.com` });
    const order = await (global as any).createTestOrder(user, { paymentStatus: "PENDING", totalAmount: 100 });

    const res = await Order.updateOne(
      { _id: order._id },
      { $set: { paymentStatus: "PAID" } },
      { context: { paymentStatusSource: "WEBHOOK_PAYMENT_CAPTURED" } } as any
    );

    expect((res as any).acknowledged).toBe(true);

    const after = await Order.findById(order._id).select("paymentStatus").lean();
    expect(String((after as any)?.paymentStatus || "").toUpperCase()).toBe("PAID");
  });
});
