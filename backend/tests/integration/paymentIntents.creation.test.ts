jest.mock("../../src/domains/payments/adapters/RazorpayAdapter", () => {
  class RazorpayAdapter {
    createOrder = jest.fn(async (input: any) => {
      return {
        gateway: "RAZORPAY",
        gatewayOrderId: `order_mock_${String(input?.receipt || "")}`,
        checkoutPayload: {
          gateway: "RAZORPAY",
          keyId: "rzp_test_key",
          razorpayOrderId: `order_mock_${String(input?.receipt || "")}`,
          amount: Number(input?.amount || 0) * 100,
          currency: String(input?.currency || "INR"),
        },
      };
    });

    verifyWebhookSignature = jest.fn(() => ({ ok: true }));
    parseWebhook = jest.fn(() => ({ gateway: "RAZORPAY", type: "UNKNOWN", gatewayEventId: "unknown", rawEvent: null }));
  }

  return { RazorpayAdapter };
});

import request from "supertest";

import app from "../../src/app";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";

describe("PaymentIntent creation safety invariants (Phase 0)", () => {
  it("is idempotent: same idempotencyKey returns same PaymentIntent and does not create duplicates", async () => {
    const user = await (global as any).createTestUser({ email: "pi-idem-user@example.com" });
    const token = await (global as any).getAuthToken(user);

    const product = await (global as any).createTestProduct({ price: 123, stock: 10, reservedStock: 0 });

    const order = await (global as any).createTestOrder(
      user,
      product,
      { paymentMethod: "razorpay", paymentStatus: "PENDING", totalAmount: 123 }
    );

    const idempotencyKey = `order_${String(order._id)}_attempt_1`;

    const res1 = await request(app)
      .post("/api/payment-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({
        orderId: String(order._id),
        method: "RAZORPAY",
        idempotencyKey,
      });

    expect(res1.status).toBe(201);
    expect(typeof res1.body.paymentIntentId).toBe("string");

    const res2 = await request(app)
      .post("/api/payment-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({
        orderId: String(order._id),
        method: "RAZORPAY",
        idempotencyKey,
      });

    expect(res2.status).toBe(201);
    expect(res2.body.paymentIntentId).toBe(res1.body.paymentIntentId);

    const countByKey = await PaymentIntent.countDocuments({ idempotencyKey });
    expect(countByKey).toBe(1);

    const intentsForOrder = await PaymentIntent.find({ orderId: order._id }).lean();
    expect(intentsForOrder.length).toBe(1);
    expect(String((intentsForOrder[0] as any)._id)).toBe(String(res1.body.paymentIntentId));
    expect(Number((intentsForOrder[0] as any).attemptNo)).toBe(1);
  });

  it("enforces attempt cap: allows attempts 1-3 and rejects attempt 4", async () => {
    const user = await (global as any).createTestUser({ email: "pi-attempt-user@example.com" });
    const token = await (global as any).getAuthToken(user);

    const product = await (global as any).createTestProduct({ price: 200, stock: 10, reservedStock: 0 });

    const order = await (global as any).createTestOrder(
      user,
      product,
      { paymentMethod: "razorpay", paymentStatus: "PENDING", totalAmount: 200 }
    );

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const res = await request(app)
        .post("/api/payment-intents")
        .set("Authorization", `Bearer ${token}`)
        .send({
          orderId: String(order._id),
          method: "RAZORPAY",
          idempotencyKey: `order_${String(order._id)}_attempt_${attempt}`,
        });

      if (res.status !== 201) {
        // eslint-disable-next-line no-console
        console.log("[TEST][ATTEMPT_CREATE_FAILED]", { attempt, status: res.status, body: res.body });
      }
      expect(res.status).toBe(201);
      expect(typeof res.body.paymentIntentId).toBe("string");
    }

    const intents = await PaymentIntent.find({ orderId: order._id }).sort({ attemptNo: 1 }).lean();
    expect(intents.length).toBe(3);
    expect(intents.map((d: any) => Number(d.attemptNo))).toEqual([1, 2, 3]);

    const res4 = await request(app)
      .post("/api/payment-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({
        orderId: String(order._id),
        method: "RAZORPAY",
        idempotencyKey: `order_${String(order._id)}_attempt_4`,
      });

    expect([400, 409, 429]).toContain(res4.status);

    const intentsAfter = await PaymentIntent.find({ orderId: order._id }).lean();
    expect(intentsAfter.length).toBe(3);
  });
});
