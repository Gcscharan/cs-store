import { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { Order } from "../../../models/Order";
import mongoose from "mongoose";

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

/**
 * Create Razorpay Order
 * This endpoint creates a Razorpay order and returns the order_id
 */
export const createRazorpayOrder = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?._id;
    const { amount, items, address, paymentMethod } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Items are required" });
    }

    if (!address) {
      return res.status(400).json({ error: "Delivery address is required" });
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Amount in paise
      currency: "INR",
      receipt: `order_${Date.now()}`,
      payment_capture: 1, // Auto capture payment
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // Format items for database
    const formattedItems = items.map((item: any) => ({
      productId: typeof item.productId === 'string' 
        ? new mongoose.Types.ObjectId(item.productId) 
        : item.productId,
      name: item.name || "Product",
      price: Number(item.price) || 0,
      qty: Number(item.qty) || 1,
    }));

    // Create order in database with pending status
    const order = new Order({
      userId,
      items: formattedItems,
      totalAmount: amount,
      address,
      paymentMethod: paymentMethod || "card",
      paymentStatus: "pending",
      orderStatus: "created",
      razorpayOrderId: razorpayOrder.id,
    });

    await order.save();

    return res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      dbOrderId: order._id,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error: any) {
    console.error("Razorpay order creation error:", error);
    return res.status(500).json({ 
      error: "Failed to create order",
      message: error.message || "Unknown error occurred"
    });
  }
};

/**
 * Verify Razorpay Payment
 * This endpoint verifies the payment signature and updates order status
 */
export const verifyRazorpayPayment = async (req: Request, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details" });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Update order in database
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.paymentStatus = "paid";
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      orderId: order._id,
    });
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ 
      error: "Failed to verify payment",
      message: error.message || "Unknown error occurred"
    });
  }
};

/**
 * Razorpay Webhook Handler
 * This endpoint handles Razorpay webhook events for extra security
 */
export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    const signature = req.headers["x-razorpay-signature"] as string;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    // Handle different events
    switch (event) {
      case "payment.captured":
        const paymentEntity = payload.payment.entity;
        const order = await Order.findOne({
          razorpayOrderId: paymentEntity.order_id,
        });

        if (order && order.paymentStatus !== "paid") {
          order.paymentStatus = "paid";
          order.razorpayPaymentId = paymentEntity.id;
          await order.save();
          console.log(`Payment captured for order: ${order._id}`);
        }
        break;

      case "payment.failed":
        const failedPayment = payload.payment.entity;
        const failedOrder = await Order.findOne({
          razorpayOrderId: failedPayment.order_id,
        });

        if (failedOrder) {
          failedOrder.paymentStatus = "failed";
          await failedOrder.save();
          console.log(`Payment failed for order: ${failedOrder._id}`);
        }
        break;

      default:
        console.log(`Unhandled event: ${event}`);
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Webhook handling error:", error);
    return res.status(500).json({ 
      error: "Failed to handle webhook",
      message: error.message || "Unknown error occurred"
    });
  }
};
