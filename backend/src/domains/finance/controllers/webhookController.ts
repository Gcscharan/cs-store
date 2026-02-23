import { Request, Response } from "express";
import { Order } from "../../../models/Order";
import crypto from "crypto";
import { Server as SocketIOServer } from "socket.io";

export const razorpayWebhook = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    // SAFETY: Disabled to enforce single payment source-of-truth
    return res.status(410).json({
      error: "LEGACY_PAYMENT_PATH_DISABLED",
      message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
    });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }
};
