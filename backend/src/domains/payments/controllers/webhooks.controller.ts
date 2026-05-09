import { Request, Response } from "express";

import { logger } from "../../../utils/logger";
import { processRazorpayWebhook } from "../services/webhookProcessor";

export async function razorpayWebhook(req: Request, res: Response) {
  try {
    const rawBody = (req as any).body as Buffer;
    if (!Buffer.isBuffer(rawBody)) {
      // NFR-004: Log invalid webhook payload
      logger.warn('[Webhook] Invalid webhook payload - not a Buffer', {
        bodyType: typeof rawBody,
        gateway: 'RAZORPAY',
      });
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const io = (req as any).app?.get?.("io");

    // NFR-004: Log webhook event received
    logger.info('[Webhook] Razorpay webhook event received', {
      gateway: 'RAZORPAY',
      payloadSize: rawBody.length,
      timestamp: new Date().toISOString(),
    });

    const result = await processRazorpayWebhook({
      rawBody,
      headers: req.headers as any,
      io,
    });

    if (result.ok) {
      // NFR-004: Log successful webhook processing
      logger.info('[Webhook] Webhook processed successfully', {
        gateway: 'RAZORPAY',
      });
      return res.status(200).json({ ok: true });
    }

    // NFR-004: Log webhook processing failure
    logger.warn('[Webhook] Webhook processing returned non-ok', {
      gateway: 'RAZORPAY',
      statusCode: result.statusCode,
      message: result.message,
    });
    return res.status(result.statusCode).json({ message: result.message });
  } catch (e: any) {
    // NFR-004: Log unhandled webhook errors
    logger.error('[Webhook] Unhandled error processing webhook', {
      gateway: 'RAZORPAY',
      error: e?.message || String(e),
      stack: e?.stack,
    });
    return res.status(500).json({ message: "Webhook processing failed" });
  }
}
