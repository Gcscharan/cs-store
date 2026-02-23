import crypto from "crypto";
import request from "supertest";

import app from "../../src/app";
import { Order } from "../../src/models/Order";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";

jest.mock("../../src/domains/communication/services/mailService", () => ({
  __esModule: true,
  sendEmail: jest.fn(async () => undefined),
}));

jest.mock("../../src/utils/sms", () => ({
  __esModule: true,
  sendSMS: jest.fn(async () => true),
  generateOTP: jest.fn(() => "123456"),
  validatePhoneNumber: jest.fn(() => true),
  formatPhoneNumber: jest.fn((p: string) => p),
}));

import { NotificationService } from "../../src/domains/communication/services/notificationService";
import { sendEmail } from "../../src/domains/communication/services/mailService";

describe("Payment authority hardening (false positives)", () => {
  const prevWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  });

  afterAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = prevWebhookSecret;
  });

  beforeEach(() => {
    (sendEmail as unknown as jest.Mock).mockClear();
  });

  it("intent creation + order.paid webhook + frontend handler callback cannot mark PAID and cannot emit PAYMENT_SUCCESS", async () => {
    const user = await (global as any).createTestUser({
      email: "wh-order-paid@example.com",
      notificationPreferences: { email: { enabled: true, categories: { silentPay: true } } },
    });
    const token = await (global as any).getAuthToken(user);

    const product = await (global as any).createTestProduct({ price: 100, stock: 10, reservedStock: 0 });
    const order = await (global as any).createTestOrder(user, product, {
      paymentMethod: "razorpay",
      paymentStatus: "PENDING",
      totalAmount: 100,
    });

    // (a) intent creation
    const idemKey = `fp_${String(order._id)}_attempt_1`;
    const piRes = await request(app)
      .post("/api/payment-intents")
      .set("Authorization", `Bearer ${token}`)
      .send({ orderId: String(order._id), method: "RAZORPAY", idempotencyKey: idemKey });

    expect(piRes.status).toBe(201);
    expect(typeof piRes.body.paymentIntentId).toBe("string");

    const pi = await PaymentIntent.findById(piRes.body.paymentIntentId).lean();
    const gatewayOrderId = String((pi as any)?.gatewayOrderId || (pi as any)?.checkoutPayload?.razorpayOrderId || "");
    expect(gatewayOrderId).toBeTruthy();

    // (b) order.paid webhook (must be a no-op for paid)
    const payload = {
      event: "order.paid",
      payload: {
        order: { entity: { id: gatewayOrderId, amount_paid: 10000, currency: "INR", created_at: 1767139200 } },
        payment: {
          entity: { id: "pay_fake_1", order_id: gatewayOrderId, amount: 10000, currency: "INR", created_at: 1767139200 },
        },
      },
    };

    const bodyString = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", String(process.env.RAZORPAY_WEBHOOK_SECRET))
      .update(bodyString)
      .digest("hex");

    const res = await request(app)
      .post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature)
      .send(bodyString);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const after = await Order.findById(order._id).select("paymentStatus").lean();
    expect(String((after as any)?.paymentStatus || "").toUpperCase()).not.toBe("PAID");

    // (c) "frontend handler callback" cannot mark paid via backend (legacy path disabled)
    const legacy = await request(app)
      .put(`/api/orders/${String(order._id)}/payment-status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ paymentStatus: "PAID" });
    expect(legacy.status).toBe(410);

    const afterLegacy = await Order.findById(order._id).select("paymentStatus").lean();
    expect(String((afterLegacy as any)?.paymentStatus || "").toUpperCase()).not.toBe("PAID");

    // Assert notification cannot be sent while not PAID
    await NotificationService.dispatchNotification(String(user._id), "PAYMENT_SUCCESS", {
      orderId: String(order._id),
      amount: 100,
      paymentId: "pay_fake_1",
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });
});
