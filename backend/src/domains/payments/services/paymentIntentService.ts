import { PaymentIntent } from "../models/PaymentIntent";
import { RazorpayAdapter } from "../adapters/RazorpayAdapter";
import { Order } from "../../../models/Order";
import { assertAllowedTransition } from "./paymentIntentStateMachine";

export async function createRazorpayPaymentIntent(args: {
  userId: string;
  orderId: string;
  idempotencyKey: string;
}): Promise<{
  paymentIntentId: string;
  gateway: "RAZORPAY";
  razorpayOrderId: string;
  amount: number;
  currency: string;
  expiresAt: Date;
  checkoutPayload: Record<string, any>;
}> {
  const key = String(args.idempotencyKey || "").trim();
  if (!key) {
    throw new Error("Idempotency key is required");
  }

  const order: any = await Order.findById(args.orderId).select("userId totalAmount paymentStatus");
  if (!order) {
    const err: any = new Error("Order not found");
    err.statusCode = 404;
    throw err;
  }

  if (String(order.userId) !== String(args.userId)) {
    const err: any = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

  const ps = String(order.paymentStatus || "").toUpperCase();
  if (ps === "PAID") {
    const err: any = new Error("Order is already paid");
    err.statusCode = 409;
    throw err;
  }

  const existingByKey = await PaymentIntent.findOne({ idempotencyKey: key });
  if (existingByKey) {
    return {
      paymentIntentId: String(existingByKey._id),
      gateway: "RAZORPAY",
      razorpayOrderId: String(existingByKey.gatewayOrderId || ""),
      amount: Number(existingByKey.amount),
      currency: String(existingByKey.currency || "INR"),
      expiresAt: existingByKey.expiresAt,
      checkoutPayload: (existingByKey.checkoutPayload || {}) as any,
    };
  }

  const existingCount = await PaymentIntent.countDocuments({ orderId: args.orderId });
  const attemptNo = existingCount + 1;
  if (attemptNo > 3) {
    const err: any = new Error("Max payment attempts exceeded");
    err.statusCode = 429;
    throw err;
  }

  const amount = Number(order.totalAmount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err: any = new Error("Invalid order amount");
    err.statusCode = 400;
    throw err;
  }

  const expiresAt = new Date(Date.now() + 15 * 60_000);

  const intent = await PaymentIntent.create({
    orderId: args.orderId,
    attemptNo,
    idempotencyKey: key,
    gateway: "RAZORPAY",
    amount,
    currency: "INR",
    status: "CREATED",
    expiresAt,
  });

  try {
    const adapter = new RazorpayAdapter();
    const receipt = `pi_${String(intent._id)}_${String(args.orderId)}`;

    const created = await adapter.createOrder({
      amount,
      currency: "INR",
      receipt,
      notes: {
        orderId: String(args.orderId),
        paymentIntentId: String(intent._id),
        attemptNo: String(attemptNo),
      },
    });

    assertAllowedTransition(String(intent.status) as any, "GATEWAY_ORDER_CREATED");

    intent.status = "GATEWAY_ORDER_CREATED" as any;
    intent.gatewayOrderId = created.gatewayOrderId;
    intent.checkoutPayload = created.checkoutPayload;
    await intent.save();

    return {
      paymentIntentId: String(intent._id),
      gateway: "RAZORPAY",
      razorpayOrderId: String(created.gatewayOrderId),
      amount,
      currency: "INR",
      expiresAt,
      checkoutPayload: created.checkoutPayload,
    };
  } catch (e: any) {
    try {
      intent.status = "FAILED" as any;
      await intent.save();
    } catch {
      // ignore
    }
    throw e;
  }
}
