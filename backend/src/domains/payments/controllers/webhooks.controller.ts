import { Request, Response } from "express";

import { processRazorpayWebhook } from "../services/webhookProcessor";

export async function razorpayWebhook(req: Request, res: Response) {
  try {
    const rawBody = (req as any).body as Buffer;
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ message: "Invalid webhook payload" });
    }

    const result = await processRazorpayWebhook({
      rawBody,
      headers: req.headers as any,
    });

    if (result.ok) {
      return res.status(200).json({ ok: true });
    }

    return res.status(result.statusCode).json({ message: result.message });
  } catch (e: any) {
    return res.status(500).json({ message: "Webhook processing failed" });
  }
}
