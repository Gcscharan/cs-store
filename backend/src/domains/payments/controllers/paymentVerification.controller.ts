import { logger } from '../../../utils/logger';
import type { Request, Response } from "express";

import { runInternalPaymentVerification } from "../services/paymentVerificationFacade";

function nonEmpty(v: any): string | undefined {
  const s = String(v || "").trim();
  return s ? s : undefined;
}

export async function paymentVerificationController(req: Request, res: Response) {
  const startedAt = Date.now();

  const paymentIntentId = nonEmpty((req.query as any).paymentIntentId);
  const razorpayOrderId = nonEmpty((req.query as any).razorpayOrderId);
  const razorpayPaymentId = nonEmpty((req.query as any).razorpayPaymentId);

  try {
    const out = await runInternalPaymentVerification(
      { paymentIntentId, razorpayOrderId, razorpayPaymentId },
      { now: new Date() }
    );

    const durationMs = Date.now() - startedAt;
    logger.info(
      `[PaymentVerifyInternal] intent=${out.internal?.paymentIntentId || ""} order=${out.internal?.orderId || ""} discrepancy=${out.assessment.discrepancy} duration=${durationMs}ms`
    );

    return res.status(200).json(out);
  } catch (e: any) {
    const status = Number(e?.statusCode || 500);
    const durationMs = Date.now() - startedAt;

    const code = String(e?.message || "ERROR");
    logger.info(
      `[PaymentVerifyInternal] intent=${paymentIntentId || ""} order= discrepancy=${code} duration=${durationMs}ms`
    );

    if (status === 400) return res.status(400).json({ error: "INVALID_INPUT" });
    if (status === 404) return res.status(404).json({ error: "NOT_FOUND" });
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
