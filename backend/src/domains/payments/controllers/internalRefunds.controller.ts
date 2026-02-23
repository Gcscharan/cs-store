import type { Request, Response } from "express";

import {
  createRefundRequestInternal,
  getRefundHistoryForOrderInternal,
} from "../refunds/refundService";
import { isRefundExecutionEnabled } from "../config/killSwitches";

function nonEmpty(v: any): string | undefined {
  const s = String(v || "").trim();
  return s ? s : undefined;
}

export async function postInternalRefunds(req: Request, res: Response) {
  if (!isRefundExecutionEnabled()) {
    return res.status(503).json({ error: "REFUND_EXECUTION_DISABLED" });
  }

  const orderId = nonEmpty((req.body as any)?.orderId);
  const paymentIntentId = nonEmpty((req.body as any)?.paymentIntentId);
  const idempotencyKey = nonEmpty((req.body as any)?.idempotencyKey);
  const currency = nonEmpty((req.body as any)?.currency) || "INR";
  const amountRaw = (req.body as any)?.amount;
  const reason = (req.body as any)?.reason;

  if (!orderId || !paymentIntentId || !idempotencyKey) {
    return res.status(400).json({ error: "INVALID_INPUT" });
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "INVALID_INPUT" });
  }

  try {
    const out = await createRefundRequestInternal({
      orderId,
      paymentIntentId,
      amount,
      currency,
      reason,
      idempotencyKey,
    });

    return res.status(200).json(out);
  } catch (e: any) {
    const status = Number(e?.statusCode || 500);
    const code = String(e?.message || "INTERNAL_ERROR");

    if (status === 400) return res.status(400).json({ error: "INVALID_INPUT" });
    if (status === 404) return res.status(404).json({ error: "NOT_FOUND" });
    if (status === 409) return res.status(409).json({ error: code });

    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}

export async function getInternalRefundsByOrderId(req: Request, res: Response) {
  const orderId = nonEmpty((req.params as any)?.orderId);
  if (!orderId) {
    return res.status(400).json({ error: "INVALID_INPUT" });
  }

  try {
    const out = await getRefundHistoryForOrderInternal({ orderId });
    return res.status(200).json(out);
  } catch (e: any) {
    const status = Number(e?.statusCode || 500);

    if (status === 400) return res.status(400).json({ error: "INVALID_INPUT" });
    if (status === 404) return res.status(404).json({ error: "NOT_FOUND" });

    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
