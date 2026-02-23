import { Request, Response } from "express";

import { runPaymentRecoveryAction } from "../services/paymentRecoveryService";

export async function postPaymentRecoveryAction(req: Request, res: Response) {
  try {
    const paymentIntentId = String((req.params as any).paymentIntentId || "").trim();
    const action = String((req.body as any)?.action || "").trim();
    const reason = String((req.body as any)?.reason || "");

    const adminUserId = String((req as any).user?._id || "");
    const adminEmail = String((req as any).user?.email || "");

    const result = await runPaymentRecoveryAction({
      paymentIntentId,
      action: action as any,
      reason,
      adminUserId,
      adminEmail,
    });

    return res.status(200).json(result);
  } catch (e: any) {
    const statusCode = Number(e?.statusCode) || 500;
    return res.status(statusCode).json({ message: String(e?.message || "Failed") });
  }
}
