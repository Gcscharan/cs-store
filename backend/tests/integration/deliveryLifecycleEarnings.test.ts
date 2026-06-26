import crypto from "crypto";
import request from "supertest";
import mongoose from "mongoose";

import app from "../../src/app";
import { User } from "../../src/models/User";
import { Product } from "../../src/models/Product";
import { Order } from "../../src/models/Order";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { DeliveryEarning } from "../../src/models/DeliveryEarning";
import { DeliveryBoy } from "../../src/models/DeliveryBoy";
import { getAuthHeaders, createTestAdmin, createTestUser } from "../helpers/auth";
import { orderStateService } from "../../src/domains/orders/services/orderStateService";
import { OrderStatus } from "../../src/domains/orders/enums/OrderStatus";

jest.mock("../../src/domains/payments/adapters/RazorpayAdapter", () => {
  class RazorpayAdapter {
    createOrder = jest.fn(async () => ({
      gateway: "RAZORPAY",
      gatewayOrderId: "order_mock_delivery_earn",
      checkoutPayload: { gateway: "RAZORPAY", keyId: "k", razorpayOrderId: "order_mock_delivery_earn", amount: 20000, currency: "INR" },
    }));
    verifyWebhookSignature = jest.fn(() => ({ ok: true }));
    parseWebhook = jest.fn(({ rawBody }: { rawBody: Buffer }) => {
      const body = JSON.parse(rawBody.toString("utf8"));
      const p = body?.payload?.payment?.entity;
      return {
        gateway: "RAZORPAY", type: "PAYMENT_CAPTURED",
        gatewayEventId: String(p?.id || ""), gatewayOrderId: String(p?.order_id || "") || undefined,
        amount: Number(p?.amount || 0) / 100, currency: "INR",
        occurredAt: new Date(), rawEvent: body,
      };
    });
  }
  return { RazorpayAdapter };
});

describe("Delivery lifecycle: completion credits earnings exactly once", () => {
  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test-webhook-secret";
  });

  async function setupDeliveredReadyOrder(runId: string) {
    const customer = await createTestUser({ email: `dl_cust_${runId}@example.com`, phone: `93${String(Date.now()).slice(-8)}`, role: "customer", status: "active" });
    const customerHeaders = getAuthHeaders(customer);
    const admin = await createTestAdmin({ email: `dl_admin_${runId}@example.com` });
    const adminId = String((admin as any)._id);

    const product = await Product.create({
      name: `DL ${runId}`, description: "x", category: "electronics", price: 100, gstRate: 18,
      stock: 10, reservedStock: 0,
      images: [{ publicId: "t", url: "https://example.com/t.jpg", variants: { original: "https://example.com/t.jpg" } } as any],
      tags: [],
    } as any);

    const { Pincode } = await import("../../src/models/Pincode");
    await Pincode.findOneAndUpdate({ pincode: "500001" }, { pincode: "500001", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" }, { upsert: true });
    await User.updateOne({ _id: (customer as any)._id }, { $set: { addresses: [{ name: "C", phone: "9876543210", label: "Home", addressLine: "1 St", city: "Hyderabad", state: "Telangana", pincode: "500001", lat: 17.385, lng: 78.4867, isDefault: true, isGeocoded: true, coordsSource: "saved" }] } });

    await request(app).post("/api/cart/add").set(customerHeaders).send({ productId: String(product._id), quantity: 2 }).expect(200);
    const orderRes = await request(app).post("/api/orders").set(customerHeaders).set("x-idempotency-key", `dl_order_${runId}`).send({ paymentMethod: "razorpay" }).expect(201);
    const orderId = String(orderRes.body?.order?._id || orderRes.body?.order?.id);

    const piRes = await request(app).post("/api/payment-intents").set(customerHeaders).send({ orderId, method: "RAZORPAY", idempotencyKey: `dl_pi_${runId}` }).expect(201);
    const piDoc = await PaymentIntent.findById(String(piRes.body.paymentIntentId)).lean();
    const gatewayOrderId = String((piDoc as any)?.gatewayOrderId || "order_mock_delivery_earn");
    const orderForAmount: any = await Order.findById(orderId).select("totalAmount").lean();

    const payload = { event: "payment.captured", payload: { payment: { entity: { id: `pay_dl_${runId}`, order_id: gatewayOrderId, amount: Math.round(Number(orderForAmount.totalAmount) * 100), currency: "INR", created_at: Math.floor(Date.now() / 1000) } } } };
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", String(process.env.RAZORPAY_WEBHOOK_SECRET)).update(new Uint8Array(Buffer.from(bodyString))).digest("hex");
    await request(app).post("/api/webhooks/razorpay").set("Content-Type", "application/json").set("x-razorpay-signature", signature).send(bodyString).expect(200);

    // Delivery partner
    const deliveryUser = await createTestUser({ email: `dl_rider_${runId}@example.com`, phone: `92${String(Date.now()).slice(-8)}`, role: "delivery", status: "active" });
    const deliveryHeaders = getAuthHeaders(deliveryUser);
    const deliveryBoy = await DeliveryBoy.create({
      name: "DL Rider", phone: String((deliveryUser as any).phone), vehicleType: "AUTO", isActive: true, availability: "available",
      currentLocation: { lat: 17.385, lng: 78.4867, lastUpdatedAt: new Date() }, userId: deliveryUser._id, earnings: 0, completedOrdersCount: 0, assignedOrders: [],
    });

    // Admin drives CONFIRMED → PACKED → ASSIGNED, assigns rider.
    await orderStateService.transition({ orderId, toStatus: OrderStatus.CONFIRMED, actorRole: "ADMIN", actorId: adminId });
    await orderStateService.transition({ orderId, toStatus: OrderStatus.PACKED, actorRole: "ADMIN", actorId: adminId });
    await orderStateService.transition({ orderId, toStatus: OrderStatus.ASSIGNED, actorRole: "ADMIN", actorId: adminId });
    await Order.updateOne({ _id: new mongoose.Types.ObjectId(orderId) }, { $set: { deliveryBoyId: deliveryBoy._id, deliveryPartnerId: deliveryUser._id, "earnings.deliveryFee": 40 } });

    // Rider: pickup → start → arrived.
    await request(app).post(`/api/delivery/orders/${orderId}/pickup`).set(deliveryHeaders).send({}).expect(200);
    await request(app).post(`/api/delivery/orders/${orderId}/start-delivery`).set(deliveryHeaders).send({}).expect(200);
    await request(app).post(`/api/delivery/orders/${orderId}/arrived`).set(deliveryHeaders).send({}).expect(200);
    await request(app).post(`/api/delivery/orders/${orderId}/deliver`).set(deliveryHeaders).send({}).expect(200);

    const otpDoc: any = await Order.findById(orderId).select("deliveryOtp").lean();
    const otp = String(otpDoc?.deliveryOtp || "").trim();

    return { orderId, deliveryHeaders, deliveryBoy, otp };
  }

  it("delivers via OTP, credits exactly one earning, and rejects duplicate completion", async () => {
    const runId = new mongoose.Types.ObjectId().toString();
    const { orderId, deliveryHeaders, deliveryBoy, otp } = await setupDeliveredReadyOrder(runId);
    expect(otp).toHaveLength(4);

    // First completion succeeds.
    await request(app).post(`/api/delivery/orders/${orderId}/verify-otp`).set(deliveryHeaders).send({ otp }).expect(200);

    const delivered: any = await Order.findById(orderId).select("orderStatus").lean();
    expect(String(delivered.orderStatus).toUpperCase()).toBe("DELIVERED");

    // Exactly one earning credited.
    const earnings = await DeliveryEarning.find({ orderId: new mongoose.Types.ObjectId(orderId), deliveryBoyId: (deliveryBoy as any)._id }).lean();
    expect(earnings.length).toBe(1);

    const boyAfter: any = await DeliveryBoy.findById((deliveryBoy as any)._id).select("earnings").lean();
    const earningsBalance = Number(boyAfter.earnings);
    expect(earningsBalance).toBeGreaterThan(0);

    // Duplicate completion (e.g. double tap / offline replay) is rejected — order already DELIVERED.
    const dup = await request(app).post(`/api/delivery/orders/${orderId}/verify-otp`).set(deliveryHeaders).send({ otp });
    expect(dup.status).toBe(409);

    // Earnings unchanged — no double credit.
    const earnings2 = await DeliveryEarning.find({ orderId: new mongoose.Types.ObjectId(orderId), deliveryBoyId: (deliveryBoy as any)._id }).lean();
    expect(earnings2.length).toBe(1);
    const boyAfter2: any = await DeliveryBoy.findById((deliveryBoy as any)._id).select("earnings").lean();
    expect(Number(boyAfter2.earnings)).toBe(earningsBalance);
  });
});
