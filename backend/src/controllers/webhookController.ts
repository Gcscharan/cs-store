import { Request, Response } from "express";
import { Order } from "../models/Order";
import crypto from "crypto";

export const razorpayWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "")
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const { event, payload } = req.body;

    switch (event) {
      case "payment.captured":
        // Update order payment status
        await Order.findOneAndUpdate(
          { razorpayOrderId: payload.payment.entity.order_id },
          {
            paymentStatus: "paid",
            razorpayPaymentId: payload.payment.entity.id,
          }
        );
        break;

      case "payment.failed":
        // Update order payment status
        await Order.findOneAndUpdate(
          { razorpayOrderId: payload.payment.entity.order_id },
          { paymentStatus: "failed" }
        );
        break;

      case "order.paid":
        // Update order payment status
        await Order.findOneAndUpdate(
          { razorpayOrderId: payload.order.entity.id },
          { paymentStatus: "paid" }
        );
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.json({ status: "success" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};
