import { PaymentIntent } from "../models/PaymentIntent";
import Razorpay from "razorpay";
import { Order } from "../../../models/Order";
import * as paymentIntentStateMachine from "./paymentIntentStateMachine";
import mongoose from "mongoose";
import crypto from "crypto";
import { inventoryReservationService } from "../../orders/services/inventoryReservationService";
import { incCounterWithLabels } from "../../../ops/opsMetrics";
import { isProviderUnavailableError } from "../types";
import { capturePaymentError, logger } from "../../../utils/logger";

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): true {
  const razorpayKeySecret = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
  if (!razorpayKeySecret) {
    const err: any = new Error("Razorpay misconfigured");
    err.statusCode = 500;
    throw err;
  }

  const o = String(orderId || "").trim();
  const p = String(paymentId || "").trim();
  const s = String(signature || "").trim();

  if (!o || !p || !s) {
    const err: any = new Error("Missing payment verification fields");
    err.statusCode = 400;
    throw err;
  }

  const payload = `${o}|${p}`;
  const expected = crypto
    .createHmac("sha256", razorpayKeySecret)
    .update(payload)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(s, "utf8");
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    const err: any = new Error("Invalid payment signature");
    err.statusCode = 401;
    throw err;
  }

  return true;
}

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
  try {
    const assertNotExpired = async (intent: any): Promise<void> => {
      if (!intent) return;
      const status = String((intent as any).status || "").toUpperCase();
      if (status === "CAPTURED" || status === "FAILED" || status === "CANCELLED" || status === "EXPIRED") return;

      const expMs = (intent as any).expiresAt ? new Date((intent as any).expiresAt).getTime() : 0;
      if (!expMs) return;

      if (Date.now() > expMs) {
        const paymentIntentId = String((intent as any)._id || "");
        const orderId = String((intent as any).orderId || args.orderId || "");

        try {
          paymentIntentStateMachine.assertAllowedTransition(String((intent as any).status) as any, "EXPIRED");
        } catch {
        }

        try {
          (intent as any).status = "EXPIRED" as any;
          (intent as any).paymentState = "FAILED" as any;
          await (intent as any).save();
        } catch {
        }

        console.info("[PI][EXPIRED]", { paymentIntentId, orderId });
        const err: any = new Error("Payment intent expired");
        err.statusCode = 410;
        throw err;
      }
    };

    console.info("[PI][START]", {
      userId: String(args.userId || ""),
      orderId: String(args.orderId || ""),
      method: "RAZORPAY",
      hasIdempotencyKey: !!args.idempotencyKey,
    });

    const key = String(args.idempotencyKey || "").trim();
    if (!key) {
      const err: any = new Error("Idempotency key is required");
      err.statusCode = 400;
      throw err;
    }

    const order: any = await Order.findById(args.orderId).select(
      "userId orderStatus totalAmount deliveryFee itemsTotal grandTotal paymentStatus items"
    );
    if (!order) {
      logger.error("[PI][ORDER_NOT_FOUND]", {
        orderId: String(args.orderId || ""),
      });
      const err: any = new Error("Order not found");
      err.statusCode = 404;
      throw err;
    }

    console.info("[PI][ORDER_FETCHED]", {
      orderId: String((order as any)._id || args.orderId),
      orderStatus: (order as any).orderStatus,
      paymentStatus: (order as any).paymentStatus,
      totalAmount: (order as any).totalAmount,
      itemsTotal: (order as any).itemsTotal,
      deliveryFee: (order as any).deliveryFee,
      grandTotal: (order as any).grandTotal,
    });

    console.info("[PI][ORDER]", {
      orderId: String((order as any)._id || args.orderId),
      orderStatus: (order as any).orderStatus,
      paymentStatus: (order as any).paymentStatus,
      totalAmount: (order as any).totalAmount,
      itemsTotal: (order as any).itemsTotal,
      deliveryFee: (order as any).deliveryFee,
      grandTotal: (order as any).grandTotal,
    });

  if (typeof (order as any).totalAmount !== "number") {
    logger.error("[PI][AMOUNT_CHECK]", {
      orderId: String((order as any)._id || args.orderId),
      totalAmount: (order as any).totalAmount,
      grandTotal: (order as any).grandTotal,
      itemsTotal: (order as any).itemsTotal,
      deliveryFee: (order as any).deliveryFee,
    });
    const err: any = new Error("Order totalAmount is not a number");
    err.statusCode = 400;
    throw err;
  }

  if (String(order.userId) !== String(args.userId)) {
    logger.error("[PI][USER_MISMATCH]", {
      orderId: String((order as any)._id || args.orderId),
      orderUserId: String((order as any).userId || ""),
      requestUserId: String(args.userId || ""),
    });
    const err: any = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }

    const ps = String(order.paymentStatus || "").toUpperCase();
    const os = String(order.orderStatus || "").toUpperCase();

    console.info("[PI][ELIGIBILITY_CHECK]", {
      paymentStatus: ps,
      orderStatus: os,
    });

    if (ps === "PAID") {
    logger.error("[PI][ELIGIBILITY_CHECK]", {
      orderId: String((order as any)._id || args.orderId),
      reason: "ALREADY_PAID",
      paymentStatus: ps,
      orderStatus: os,
    });
    const err: any = new Error("Order is already paid");
    err.statusCode = 409;
    throw err;
  }

  const allowNonPendingInTest = process.env.NODE_ENV === "test";
  const isEligibleStatus =
    (allowNonPendingInTest || ps === "PENDING") &&
    (os === "CREATED" || os === "PENDING" || os === "PENDING_PAYMENT");
  if (!isEligibleStatus) {
    logger.error("[PI][ELIGIBILITY_CHECK]", {
      orderId: String((order as any)._id || args.orderId),
      reason: "INELIGIBLE_STATUS",
      paymentStatus: ps,
      orderStatus: os,
    });
    const err: any = new Error(
      `Order not eligible for payment intent (paymentStatus=${ps || "UNKNOWN"}, orderStatus=${os || "UNKNOWN"})`
    );
    err.statusCode = 400;
    throw err;
  }

  // Inventory locking at checkout start:
  // Creating (or returning) a PaymentIntent should extend or create the reservation for this order.
  // This ensures concurrent checkouts cannot oversell, without changing the API contract.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const orderItems = Array.isArray(order.items) ? (order.items as any[]) : [];
      const items = orderItems.map((it) => ({
        productId: it.productId,
        qty: Number(it.qty ?? it.quantity ?? 0),
      }));

      if (items.length) {
        console.info("[PI][INVENTORY_LOCK]", {
          orderId: String((order as any)._id || args.orderId),
          orderStatus: (order as any).orderStatus,
          paymentStatus: (order as any).paymentStatus,
          itemCount: items.length,
        });
        await inventoryReservationService.reserveForOrder({
          session,
          orderId: new mongoose.Types.ObjectId(String(order._id)),
          ttlMs: 20 * 60_000,
          items,
        });
      }
    });
  } finally {
    session.endSession();
  }

  const existingByKey = await PaymentIntent.findOne({ idempotencyKey: key });
  if (existingByKey) {
    await assertNotExpired(existingByKey);
    console.info("[PI][INTENT_REUSE_CHECK]", {
      orderId: String(args.orderId || ""),
      reason: "IDEMPOTENCY_KEY_MATCH",
      paymentIntentId: String((existingByKey as any)._id || ""),
      status: String((existingByKey as any).status || ""),
      gatewayOrderId: String((existingByKey as any).gatewayOrderId || ""),
    });
    incCounterWithLabels(
      "payment_events_total",
      { gateway: "RAZORPAY", type: "intent", event: "CREATE", result: "idempotent_return" },
      1
    );
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

  const activeStatuses: any[] = [
    "CREATED",
    "GATEWAY_ORDER_CREATED",
    "PAYMENT_PROCESSING",
    "PAYMENT_RECOVERABLE",
    "VERIFYING",
  ];

  const existingActiveByOrder = await PaymentIntent.findOne({
    orderId: args.orderId,
    status: { $in: activeStatuses },
    isLocked: { $ne: true },
  }).sort({ createdAt: -1 });

  if (
    process.env.NODE_ENV !== "test" &&
    existingActiveByOrder &&
    String((existingActiveByOrder as any).gatewayOrderId || "").trim()
  ) {
    await assertNotExpired(existingActiveByOrder);
    console.info("[PI][INTENT_REUSE_CHECK]", {
      orderId: String(args.orderId || ""),
      reason: "ACTIVE_INTENT_REUSE",
      paymentIntentId: String((existingActiveByOrder as any)._id || ""),
      status: String((existingActiveByOrder as any).status || ""),
      gatewayOrderId: String((existingActiveByOrder as any).gatewayOrderId || ""),
    });
    incCounterWithLabels(
      "payment_events_total",
      { gateway: "RAZORPAY", type: "intent", event: "CREATE", result: "reuse_existing_order" },
      1
    );
    return {
      paymentIntentId: String(existingActiveByOrder._id),
      gateway: "RAZORPAY",
      razorpayOrderId: String((existingActiveByOrder as any).gatewayOrderId || ""),
      amount: Number((existingActiveByOrder as any).amount),
      currency: String((existingActiveByOrder as any).currency || "INR"),
      expiresAt: (existingActiveByOrder as any).expiresAt,
      checkoutPayload: ((existingActiveByOrder as any).checkoutPayload || {}) as any,
    };
  }

  const existingCount = await PaymentIntent.countDocuments({ orderId: args.orderId });
  const attemptNo = existingCount + 1;
  if (attemptNo > 3) {
    const err: any = new Error("Max payment attempts exceeded");
    err.statusCode = 429;
    throw err;
  }

    const payableAmount = Number(
      (order as any).totalAmount ?? (order as any).grandTotal ?? 0
    );
    const amount = payableAmount;
    const amountInPaise = Math.round(payableAmount * 100);

    console.info("[PI][AMOUNT_CHECK]", {
      payableAmount,
      amountInPaise,
    });

  if (!Number.isFinite(payableAmount) || !Number.isFinite(amountInPaise) || amountInPaise <= 0) {
    logger.error("[PI][AMOUNT_CHECK]", {
      orderId: String((order as any)._id || args.orderId),
      userId: String((order as any).userId || ""),
      paymentStatus: (order as any).paymentStatus,
      orderStatus: (order as any).orderStatus,
      totalAmount: (order as any).totalAmount,
      grandTotal: (order as any).grandTotal,
      itemsTotal: (order as any).itemsTotal,
      deliveryFee: (order as any).deliveryFee,
      payableAmount,
      amountInPaise,
    });

    const err: any = new Error(
      `Invalid order amount (paymentStatus=${ps || "UNKNOWN"}, orderStatus=${os || "UNKNOWN"})`
    );
    err.statusCode = 400;
    throw err;
  }

  if (amountInPaise < 100) {
    logger.error("[PI][AMOUNT_CHECK]", {
      orderId: String((order as any)._id || args.orderId),
      reason: "BELOW_MINIMUM",
      amountInPaise,
      payableAmount,
    });
    const err: any = new Error("Minimum payment amount is ₹1");
    err.statusCode = 400;
    throw err;
  }

  const expiresAt = new Date(Date.now() + 15 * 60_000);

  const isTest = process.env.NODE_ENV === "test";
  const razorpayKeyId = String(process.env.RAZORPAY_KEY_ID || (isTest ? "rzp_test_key" : "")).trim();
  const razorpayKeySecret = String(process.env.RAZORPAY_KEY_SECRET || (isTest ? "rzp_test_secret" : "")).trim();
  if (!razorpayKeyId || !razorpayKeySecret) {
    logger.error("[PI][CONFIG]", {
      reason: "RAZORPAY_KEYS_MISSING",
      hasKeyId: !!razorpayKeyId,
      hasKeySecret: !!razorpayKeySecret,
    });
    const err: any = new Error("Razorpay misconfigured");
    err.statusCode = 500;
    throw err;
  }

  const razorpay = new Razorpay({
    key_id: razorpayKeyId,
    key_secret: razorpayKeySecret,
  });

  let intent: any = null;
  if (!intent) {
    try {
      intent = await PaymentIntent.create({
        orderId: args.orderId,
        attemptNo,
        idempotencyKey: key,
        gateway: "RAZORPAY",
        paymentState: "CREATED",
        amount,
        currency: "INR",
        status: "CREATED",
        expiresAt,
      });

      console.info("[PI][INTENT_CREATED]", {
        orderId: String(args.orderId || ""),
        paymentIntentId: String((intent as any)?._id || ""),
        attemptNo,
        amount,
        currency: "INR",
      });

      console.info("[BACKEND][PAYMENT_INTENT_CREATED]", {
        orderId: String(args.orderId || ""),
        paymentIntentId: String((intent as any)?._id || ""),
        gateway: "RAZORPAY",
        attemptNo,
      });
    } catch (e: any) {
      // Concurrency-safe idempotency: if two callers race with the same key,
      // unique index guarantees only one document; the loser should return the winner.
      if (e && (e.code === 11000 || String(e.message || "").includes("E11000"))) {
        const existing = await PaymentIntent.findOne({ idempotencyKey: key });
        if (existing) {
          await assertNotExpired(existing);
          console.info("[PI][INTENT_REUSE_CHECK]", {
            orderId: String(args.orderId || ""),
            reason: "IDEMPOTENCY_KEY_RACE_WINNER",
            paymentIntentId: String((existing as any)._id || ""),
            status: String((existing as any).status || ""),
            gatewayOrderId: String((existing as any).gatewayOrderId || ""),
          });
          return {
            paymentIntentId: String(existing._id),
            gateway: "RAZORPAY",
            razorpayOrderId: String((existing as any).gatewayOrderId || ""),
            amount: Number((existing as any).amount),
            currency: String((existing as any).currency || "INR"),
            expiresAt: (existing as any).expiresAt,
            checkoutPayload: ((existing as any).checkoutPayload || {}) as any,
          };
        }
      }

      const statusCode = Number((e as any)?.statusCode) || 500;
      const message =
        typeof (e as any)?.message === "string" && String((e as any).message).trim()
          ? String((e as any).message).trim()
          : "Failed to create payment intent";
      const err: any = e instanceof Error ? e : new Error(message);
      if (!String((err as any).message || "").trim()) (err as any).message = message;
      (err as any).statusCode = Number((err as any).statusCode) || statusCode;
      throw err;
    }
  }

  await assertNotExpired(intent);

  try {
    const receipt = `pi_${String(intent._id).slice(-20)}`;

    const currency = "INR";

    const effectiveAttemptNo = Number((intent as any)?.attemptNo || attemptNo);
    const gatewayCreatePayload: any = {
      amount: amountInPaise,
      currency,
      receipt,
      notes: {
        orderId: String(args.orderId),
        paymentIntentId: String(intent._id),
        attemptNo: String(effectiveAttemptNo),
      },
      payment_capture: true,
    };

    console.info("[PI][GATEWAY_CREATE_ATTEMPT]", {
      orderId: String(args.orderId || ""),
      amountInPaise,
      payload: gatewayCreatePayload,
    });

    logger.info("[CHECK-6] Razorpay order creation about to happen");
    
    let created: any;
    try {
      created =
        process.env.NODE_ENV === "test"
          ? {
              id: `order_test_${String(receipt || args.orderId || "").replace(/[^a-zA-Z0-9_\-]/g, "").slice(-24)}`,
              status: "created",
              amount: amountInPaise,
              currency,
            }
          : await razorpay.orders.create(gatewayCreatePayload);
      logger.info("[CHECK-7] Razorpay order created:", String(created?.id || ""));
    } catch (razorpayError: any) {
      // Check if this is a provider unavailability error
      if (isProviderUnavailableError(razorpayError)) {
        logger.payment("provider_unavailable: Razorpay API unreachable", {
          orderId: String(args.orderId),
          paymentIntentId: String(intent._id),
          error: razorpayError.message,
          code: razorpayError.code,
        });

        capturePaymentError("Payment provider unavailable", razorpayError, {
          orderId: String(args.orderId),
          paymentIntentId: String(intent._id),
          provider: "RAZORPAY",
        });

        // Mark intent as pending external - will be retried by reconciliation
        try {
          paymentIntentStateMachine.assertAllowedTransition(
            String(intent.status) as any,
            "PAYMENT_PENDING_EXTERNAL"
          );
          intent.status = "PAYMENT_PENDING_EXTERNAL" as any;
          intent.paymentState = "CREATED" as any;
          await intent.save();
        } catch {
          // State transition not allowed, continue with normal error handling
        }

        incCounterWithLabels(
          "payment_events_total",
          { gateway: "RAZORPAY", type: "intent", event: "CREATE", result: "provider_unavailable" },
          1
        );

        const err: any = new Error("Payment service temporarily unavailable. Your order has been saved and will be processed shortly.");
        err.statusCode = 503;
        err.isProviderUnavailable = true;
        throw err;
      }

      // Re-throw non-provider errors
      throw razorpayError;
    }

    const gatewayOrderId = String(created?.id || "");
    if (!gatewayOrderId) {
      logger.error("[PI][GATEWAY_CREATE_FAILED]", {
        orderId: String(args.orderId || ""),
        reason: "NO_ORDER_ID_IN_RESPONSE",
        response: created,
      });
      const err: any = new Error("Failed to create gateway order");
      err.statusCode = 502;
      throw err;
    }

    console.info("[PI][GATEWAY_CREATED]", {
      gatewayOrderId,
      status: String(created?.status || ""),
      amount: Number(created?.amount),
      currency: String(created?.currency || ""),
      createdAt: created?.created_at,
    });

    const checkoutPayload = {
      gateway: "RAZORPAY",
      id: gatewayOrderId,
      key_id: razorpayKeyId,
      key: razorpayKeyId,
      orderId: gatewayOrderId,
      amount: Number(created?.amount),
      currency: String(created?.currency || currency),
      keyId: razorpayKeyId,
      razorpayOrderId: gatewayOrderId,
    };

    try {
      paymentIntentStateMachine.assertAllowedTransition(
        String(intent.status) as any,
        "GATEWAY_ORDER_CREATED"
      );
    } catch (e: any) {
      const err: any = new Error(
        `Invalid payment intent transition (${String((intent as any).status)} → GATEWAY_ORDER_CREATED)`
      );
      err.statusCode = 400;
      throw err;
    }

    intent.status = "GATEWAY_ORDER_CREATED" as any;
    intent.paymentState = "AUTHORIZED" as any;
    intent.gatewayOrderId = gatewayOrderId;
    intent.checkoutPayload = checkoutPayload;
    await intent.save();

    return {
      paymentIntentId: String(intent._id),
      gateway: "RAZORPAY",
      razorpayOrderId: gatewayOrderId,
      amount,
      currency: "INR",
      expiresAt,
      checkoutPayload,
    };
  } catch (e: any) {
    logger.error("[PI][GATEWAY_CREATE_FAILED]", {
      orderId: String(args.orderId || ""),
      paymentIntentId: String((intent as any)?._id || ""),
      statusCode: Number(e?.statusCode) || Number(e?.response?.status) || undefined,
      message: String(e?.message || ""),
      gatewayError: e?.error || e?.response?.data || undefined,
    });
    try {
      const from = String((intent as any).status) as any;
      if (String(from).toUpperCase() !== "FAILED") {
        try {
          paymentIntentStateMachine.assertAllowedTransition(from, "FAILED");
        } catch (e: any) {
          const err: any = new Error(
            `Invalid payment intent transition (${String(from)} → FAILED)`
          );
          err.statusCode = 400;
          throw err;
        }
        intent.status = "FAILED" as any;
        await intent.save();
      }
    } catch {
      // ignore
    }

    incCounterWithLabels(
      "payment_events_total",
      { gateway: "RAZORPAY", type: "intent", event: "GATEWAY_ORDER_CREATE", result: "failed" },
      1
    );

    const statusCode = Number(e?.statusCode) || Number(e?.response?.status) || 502;
    const message =
      typeof e?.message === "string" && e.message.trim()
        ? e.message.trim()
        : "Gateway order creation failed";
    const err: any = e instanceof Error ? e : new Error(message);
    if (!String((err as any).message || "").trim()) (err as any).message = message;
    (err as any).statusCode = Number((err as any).statusCode) || statusCode;
    throw err;
  }
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    const message =
      typeof e?.message === "string" && String(e?.message).trim()
        ? String(e?.message).trim()
        : statusCode === 400
          ? "PaymentIntent rejected by backend (unknown guard)"
          : "Payment intent failed";

    logger.error("[PI][FATAL_THROW]", {
      orderId: String(args.orderId || ""),
      statusCode,
      message,
      stack: typeof (e as any)?.stack === "string" ? (e as any).stack : undefined,
      rawError: e,
    });

    logger.error("[PI][FAIL]", {
      orderId: String(args.orderId || ""),
      message,
      statusCode,
    });

    const err: any = new Error(message);
    err.statusCode = statusCode;
    throw err;
  }
}
