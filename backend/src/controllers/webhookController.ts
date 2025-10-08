import { Request, Response } from "express";
import { Order } from "../models/Order";
import crypto from "crypto";
import { Server as SocketIOServer } from "socket.io";

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
    const io = (req as any).io as SocketIOServer;

    switch (event) {
      case "payment.captured":
        // Update order payment status
        const order1 = await Order.findOneAndUpdate(
          { razorpayOrderId: payload.payment.entity.order_id },
          {
            paymentStatus: "paid",
            razorpayPaymentId: payload.payment.entity.id,
          },
          { new: true }
        );
        
        if (order1 && io) {
          // Emit payment success event
          io.to(`order_${order1._id}`).emit("order:payment:success", {
            orderId: order1._id,
            paymentId: payload.payment.entity.id,
          });
          
          // Emit to admin room
          io.to("admin_room").emit("order:payment:success", {
            orderId: order1._id,
            paymentId: payload.payment.entity.id,
          });
        }
        break;

      case "payment.failed":
        // Update order payment status
        const order2 = await Order.findOneAndUpdate(
          { razorpayOrderId: payload.payment.entity.order_id },
          { paymentStatus: "failed" },
          { new: true }
        );
        
        if (order2 && io) {
          // Emit payment failure event
          io.to(`order_${order2._id}`).emit("order:payment:failed", {
            orderId: order2._id,
            reason: payload.payment.entity.error_description,
          });
        }
        break;

      case "order.paid":
        // Update order payment status
        const order3 = await Order.findOneAndUpdate(
          { razorpayOrderId: payload.order.entity.id },
          { paymentStatus: "paid" },
          { new: true }
        );
        
        if (order3 && io) {
          // Emit order paid event
          io.to(`order_${order3._id}`).emit("order:payment:success", {
            orderId: order3._id,
          });
        }
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.json({ status: "success" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
    return;
  }
};
