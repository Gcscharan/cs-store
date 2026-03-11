import { logger } from '../../../utils/logger';
import type { Request, Response } from "express";
import mongoose from "mongoose";

import { PaymentIntent } from "../models/PaymentIntent";
import { runInternalPaymentVerification } from "../services/paymentVerificationFacade";
import { buildRecoverySuggestion } from "../recoverySuggestions/paymentRecoverySuggestionService";
import type { PaymentIntentStatus } from "../types";

function nonEmpty(v: any): string | undefined {
  const s = String(v || "").trim();
  return s ? s : undefined;
}

function isFeatureEnabled(): boolean {
  return String(process.env.PAYMENT_AUTO_RECOVERY_ENABLED || "").toLowerCase() === "true";
}

export async function getPaymentRecoverySuggestion(req: Request, res: Response) {
  const startedAt = Date.now();

  const orderId = nonEmpty((req.query as any).orderId);
  const paymentIntentId = nonEmpty((req.query as any).paymentIntentId);

  const hasOrderId = !!orderId;
  const hasIntentId = !!paymentIntentId;

  if ((hasOrderId && hasIntentId) || (!hasOrderId && !hasIntentId)) {
    return res.status(400).json({ error: "INVALID_INPUT" });
  }

  try {
    let intent: any | null = null;

    if (paymentIntentId) {
      if (!mongoose.Types.ObjectId.isValid(paymentIntentId)) {
        return res.status(400).json({ error: "INVALID_INPUT" });
      }

      intent = await PaymentIntent.findById(paymentIntentId)
        .select("_id orderId status isLocked")
        .lean();

      if (!intent) return res.status(404).json({ error: "NOT_FOUND" });
    }

    if (orderId) {
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        return res.status(400).json({ error: "INVALID_INPUT" });
      }

      intent = await PaymentIntent.findOne({ orderId: new mongoose.Types.ObjectId(orderId) })
        .sort({ createdAt: -1 })
        .select("_id orderId status isLocked")
        .lean();

      if (!intent) return res.status(404).json({ error: "NOT_FOUND" });
    }

    if (!intent) {
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }

    if (!!intent.isLocked) {
      const suggestion = buildRecoverySuggestion({
        discrepancy: "NO_GATEWAY_PAYMENT",
        isLocked: true,
        internalStatus: String((intent as any).status || "") as any,
        featureEnabled: isFeatureEnabled(),
      });
      const durationMs = Date.now() - startedAt;
      logger.info(
        `[PaymentRecoverySuggestion] order=${String(intent.orderId)} intent=${String(intent._id)} discrepancy=${suggestion.discrepancy} suggestion=${suggestion.recommendedAction} duration=${durationMs}ms`
      );

      return res.status(200).json({
        orderId: String(intent.orderId),
        paymentIntentId: String(intent._id),
        discrepancy: suggestion.discrepancy,
        suggestion,
      });
    }

    const verification = await runInternalPaymentVerification(
      { paymentIntentId: String(intent._id) },
      { now: new Date() }
    );

    const discrepancy = verification.assessment.discrepancy as any;
    const internalStatus = String(verification.internal?.status || "") as PaymentIntentStatus;
    const suggestion = buildRecoverySuggestion({
      discrepancy,
      isLocked: !!verification.internal?.isLocked,
      internalStatus,
      featureEnabled: isFeatureEnabled(),
    });

    const durationMs = Date.now() - startedAt;
    logger.info(
      `[PaymentRecoverySuggestion] order=${String(verification.internal?.orderId || "")} intent=${String(verification.internal?.paymentIntentId || "")} discrepancy=${String(discrepancy)} suggestion=${suggestion.recommendedAction} duration=${durationMs}ms`
    );

    return res.status(200).json({
      orderId: String(verification.internal?.orderId || ""),
      paymentIntentId: String(verification.internal?.paymentIntentId || ""),
      discrepancy,
      suggestion,
    });
  } catch {
    const durationMs = Date.now() - startedAt;
    logger.info(
      `[PaymentRecoverySuggestion] order=${orderId || ""} intent=${paymentIntentId || ""} discrepancy=ERROR suggestion=ERROR duration=${durationMs}ms`
    );
    return res.status(500).json({ error: "INTERNAL_ERROR" });
  }
}
