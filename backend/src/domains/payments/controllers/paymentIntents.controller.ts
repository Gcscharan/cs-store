import { Request, Response } from "express";

import { createRazorpayPaymentIntent } from "../services/paymentIntentService";

export async function createPaymentIntent(req: Request, res: Response) {
  try {
    const userId = String((req as any).user?._id || "");
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const orderId = String((req.body as any)?.orderId || "").trim();
    const method = String((req.body as any)?.method || "RAZORPAY").toUpperCase();
    const idempotencyKey = String((req.body as any)?.idempotencyKey || req.header("Idempotency-Key") || "").trim();

    if (!orderId) {
      return res.status(400).json({ message: "orderId is required" });
    }

    if (method !== "RAZORPAY") {
      return res.status(400).json({ message: "Unsupported method" });
    }

    const result = await createRazorpayPaymentIntent({
      userId,
      orderId,
      idempotencyKey,
    });

    return res.status(201).json({
      paymentIntentId: result.paymentIntentId,
      gateway: result.gateway,
      expiresAt: result.expiresAt,
      checkoutPayload: result.checkoutPayload,
    });
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    const message = String(e?.message || "Failed to create payment intent");
    return res.status(statusCode).json({ message });
  }
}
