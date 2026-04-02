import { logger } from '../../../utils/logger';
import { Request, Response } from "express";

import { createRazorpayPaymentIntent } from "../services/paymentIntentService";
import { PaymentIntent } from "../models/PaymentIntent";
import { isNewPaymentIntentCreationEnabled } from "../config/killSwitches";
logger.error("🔥🔥🔥 PAYMENT INTENT CONTROLLER LOADED 🔥🔥🔥");
/**
 * POST /api/payment-intents
 */
export async function createPaymentIntent(req: Request, res: Response) {
  try {
    logger.info("[CHECK-5] /api/payment-intents HIT");

    const userId = String((req as any).user?._id || "");
    if (!userId) {
      logger.error("[CTRL][AUTH_MISSING]");
      return res.status(401).json({ message: "Authentication required" });
    }

    const orderId = String((req.body as any)?.orderId || "").trim();
    const method = String((req.body as any)?.method || "RAZORPAY").toUpperCase();
    const idempotencyKey = String(
      (req.body as any)?.idempotencyKey || req.header("Idempotency-Key") || ""
    ).trim();

    logger.info("[CTRL][REQUEST_PARSED]", {
      userId,
      orderId,
      method,
      hasIdempotencyKey: !!idempotencyKey,
    });

    if (!orderId) {
      logger.error("[CTRL][VALIDATION_FAIL]", {
        reason: "MISSING_ORDER_ID",
        userId,
      });
      return res.status(400).json({ message: "orderId is required" });
    }

    if (method !== "RAZORPAY") {
      logger.error("[CTRL][VALIDATION_FAIL]", {
        reason: "UNSUPPORTED_METHOD",
        method,
      });
      return res.status(400).json({ message: "Unsupported method" });
    }

    if (!isNewPaymentIntentCreationEnabled({ gateway: "RAZORPAY" })) {
      logger.warn("[CTRL][KILL_SWITCH_ACTIVE]");

      if (idempotencyKey) {
        const existing = await PaymentIntent.findOne({ idempotencyKey }).lean();
        if (existing) {
          logger.info("[CTRL][KILL_SWITCH_RETURN_EXISTING]", {
            paymentIntentId: String((existing as any)._id),
          });
          return res.status(201).json({
            paymentIntentId: String((existing as any)._id),
            gateway: String((existing as any).gateway || "RAZORPAY"),
            expiresAt: (existing as any).expiresAt,
            checkoutPayload: (existing as any).checkoutPayload || {},
          });
        }
      }

      return res.status(503).json({
        message: "Payment creation temporarily disabled",
      });
    }

    logger.info("[CTRL][CALLING_SERVICE]", {
      userId,
      orderId,
      idempotencyKeyPresent: !!idempotencyKey,
    });

    const result = await createRazorpayPaymentIntent({
      userId,
      orderId,
      idempotencyKey,
    });

    logger.info("[CTRL][SERVICE_SUCCESS]", {
      paymentIntentId: result.paymentIntentId,
      razorpayOrderId: result.razorpayOrderId,
    });

    return res.status(201).json({
      paymentIntentId: result.paymentIntentId,
      gateway: result.gateway,
      expiresAt: result.expiresAt,
      checkoutPayload: result.checkoutPayload,
    });
  } catch (e: any) {
    // 🔒 HARD GUARANTEE: no empty error messages
    const statusCode = Number(e?.statusCode) || 500;
    const message =
      typeof e?.message === "string" && e.message.trim()
        ? e.message.trim()
        : statusCode === 400
          ? "Payment intent rejected by backend guard"
          : "Payment intent failed";

    logger.error("[CTRL][PAYMENT_INTENT_FAILED]", {
      statusCode,
      message,
      rawErrorMessage: String(e?.message || ""),
      stack: e?.stack,
      userId: String((req as any).user?._id || ""),
      orderId: String((req.body as any)?.orderId || ""),
      method: String((req.body as any)?.method || ""),
      hasIdempotencyKey: !!String(
        (req.body as any)?.idempotencyKey || req.header("Idempotency-Key") || ""
      ).trim(),
    });

    if (process.env.NODE_ENV === "test") {
      return res.status(statusCode).json({
        message,
        statusCode,
        debug: {
          rawErrorMessage: String(e?.message || ""),
          name: String(e?.name || ""),
        },
      });
    }

    return res.status(statusCode).json({ message });
  }
}

/**
 * POST /api/payment-intents/verify
 * (Webhook-only authority)
 */
export async function verifyPaymentIntent(req: Request, res: Response) {
  return res.status(404).json({
    message: "Payment verification is webhook-only",
  });
}