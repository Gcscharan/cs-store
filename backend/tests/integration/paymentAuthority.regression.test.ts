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

describe("Payment authority hardening (regression)", () => {
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

  it("payment.captured webhook is the only path that can produce paymentStatus=PAID and allow PAYMENT_SUCCESS notification dispatch", async () => {
    const user = await (global as any).createTestUser({ email: "wh-capture@example.com" });
    const product = await (global as any).createTestProduct({ price: 100, stock: 10, reservedStock: 0 });
    const order = await (global as any).createTestOrder(user, product, { paymentStatus: "PENDING", totalAmount: 100 });

    const gatewayOrderId = "order_test_capture";
    const gatewayPaymentId = "pay_test_capture";

    await PaymentIntent.create({
      orderId: order._id,
      attemptNo: 1,
      idempotencyKey: "wh_cap_1",
      gateway: "RAZORPAY",
      amount: 100,
      currency: "INR",
      status: "GATEWAY_ORDER_CREATED",
      expiresAt: new Date(Date.now() + 60 * 60_000),
      gatewayOrderId,
      checkoutPayload: { keyId: "rzp_test_key", razorpayOrderId: gatewayOrderId, amount: 100, currency: "INR" },
      isLocked: false,
    });

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: gatewayPaymentId,
            order_id: gatewayOrderId,
            amount: 10000,
            currency: "INR",
            created_at: 1767139200,
          },
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
    expect(String((after as any)?.paymentStatus || "").toUpperCase()).toBe("PAID");

    // PAYMENT_SUCCESS is allowed only after paymentStatus is PAID.
    await NotificationService.dispatchNotification(String(user._id), "PAYMENT_SUCCESS", {
      orderId: String(order._id),
      amount: 100,
      paymentId: gatewayPaymentId,
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
