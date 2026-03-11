import { logger } from '../../../utils/logger';
import type { Request, Response } from "express";

import { executeRecoveryAction } from "../recoveryExecution/recoveryExecutionService";
import { isRecoveryExecutionEnabled } from "../config/killSwitches";

const CONFIRM_STRING = "YES_I_UNDERSTAND_THIS_CHANGES_STATE";

function isFeatureEnabled(): boolean {
  return String(process.env.PAYMENT_AUTO_RECOVERY_ENABLED || "").toLowerCase() === "true";
}

function nonEmpty(v: any): string | undefined {
  const s = String(v || "").trim();
  return s ? s : undefined;
}

export async function postPaymentRecoveryExecute(req: Request, res: Response) {
  if (!isFeatureEnabled()) {
    return res.status(403).json({ error: "FEATURE_DISABLED" });
  }

  if (!isRecoveryExecutionEnabled()) {
    return res.status(403).json({ error: "FEATURE_DISABLED" });
  }

  const paymentIntentId = nonEmpty((req.params as any).paymentIntentId);
  const action = nonEmpty((req.body as any)?.action);
  const reason = String((req.body as any)?.reason || "");
  const confirm = String((req.body as any)?.confirm || "");

  if (!paymentIntentId) {
    return res.status(400).json({ error: "INVALID_INPUT" });
  }

  if (action !== "MARK_VERIFYING" && action !== "MARK_RECOVERABLE") {
    return res.status(400).json({ error: "INVALID_INPUT" });
  }

  if (String(reason || "").trim().length < 15) {
    return res.status(400).json({ error: "INVALID_INPUT" });
  }

  if (confirm !== CONFIRM_STRING) {
    return res.status(400).json({ error: "INVALID_INPUT" });
  }

  const adminUserId = String((req as any).user?._id || "");
  const adminEmail = String((req as any).user?.email || "");

  try {
    const out = await executeRecoveryAction(
      {
        paymentIntentId,
        action: action as any,
        reason,
        adminUserId,
        adminEmail,
        featureFlagVersion: "PAYMENT_AUTO_RECOVERY_ENABLED:true",
      },
      { now: new Date() }
    );

    return res.status(200).json({
      executed: true,
      previousStatus: out.previousStatus,
      newStatus: out.newStatus,
      auditId: out.auditId,
    });
  } catch (e: any) {
    const status = Number(e?.statusCode || 500);
    const code = String(e?.message || "INTERNAL_ERROR");

    if (status === 400) return res.status(400).json({ error: "INVALID_INPUT" });
    if (status === 404) return res.status(404).json({ error: "NOT_FOUND" });
    if (status === 409) return res.status(409).json({ error: "INVALID_STATE_TRANSITION" });

    logger.info(
      `[PaymentRecoveryExecute] intent=${paymentIntentId} action=${action || ""} error=${code}`
    );
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
