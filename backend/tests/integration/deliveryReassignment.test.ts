import crypto from "crypto";
import request from "supertest";
import mongoose from "mongoose";

import app from "../../src/app";
import { User } from "../../src/models/User";
import { Product } from "../../src/models/Product";
import { Order } from "../../src/models/Order";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { DeliveryBoy } from "../../src/models/DeliveryBoy";
import { getAuthHeaders, createTestAdmin, createTestUser } from "../helpers/auth";
import { orderStateService } from "../../src/domains/orders/services/orderStateService";
import { OrderStatus } from "../../src/domains/orders/enums/OrderStatus";
import { assignPackedOrderToDeliveryBoy } from "../../src/controllers/orderAssignmentController";

jest.mock("../../src/domains/payments/adapters/RazorpayAdapter", () => {
  class RazorpayAdapter {
    createOrder = jest.fn(async () => ({
      gateway: "RAZORPAY", gatewayOrderId: "order_mock_reassign",
      checkoutPayload: { gateway: "RAZORPAY", keyId: "k", razorpayOrderId: "order_mock_reassign", amount: 20000, currency: "INR" },
    }));
    verifyWebhookSignature = jest.fn(() => ({ ok: true }));
    parseWebhook = jest.fn(({ rawBody }: { rawBody: Buffer }) => {
      const body = JSON.parse(rawBody.toString("utf8"));
      const p = body?.payload?.payment?.entity;
      return { gateway: "RAZORPAY", type: "PAYMENT_CAPTURED", gatewayEventId: String(p?.id || ""), gatewayOrderId: String(p?.order_id || "") || undefined, amount: Number(p?.amount || 0) / 100, currency: "INR", occurredAt: new Date(), rawEvent: body };
    });
  }
  return { RazorpayAdapter };
});

describe("Delivery reassignment: ownership transfers atomically; old rider locked out", () => {
  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test-webhook-secret";
  });

  async function makeRider(runId: string, tag: string) {
    const u = await createTestUser({ email: `re_${tag}_${runId}@example.com`, phone: `9${tag === "a" ? "1" : "0"}${String(Date.now()).slice(-8)}`, role: "delivery", status: "active" });
    const boy = await DeliveryBoy.create({
      name: `Rider ${tag}`, phone: String((u as any).phone), vehicleType: "AUTO", isActive: true, availability: "available",
      currentLocation: { lat: 17.385, lng: 78.4867, lastUpdatedAt: new Date() }, userId: u._id, earnings: 0, completedOrdersCount: 0, assignedOrders: [], currentLoad: 0,
    });
    return { user: u, headers: getAuthHeaders(u), boy };
  }

  async function packedPaidOrder(runId: string) {
    const customer = await createTestUser({ email: `re_cust_${runId}@example.com`, phone: `98${String(Date.now()).slice(-8)}`, role: "customer", status: "active" });
    const customerHeaders = getAuthHeaders(customer);
    const admin = await createTestAdmin({ email: `re_admin_${runId}@example.com` });
    const adminId = String((admin as any)._id);

    const product = await Product.create({
      name: `RE ${runId}`, description: "x", category: "electronics", price: 100, gstRate: 18, stock: 10, reservedStock: 0,
      images: [{ publicId: "t", url: "https://example.com/t.jpg", variants: { original: "https://example.com/t.jpg" } } as any], tags: [],
    } as any);
    const { Pincode } = await import("../../src/models/Pincode");
    await Pincode.findOneAndUpdate({ pincode: "500001" }, { pincode: "500001", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" }, { upsert: true });
    await User.updateOne({ _id: (customer as any)._id }, { $set: { addresses: [{ name: "C", phone: "9876543210", label: "Home", addressLine: "1 St", city: "Hyderabad", state: "Telangana", pincode: "500001", lat: 17.385, lng: 78.4867, isDefault: true, isGeocoded: true, coordsSource: "saved" }] } });

    await request(app).post("/api/cart/add").set(customerHeaders).send({ productId: String(product._id), quantity: 1 }).expect(200);
    const orderRes = await request(app).post("/api/orders").set(customerHeaders).set("x-idempotency-key", `re_order_${runId}`).send({ paymentMethod: "razorpay" }).expect(201);
    const orderId = String(orderRes.body?.order?._id || orderRes.body?.order?.id);
    const piRes = await request(app).post("/api/payment-intents").set(customerHeaders).send({ orderId, method: "RAZORPAY", idempotencyKey: `re_pi_${runId}` }).expect(201);
    const piDoc = await PaymentIntent.findById(String(piRes.body.paymentIntentId)).lean();
    const gatewayOrderId = String((piDoc as any)?.gatewayOrderId || "order_mock_reassign");
    const orderForAmount: any = await Order.findById(orderId).select("totalAmount").lean();
    const payload = { event: "payment.captured", payload: { payment: { entity: { id: `pay_re_${runId}`, order_id: gatewayOrderId, amount: Math.round(Number(orderForAmount.totalAmount) * 100), currency: "INR", created_at: Math.floor(Date.now() / 1000) } } } };
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", String(process.env.RAZORPAY_WEBHOOK_SECRET)).update(new Uint8Array(Buffer.from(bodyString))).digest("hex");
    await request(app).post("/api/webhooks/razorpay").set("Content-Type", "application/json").set("x-razorpay-signature", signature).send(bodyString).expect(200);

    await orderStateService.transition({ orderId, toStatus: OrderStatus.CONFIRMED, actorRole: "ADMIN", actorId: adminId });
    await orderStateService.transition({ orderId, toStatus: OrderStatus.PACKED, actorRole: "ADMIN", actorId: adminId });

    return { orderId, adminId };
  }

  it("after A→B reassignment, Rider A is locked out and Rider B owns the order", async () => {
    const runId = new mongoose.Types.ObjectId().toString();
    const { orderId, adminId } = await packedPaidOrder(runId);
    const riderA = await makeRider(runId, "a");
    const riderB = await makeRider(runId, "b");

    // Assign to Rider A.
    await assignPackedOrderToDeliveryBoy({ orderId, deliveryBoyId: String(riderA.boy._id), actorId: adminId, allowReassign: true });

    let order: any = await Order.findById(orderId).select("deliveryBoyId deliveryPartnerId").lean();
    expect(String(order.deliveryBoyId)).toBe(String(riderA.boy._id));

    // Reassign to Rider B.
    await assignPackedOrderToDeliveryBoy({ orderId, deliveryBoyId: String(riderB.boy._id), actorId: adminId, allowReassign: true });

    order = await Order.findById(orderId).select("deliveryBoyId deliveryPartnerId").lean();
    expect(String(order.deliveryBoyId)).toBe(String(riderB.boy._id));
    expect(String(order.deliveryPartnerId)).toBe(String(riderB.user._id));

    // Rider A removed from assignedOrders, load decremented, freed to available.
    const boyA: any = await DeliveryBoy.findById(riderA.boy._id).select("assignedOrders currentLoad availability").lean();
    expect((boyA.assignedOrders || []).map((x: any) => String(x))).not.toContain(String(orderId));
    expect(Number(boyA.currentLoad)).toBeLessThanOrEqual(0);

    // Rider A CANNOT pick up (ownership revoked) → 403.
    const aPickup = await request(app).post(`/api/delivery/orders/${orderId}/pickup`).set(riderA.headers).send({});
    expect(aPickup.status).toBe(403);

    // Rider B CAN pick up.
    const bPickup = await request(app).post(`/api/delivery/orders/${orderId}/pickup`).set(riderB.headers).send({});
    expect(bPickup.status).toBe(200);

    const afterPickup: any = await Order.findById(orderId).select("orderStatus deliveryBoyId").lean();
    expect(String(afterPickup.orderStatus).toUpperCase()).toBe("PICKED_UP");
    expect(String(afterPickup.deliveryBoyId)).toBe(String(riderB.boy._id));
  });

  it("cannot reassign once the order is already PICKED_UP", async () => {
    const runId = new mongoose.Types.ObjectId().toString();
    const { orderId, adminId } = await packedPaidOrder(runId);
    const riderA = await makeRider(runId, "a");
    const riderB = await makeRider(runId, "b");

    await assignPackedOrderToDeliveryBoy({ orderId, deliveryBoyId: String(riderA.boy._id), actorId: adminId, allowReassign: true });
    await request(app).post(`/api/delivery/orders/${orderId}/pickup`).set(riderA.headers).send({}).expect(200);

    // Reassignment after pickup must be rejected (409) — order is in-flight with A.
    await expect(
      assignPackedOrderToDeliveryBoy({ orderId, deliveryBoyId: String(riderB.boy._id), actorId: adminId, allowReassign: true })
    ).rejects.toMatchObject({ statusCode: 409 });

    const order: any = await Order.findById(orderId).select("deliveryBoyId orderStatus").lean();
    expect(String(order.deliveryBoyId)).toBe(String(riderA.boy._id));
    expect(String(order.orderStatus).toUpperCase()).toBe("PICKED_UP");
  });

  it("after reassignment, the old rider can no longer inject customer-facing location", async () => {
    const prevMode = process.env.TRACKING_KILL_SWITCH_MODE;
    process.env.TRACKING_KILL_SWITCH_MODE = "INGEST_ONLY";
    try {
      const runId = new mongoose.Types.ObjectId().toString();
      const { orderId, adminId } = await packedPaidOrder(runId);
      const riderA = await makeRider(runId, "a");
      const riderB = await makeRider(runId, "b");

      await assignPackedOrderToDeliveryBoy({ orderId, deliveryBoyId: String(riderA.boy._id), actorId: adminId, allowReassign: true });

      // While A owns it, A's location is accepted.
      const aBefore = await request(app)
        .post("/api/internal/tracking/location")
        .set(riderA.headers)
        .send({ schemaVersion: 1, riderId: String(riderA.user._id), orderId, seq: 1, lat: 17.41, lng: 78.39, accuracyM: 12, speedMps: 2, deviceTs: new Date().toISOString() });
      expect(aBefore.status).toBe(200);

      // Reassign to B.
      await assignPackedOrderToDeliveryBoy({ orderId, deliveryBoyId: String(riderB.boy._id), actorId: adminId, allowReassign: true });

      // A (now off the order) is REJECTED — cannot move the customer's map anymore.
      const aAfter = await request(app)
        .post("/api/internal/tracking/location")
        .set(riderA.headers)
        .send({ schemaVersion: 1, riderId: String(riderA.user._id), orderId, seq: 2, lat: 17.50, lng: 78.50, accuracyM: 12, speedMps: 2, deviceTs: new Date().toISOString() });
      expect(aAfter.status).toBe(403);
      expect(aAfter.body.error).toBe("ownership_mismatch");

      // B (the current owner) is accepted.
      const bAfter = await request(app)
        .post("/api/internal/tracking/location")
        .set(riderB.headers)
        .send({ schemaVersion: 1, riderId: String(riderB.user._id), orderId, seq: 1, lat: 17.42, lng: 78.40, accuracyM: 12, speedMps: 2, deviceTs: new Date().toISOString() });
      expect(bAfter.status).toBe(200);
    } finally {
      if (prevMode === undefined) delete process.env.TRACKING_KILL_SWITCH_MODE;
      else process.env.TRACKING_KILL_SWITCH_MODE = prevMode;
    }
  });
});
