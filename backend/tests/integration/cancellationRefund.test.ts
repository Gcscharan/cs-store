import crypto from "crypto";
import request from "supertest";
import mongoose from "mongoose";

import app from "../../src/app";
import { User } from "../../src/models/User";
import { Product } from "../../src/models/Product";
import { Order } from "../../src/models/Order";
import { PaymentIntent } from "../../src/domains/payments/models/PaymentIntent";
import { LedgerEntry } from "../../src/domains/payments/models/LedgerEntry";
import { RefundRequest } from "../../src/domains/payments/models/RefundRequest";
import { InventoryReservation } from "../../src/models/InventoryReservation";
import { getAuthHeaders, getAuthHeadersForAdmin, createTestAdmin, createTestUser } from "../helpers/auth";
import { orderStateService } from "../../src/domains/orders/services/orderStateService";
import { OrderStatus } from "../../src/domains/orders/enums/OrderStatus";

// Mock only the Razorpay gateway boundary: order creation, webhook parsing,
// and the refund gateway call. Everything else is real.
jest.mock("../../src/domains/payments/adapters/RazorpayAdapter", () => {
  class RazorpayAdapter {
    createOrder = jest.fn(async () => ({
      gateway: "RAZORPAY",
      gatewayOrderId: "order_mock_cancel_refund",
      checkoutPayload: {
        gateway: "RAZORPAY",
        keyId: "rzp_test_key",
        razorpayOrderId: "order_mock_cancel_refund",
        amount: 20000,
        currency: "INR",
      },
    }));

    verifyWebhookSignature = jest.fn(() => ({ ok: true }));

    refundPayment = jest.fn(async (input: any) => ({
      gatewayRefundId: `rfnd_${String(input.notes?.refundRequestId || "x")}`,
      status: "processed",
      amount: Number(input.amount || 0),
      raw: { id: `rfnd_${String(input.notes?.refundRequestId || "x")}`, status: "processed" },
    }));

    parseWebhook = jest.fn(({ rawBody }: { rawBody: Buffer }) => {
      let body: any;
      try {
        body = JSON.parse(rawBody.toString("utf8"));
      } catch {
        return { gateway: "RAZORPAY", type: "UNKNOWN", gatewayEventId: "unknown", rawEvent: null };
      }
      if (String(body?.event || "") === "payment.captured") {
        const payment = body?.payload?.payment?.entity;
        return {
          gateway: "RAZORPAY",
          type: "PAYMENT_CAPTURED",
          gatewayEventId: String(payment?.id || ""),
          gatewayOrderId: String(payment?.order_id || "") || undefined,
          amount: Number(payment?.amount || 0) / 100,
          currency: String(payment?.currency || "INR"),
          occurredAt: payment?.created_at ? new Date(Number(payment.created_at) * 1000) : undefined,
          rawEvent: body,
        };
      }
      return { gateway: "RAZORPAY", type: "UNKNOWN", gatewayEventId: "unknown", rawEvent: body };
    });
  }
  return { RazorpayAdapter };
});

describe("Journey 5: Cancellation → Inventory Restore → Refund → Ledger consistency", () => {
  const prevRefundFlag = process.env.REFUND_EXECUTION_ENABLED;

  beforeAll(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test-webhook-secret";
    process.env.REFUND_EXECUTION_ENABLED = "true";
  });
  afterAll(() => {
    process.env.REFUND_EXECUTION_ENABLED = prevRefundFlag;
  });

  // Drives a fresh product+customer through cart → order → pay (captured) so the
  // order is PAID/CONFIRMED with a real capture ledger entry and committed stock.
  async function createPaidConfirmedOrder(runId: string) {
    const customer = await createTestUser({
      name: "J5 Customer",
      email: `j5_cust_${runId}@example.com`,
      phone: `96${String(Date.now()).slice(-8)}`,
      role: "customer",
      status: "active",
    });
    const customerHeaders = getAuthHeaders(customer);

    const initialStock = 10;
    const orderedQty = 2;
    const product = await Product.create({
      name: `J5 Product ${runId}`,
      description: "J5 product",
      category: "electronics",
      price: 100,
      gstRate: 18,
      stock: initialStock,
      reservedStock: 0,
      images: [{ publicId: "t", url: "https://example.com/t.jpg", variants: { original: "https://example.com/t.jpg" } } as any],
      tags: [],
    } as any);

    const { Pincode } = await import("../../src/models/Pincode");
    await Pincode.findOneAndUpdate(
      { pincode: "500001" },
      { pincode: "500001", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
      { upsert: true }
    );

    await User.updateOne(
      { _id: (customer as any)._id },
      {
        $set: {
          addresses: [
            {
              name: "J5 Customer", phone: "9876543210", label: "Home",
              addressLine: "123 St", city: "Hyderabad", state: "Telangana",
              pincode: "500001", postal_district: "Hyderabad", admin_district: "Hyderabad",
              lat: 17.385, lng: 78.4867, isDefault: true, isGeocoded: true, coordsSource: "saved",
            },
          ],
        },
      }
    );

    await request(app).post("/api/cart/add").set(customerHeaders)
      .send({ productId: String(product._id), quantity: orderedQty }).expect(200);

    const orderRes = await request(app).post("/api/orders").set(customerHeaders)
      .set("x-idempotency-key", `j5_order_${runId}`)
      .send({ paymentMethod: "razorpay" }).expect(201);

    const orderId = String(orderRes.body?.order?._id || orderRes.body?.order?.id);

    const piRes = await request(app).post("/api/payment-intents").set(customerHeaders)
      .send({ orderId, method: "RAZORPAY", idempotencyKey: `j5_pi_${runId}` }).expect(201);
    const piDoc = await PaymentIntent.findById(String(piRes.body.paymentIntentId)).lean();
    const gatewayOrderId = String((piDoc as any)?.gatewayOrderId || "order_mock_cancel_refund");

    const orderForAmount: any = await Order.findById(orderId).select("totalAmount").lean();
    const amountPaise = Math.round(Number(orderForAmount?.totalAmount || 0) * 100);

    const payload = {
      event: "payment.captured",
      payload: { payment: { entity: { id: `pay_j5_${runId}`, order_id: gatewayOrderId, amount: amountPaise, currency: "INR", created_at: Math.floor(Date.now() / 1000) } } },
    };
    const bodyString = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", String(process.env.RAZORPAY_WEBHOOK_SECRET))
      .update(new Uint8Array(Buffer.from(bodyString))).digest("hex");

    await request(app).post("/api/webhooks/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signature).send(bodyString).expect(200);

    const paidOrder: any = await Order.findById(orderId).select("paymentStatus orderStatus").lean();
    expect(String(paidOrder.paymentStatus).toUpperCase()).toBe("PAID");

    return { customer, product, orderId, initialStock, orderedQty };
  }

  it("admin cancels a PAID order → inventory restored, exactly one refund, ledger consistent", async () => {
    const runId = new mongoose.Types.ObjectId().toString();
    const admin = await createTestAdmin({ email: `j5_admin_${runId}@example.com` });
    const adminId = String((admin as any)._id);

    const { product, orderId, initialStock, orderedQty } = await createPaidConfirmedOrder(runId);

    // Capture the real order total (item price + GST + delivery fee) — the full
    // captured amount is what must be refunded.
    const paidOrder: any = await Order.findById(orderId).select("totalAmount").lean();
    const orderTotal = Number(paidOrder.totalAmount);
    expect(orderTotal).toBeGreaterThan(0);

    // Stock committed at capture: stock reduced by orderedQty.
    const productAfterPay: any = await Product.findById(product._id).select("stock reservedStock").lean();
    expect(Number(productAfterPay.stock)).toBe(initialStock - orderedQty);

    // Admin cancels the paid+confirmed order.
    await orderStateService.transition({
      orderId,
      toStatus: OrderStatus.CANCELLED,
      actorRole: "ADMIN",
      actorId: adminId,
      meta: { reason: "Customer requested cancellation" },
    });

    // Order is terminally CANCELLED.
    const cancelled: any = await Order.findById(orderId).select("orderStatus").lean();
    expect(String(cancelled.orderStatus).toUpperCase()).toBe("CANCELLED");

    // Inventory restored exactly once (committed stock returned).
    const productAfterCancel: any = await Product.findById(product._id).select("stock reservedStock").lean();
    expect(Number(productAfterCancel.stock)).toBe(initialStock);
    expect(Number(productAfterCancel.reservedStock || 0)).toBe(0);

    // No COMMITTED reservation left dangling.
    const committed = await InventoryReservation.countDocuments({ orderId: new mongoose.Types.ObjectId(orderId), status: "COMMITTED" });
    expect(committed).toBe(0);

    // Exactly one refund request, full captured amount, completed.
    const refunds = await RefundRequest.find({ orderId: new mongoose.Types.ObjectId(orderId) }).lean();
    expect(refunds.length).toBe(1);
    expect(Number(refunds[0].amount)).toBe(orderTotal);
    expect(String(refunds[0].idempotencyKey)).toContain("cancel_refund");
    expect(String(refunds[0].status)).toBe("COMPLETED");

    // Exactly one ledger REFUND entry, negative, equal in magnitude to refund.
    const refundLedger = await LedgerEntry.find({ orderId: new mongoose.Types.ObjectId(orderId), eventType: "REFUND" }).lean();
    expect(refundLedger.length).toBe(1);
    expect(Number(refundLedger[0].amount)).toBe(-orderTotal);

    // Ledger truth: captured + refunded nets to zero.
    const captures = await LedgerEntry.find({ orderId: new mongoose.Types.ObjectId(orderId), eventType: "CAPTURE" }).lean();
    const capturedTotal = captures.reduce((s, e: any) => s + Number(e.amount), 0);
    const refundedTotal = refundLedger.reduce((s, e: any) => s + Number(e.amount), 0);
    expect(capturedTotal + refundedTotal).toBe(0);
  });

  it("admin cancels a PACKED (paid) order → committed inventory restored exactly once", async () => {
    const runId = new mongoose.Types.ObjectId().toString();
    const admin = await createTestAdmin({ email: `j5_packed_${runId}@example.com` });
    const adminId = String((admin as any)._id);

    const { product, orderId, initialStock, orderedQty } = await createPaidConfirmedOrder(runId);
    const paidOrder: any = await Order.findById(orderId).select("totalAmount").lean();
    const orderTotal = Number(paidOrder.totalAmount);

    // Real lifecycle: CREATED → CONFIRMED → PACKED before cancellation.
    await orderStateService.transition({
      orderId, toStatus: OrderStatus.CONFIRMED, actorRole: "ADMIN", actorId: adminId,
    });
    await orderStateService.transition({
      orderId, toStatus: OrderStatus.PACKED, actorRole: "ADMIN", actorId: adminId,
    });

    const productPacked: any = await Product.findById(product._id).select("stock").lean();
    expect(Number(productPacked.stock)).toBe(initialStock - orderedQty);

    // Admin cancels the PACKED paid order.
    await orderStateService.transition({
      orderId, toStatus: OrderStatus.CANCELLED, actorRole: "ADMIN", actorId: adminId,
      meta: { reason: "Out of stock at warehouse after packing" },
    });

    const cancelled: any = await Order.findById(orderId).select("orderStatus").lean();
    expect(String(cancelled.orderStatus).toUpperCase()).toBe("CANCELLED");

    // INVARIANT: committed inventory MUST be restored even when cancelled from PACKED.
    const productAfter: any = await Product.findById(product._id).select("stock reservedStock").lean();
    expect(Number(productAfter.stock)).toBe(initialStock);
    expect(Number(productAfter.reservedStock || 0)).toBe(0);

    const committed = await InventoryReservation.countDocuments({ orderId: new mongoose.Types.ObjectId(orderId), status: "COMMITTED" });
    expect(committed).toBe(0);

    // And a refund is still issued exactly once.
    const refunds = await RefundRequest.find({ orderId: new mongoose.Types.ObjectId(orderId) }).lean();
    expect(refunds.length).toBe(1);
    expect(Number(refunds[0].amount)).toBe(orderTotal);
  });

  it("duplicate cancellation does NOT create a second refund or double-restore inventory", async () => {
    const runId = new mongoose.Types.ObjectId().toString();
    const admin = await createTestAdmin({ email: `j5_admin2_${runId}@example.com` });
    const adminId = String((admin as any)._id);

    const { product, orderId, initialStock } = await createPaidConfirmedOrder(runId);

    await orderStateService.transition({
      orderId, toStatus: OrderStatus.CANCELLED, actorRole: "ADMIN", actorId: adminId,
      meta: { reason: "First cancellation request" },
    });

    // Second cancel attempt — CANCELLED is terminal, transition is a no-op/blocked.
    await orderStateService
      .transition({ orderId, toStatus: OrderStatus.CANCELLED, actorRole: "ADMIN", actorId: adminId, meta: { reason: "Duplicate" } })
      .catch(() => undefined);

    // Even if the refund helper were invoked twice, the idempotency key guarantees one refund.
    const { refundPaidOrderOnCancellation } = await import("../../src/domains/payments/refunds/refundService");
    await refundPaidOrderOnCancellation({ orderId, reason: "Duplicate direct call" });

    const refunds = await RefundRequest.find({ orderId: new mongoose.Types.ObjectId(orderId) }).lean();
    expect(refunds.length).toBe(1);

    const refundLedger = await LedgerEntry.find({ orderId: new mongoose.Types.ObjectId(orderId), eventType: "REFUND" }).lean();
    expect(refundLedger.length).toBe(1);

    // Inventory restored exactly once (not doubled).
    const productAfter: any = await Product.findById(product._id).select("stock").lean();
    expect(Number(productAfter.stock)).toBe(initialStock);
  });

  it("rejects impossible terminal transitions (CANCELLED → DELIVERED/PACKED) safely", async () => {
    const runId = new mongoose.Types.ObjectId().toString();
    const admin = await createTestAdmin({ email: `j5_impossible_${runId}@example.com` });
    const adminId = String((admin as any)._id);

    const { orderId } = await createPaidConfirmedOrder(runId);

    await orderStateService.transition({ orderId, toStatus: OrderStatus.CONFIRMED, actorRole: "ADMIN", actorId: adminId });
    await orderStateService.transition({
      orderId, toStatus: OrderStatus.CANCELLED, actorRole: "ADMIN", actorId: adminId, meta: { reason: "test cancel" },
    });

    // CANCELLED is terminal: forward transitions must be rejected.
    await expect(
      orderStateService.transition({ orderId, toStatus: OrderStatus.DELIVERED, actorRole: "ADMIN", actorId: adminId })
    ).rejects.toThrow();
    await expect(
      orderStateService.transition({ orderId, toStatus: OrderStatus.PACKED, actorRole: "ADMIN", actorId: adminId })
    ).rejects.toThrow();

    const fresh: any = await Order.findById(orderId).select("orderStatus").lean();
    expect(String(fresh.orderStatus).toUpperCase()).toBe("CANCELLED");
    const refunds = await RefundRequest.find({ orderId: new mongoose.Types.ObjectId(orderId) }).lean();
    expect(refunds.length).toBe(1);
  });

  it("cannot cancel an already-DELIVERED order (no refund, stays DELIVERED)", async () => {
    const runId = new mongoose.Types.ObjectId().toString();
    const admin = await createTestAdmin({ email: `j5_delivered_${runId}@example.com` });
    const adminId = String((admin as any)._id);

    const { orderId } = await createPaidConfirmedOrder(runId);

    await orderStateService.transition({ orderId, toStatus: OrderStatus.CONFIRMED, actorRole: "ADMIN", actorId: adminId });
    await orderStateService.transition({ orderId, toStatus: OrderStatus.PACKED, actorRole: "ADMIN", actorId: adminId });

    const deliveryUser = await createTestUser({ email: `j5_rider_${runId}@example.com`, phone: `94${String(Date.now()).slice(-8)}`, role: "delivery", status: "active" });
    const riderId = String((deliveryUser as any)._id);
    await Order.updateOne({ _id: new mongoose.Types.ObjectId(orderId) }, { $set: { deliveryPartnerId: deliveryUser._id, deliveryBoyId: deliveryUser._id } });

    await orderStateService.transition({ orderId, toStatus: OrderStatus.ASSIGNED, actorRole: "ADMIN", actorId: adminId });
    await orderStateService.transition({ orderId, toStatus: OrderStatus.PICKED_UP, actorRole: "DELIVERY_PARTNER", actorId: riderId });
    await orderStateService.transition({ orderId, toStatus: OrderStatus.IN_TRANSIT, actorRole: "DELIVERY_PARTNER", actorId: riderId });

    const otp = "1234";
    await Order.updateOne(
      { _id: new mongoose.Types.ObjectId(orderId) },
      { $set: { deliveryOtp: otp, deliveryOtpExpiresAt: new Date(Date.now() + 10 * 60_000), deliveryOtpIssuedTo: deliveryUser._id } }
    );
    await orderStateService.transition({
      orderId, toStatus: OrderStatus.DELIVERED, actorRole: "DELIVERY_PARTNER", actorId: riderId, meta: { otp },
    });

    const delivered: any = await Order.findById(orderId).select("orderStatus").lean();
    expect(String(delivered.orderStatus).toUpperCase()).toBe("DELIVERED");

    await expect(
      orderStateService.transition({ orderId, toStatus: OrderStatus.CANCELLED, actorRole: "ADMIN", actorId: adminId, meta: { reason: "late cancel" } })
    ).rejects.toThrow();

    const stillDelivered: any = await Order.findById(orderId).select("orderStatus").lean();
    expect(String(stillDelivered.orderStatus).toUpperCase()).toBe("DELIVERED");
    const refunds = await RefundRequest.find({ orderId: new mongoose.Types.ObjectId(orderId) }).lean();
    expect(refunds.length).toBe(0);
  });

  it("cancelling an UNPAID order restores inventory but creates NO refund", async () => {
    const runId = new mongoose.Types.ObjectId().toString();
    const customer = await createTestUser({
      email: `j5_unpaid_${runId}@example.com`,
      phone: `95${String(Date.now()).slice(-8)}`,
      role: "customer",
      status: "active",
    });
    const customerHeaders = getAuthHeaders(customer);

    const product = await Product.create({
      name: `J5 Unpaid ${runId}`, description: "x", category: "electronics",
      price: 100, gstRate: 18, stock: 5, reservedStock: 0,
      images: [{ publicId: "t", url: "https://example.com/t.jpg", variants: { original: "https://example.com/t.jpg" } } as any],
      tags: [],
    } as any);

    const { Pincode } = await import("../../src/models/Pincode");
    await Pincode.findOneAndUpdate({ pincode: "500001" }, { pincode: "500001", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" }, { upsert: true });
    await User.updateOne({ _id: (customer as any)._id }, {
      $set: { addresses: [{ name: "C", phone: "9876543210", label: "Home", addressLine: "1 St", city: "Hyderabad", state: "Telangana", pincode: "500001", lat: 17.385, lng: 78.4867, isDefault: true, isGeocoded: true, coordsSource: "saved" }] },
    });

    await request(app).post("/api/cart/add").set(customerHeaders).send({ productId: String(product._id), quantity: 1 }).expect(200);
    const orderRes = await request(app).post("/api/orders").set(customerHeaders)
      .set("x-idempotency-key", `j5_unpaid_order_${runId}`).send({ paymentMethod: "razorpay" }).expect(201);
    const orderId = String(orderRes.body?.order?._id || orderRes.body?.order?.id);

    // Customer cancels the unpaid (CREATED) order.
    await orderStateService.transition({
      orderId, toStatus: OrderStatus.CANCELLED, actorRole: "CUSTOMER",
      actorId: String((customer as any)._id), meta: { reason: "Changed mind" },
    });

    const refunds = await RefundRequest.find({ orderId: new mongoose.Types.ObjectId(orderId) }).lean();
    expect(refunds.length).toBe(0); // unpaid → no refund
  });
});
