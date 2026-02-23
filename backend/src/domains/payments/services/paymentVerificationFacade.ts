import mongoose from "mongoose";

import { PaymentIntent } from "../models/PaymentIntent";
import { Order } from "../../../models/Order";
import { verifyRazorpayPayment } from "../verification/razorpayVerificationService";

export type PaymentVerificationQuery = {
  paymentIntentId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
};

export type PaymentVerificationDiscrepancy =
  | "WEBHOOK_MISSING"
  | "AWAITING_CAPTURE"
  | "GATEWAY_FAILED"
  | "NO_GATEWAY_PAYMENT"
  | "CONSISTENT_PAID";

export type PaymentVerificationResponse = {
  source: "RAZORPAY";
  verifiedAt: Date;

  internal?: {
    paymentIntentId: string;
    orderId: string;
    status: string;
    isLocked: boolean;
  };

  gateway: {
    order?: {
      id: string;
      status: string;
      amount: number;
      currency: string;
    };
    payment?: {
      id: string;
      status: string;
      method: string;
    };
    refunds: Array<{ id: string; amount: number; status: string }>;
  };

  assessment: {
    isPaidAtGateway: boolean;
    isPaidInternally: boolean;
    discrepancy: PaymentVerificationDiscrepancy;
  };
};

function nonEmpty(s: any): string | undefined {
  const v = String(s || "").trim();
  return v ? v : undefined;
}

function assertAtLeastOneParam(q: PaymentVerificationQuery) {
  if (!nonEmpty(q.paymentIntentId) && !nonEmpty(q.razorpayOrderId) && !nonEmpty(q.razorpayPaymentId)) {
    throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
  }
}

function isPaidOrderStatus(ps: any): boolean {
  return String(ps || "").toUpperCase() === "PAID";
}

function computeDiscrepancy(args: {
  gatewayPaymentStatus?: string;
  isPaidAtGateway: boolean;
  isPaidInternally: boolean;
}): PaymentVerificationDiscrepancy {
  const s = String(args.gatewayPaymentStatus || "").toLowerCase();

  if (args.isPaidAtGateway && !args.isPaidInternally) return "WEBHOOK_MISSING";
  if (s === "authorized") return "AWAITING_CAPTURE";
  if (s === "failed") return "GATEWAY_FAILED";
  if (!args.gatewayPaymentStatus) return "NO_GATEWAY_PAYMENT";
  if (args.isPaidAtGateway && args.isPaidInternally) return "CONSISTENT_PAID";
  return "NO_GATEWAY_PAYMENT";
}

export async function runInternalPaymentVerification(
  q: PaymentVerificationQuery,
  opts?: { now?: Date; signal?: AbortSignal }
): Promise<PaymentVerificationResponse> {
  assertAtLeastOneParam(q);

  const now = opts?.now || new Date();

  const paymentIntentId = nonEmpty(q.paymentIntentId);
  const queryOrderId = nonEmpty(q.razorpayOrderId);
  const queryPaymentId = nonEmpty(q.razorpayPaymentId);

  let internal: PaymentVerificationResponse["internal"] | undefined;
  let derivedOrderId: string | undefined;
  let orderPaymentStatus: any;

  if (paymentIntentId) {
    if (!mongoose.Types.ObjectId.isValid(paymentIntentId)) {
      throw Object.assign(new Error("INVALID_INPUT"), { statusCode: 400 });
    }

    const intent = await PaymentIntent.findById(paymentIntentId)
      .select("_id orderId gateway status isLocked gatewayOrderId")
      .lean();

    if (!intent) {
      throw Object.assign(new Error("PaymentIntent not found"), { statusCode: 404 });
    }

    internal = {
      paymentIntentId: String(intent._id),
      orderId: String(intent.orderId),
      status: String((intent as any).status),
      isLocked: !!(intent as any).isLocked,
    };

    if (String((intent as any).gateway || "").toUpperCase() === "RAZORPAY") {
      derivedOrderId = nonEmpty((intent as any).gatewayOrderId);
    }

    const order = await Order.findById((intent as any).orderId).select("_id paymentStatus").lean();
    if (!order) {
      throw Object.assign(new Error("Order not found"), { statusCode: 404 });
    }
    orderPaymentStatus = (order as any).paymentStatus;
  }

  const razorpayOrderId = queryOrderId || derivedOrderId;
  const razorpayPaymentId = queryPaymentId;

  const gatewayRes = await verifyRazorpayPayment(
    { razorpayOrderId, razorpayPaymentId },
    { now, signal: opts?.signal }
  );

  const isPaidAtGateway = String(gatewayRes.payment?.status || "").toLowerCase() === "captured";

  const isPaidInternally = isPaidOrderStatus(orderPaymentStatus);

  const discrepancy = computeDiscrepancy({
    gatewayPaymentStatus: gatewayRes.payment?.status,
    isPaidAtGateway,
    isPaidInternally,
  });

  return {
    source: "RAZORPAY",
    verifiedAt: now,
    internal,
    gateway: {
      order: gatewayRes.order
        ? {
            id: gatewayRes.order.id,
            status: gatewayRes.order.status,
            amount: gatewayRes.order.amount,
            currency: gatewayRes.order.currency,
          }
        : undefined,
      payment: gatewayRes.payment
        ? {
            id: gatewayRes.payment.id,
            status: gatewayRes.payment.status,
            method: gatewayRes.payment.method,
          }
        : undefined,
      refunds: gatewayRes.refunds ? gatewayRes.refunds.map((r) => ({ id: r.id, amount: r.amount, status: r.status })) : [],
    },
    assessment: {
      isPaidAtGateway,
      isPaidInternally,
      discrepancy,
    },
  };
}
