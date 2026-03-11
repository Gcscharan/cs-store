import { logger } from '../../../utils/logger';
import { RazorpayReadonlyClient } from "./razorpayReadonlyClient";
import {
  RazorpayVerificationError,
  RazorpayVerificationErrorCode,
} from "./errors";
import type {
  RazorpayListResponse,
  RazorpayOrderResponse,
  RazorpayPaymentResponse,
  RazorpayRefundResponse,
  RazorpayVerificationResult,
  RazorpayVerifyInput,
} from "./types";

function nonEmpty(s: any): string | undefined {
  const v = String(s || "").trim();
  return v ? v : undefined;
}

function normalizeOrder(order: RazorpayOrderResponse): RazorpayVerificationResult["order"] {
  return {
    id: String(order.id),
    amount: Number(order.amount),
    currency: String(order.currency || "").toUpperCase(),
    status:
      order.status === "created" || order.status === "paid" || order.status === "attempted"
        ? order.status
        : "created",
    attempts: Number(order.attempts || 0),
  };
}

function normalizePayment(payment: RazorpayPaymentResponse): RazorpayVerificationResult["payment"] {
  const statusRaw = String(payment.status || "");
  const status: NonNullable<RazorpayVerificationResult["payment"]>["status"] =
    statusRaw === "authorized" || statusRaw === "captured" || statusRaw === "failed" || statusRaw === "refunded"
      ? statusRaw
      : "failed";

  const createdAt = payment.created_at ? new Date(Number(payment.created_at) * 1000) : new Date(0);

  return {
    id: String(payment.id),
    status,
    method: String(payment.method || ""),
    amount: Number(payment.amount),
    createdAt,
  };
}

function normalizeRefunds(refunds?: RazorpayListResponse<RazorpayRefundResponse>): RazorpayVerificationResult["refunds"] {
  const items = refunds?.items || [];
  return items.map((r) => ({
    id: String(r.id),
    amount: Number((r as any).amount),
    status: String(r.status) === "processed" ? "processed" : "pending",
  }));
}

function pickMostRecentPayment(payments: RazorpayPaymentResponse[]): RazorpayPaymentResponse {
  return payments
    .slice()
    .sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0))[0];
}

export async function verifyRazorpayPayment(
  input: RazorpayVerifyInput,
  opts?: { signal?: AbortSignal; client?: RazorpayReadonlyClient; now?: Date }
): Promise<RazorpayVerificationResult> {
  const startedAt = Date.now();
  const now = opts?.now || new Date();

  const razorpayOrderId = nonEmpty(input?.razorpayOrderId);
  const razorpayPaymentId = nonEmpty(input?.razorpayPaymentId);

  if (!razorpayOrderId && !razorpayPaymentId) {
    throw new RazorpayVerificationError({
      code: RazorpayVerificationErrorCode.INVALID_INPUT,
      message: "At least one of razorpayOrderId or razorpayPaymentId is required",
    });
  }

  const client = opts?.client || new RazorpayReadonlyClient();

  let result: RazorpayVerificationResult | null = null;

  try {
    let order: RazorpayOrderResponse | undefined;
    let payment: RazorpayPaymentResponse | undefined;
    let refunds: RazorpayListResponse<RazorpayRefundResponse> | undefined;

    if (razorpayPaymentId) {
      payment = await client.fetchPayment(razorpayPaymentId, { signal: opts?.signal });

      const derivedOrderId = nonEmpty((payment as any).order_id);
      const finalOrderId = razorpayOrderId || derivedOrderId;

      if (finalOrderId) {
        order = await client.fetchOrder(finalOrderId, { signal: opts?.signal });
      }

      refunds = await client.fetchPaymentRefunds(razorpayPaymentId, { signal: opts?.signal });
    } else if (razorpayOrderId) {
      order = await client.fetchOrder(razorpayOrderId, { signal: opts?.signal });

      const list = await client.fetchOrderPayments(razorpayOrderId, { signal: opts?.signal });
      const items = list?.items || [];

      if (items.length > 0) {
        payment = pickMostRecentPayment(items);
        refunds = await client.fetchPaymentRefunds(String(payment.id), { signal: opts?.signal });
      }
    }

    result = {
      gateway: "RAZORPAY",
      order: order ? normalizeOrder(order) : undefined,
      payment: payment ? normalizePayment(payment) : undefined,
      refunds: payment && refunds ? normalizeRefunds(refunds) : undefined,
      fetchedAt: now,
    };

    const durationMs = Date.now() - startedAt;
    logger.info(
      `[RazorpayVerify] order=${razorpayOrderId || (payment as any)?.order_id || ""} payment=${razorpayPaymentId || (payment as any)?.id || ""} status=OK duration=${durationMs}ms`
    );

    return result;
  } catch (e: any) {
    const err = e instanceof RazorpayVerificationError
      ? e
      : new RazorpayVerificationError({ code: RazorpayVerificationErrorCode.NETWORK_ERROR, message: "Verification failed" });

    const durationMs = Date.now() - startedAt;
    logger.info(
      `[RazorpayVerify] order=${razorpayOrderId || ""} payment=${razorpayPaymentId || ""} status=${err.code} duration=${durationMs}ms`
    );

    throw err;
  } finally {
    if (!result) {
      void startedAt;
    }
  }
}
