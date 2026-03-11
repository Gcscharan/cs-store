import { logger } from '../../../utils/logger';
import { Request, Response } from "express";
import crypto from "crypto";
import razorpay from "../../../config/razorpay";
import { Payment } from "../../../models/Payment";

// Create Razorpay order for cart checkout
export const createOrder = async (req: Request, res: Response) => {
  // SAFETY: Disabled to enforce single payment source-of-truth
  return res.status(410).json({
    error: "LEGACY_PAYMENT_PATH_DISABLED",
    message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
  });
};

// Verify payment signature and store payment data
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    // SAFETY: Disabled to enforce single payment source-of-truth
    return res.status(410).json({
      error: "LEGACY_PAYMENT_PATH_DISABLED",
      message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
    });
  } catch (error) {
    logger.error("Error verifying payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
    });
  }
};

// Get payment details
export const getPaymentDetails = async (req: Request, res: Response) => {
  try {
    const { payment_id } = req.params;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const payment = await razorpay.payments.fetch(payment_id);

    return res.status(200).json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        created_at: payment.created_at,
      },
    });
  } catch (error) {
    logger.error("Error fetching payment details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment details",
    });
  }
};

// Get all payments for admin panel
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const method = req.query.method as string;
    const search = req.query.search as string;

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (method) {
      query.method = method;
    }

    if (search) {
      query.$or = [
        { paymentId: { $regex: search, $options: "i" } },
        { razorpayPaymentId: { $regex: search, $options: "i" } },
        { "userDetails.name": { $regex: search, $options: "i" } },
        { "userDetails.email": { $regex: search, $options: "i" } },
      ];
    }

    const payments = await Payment.find(query)
      .populate("orderId", "totalAmount orderStatus")
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalPayments = await Payment.countDocuments(query);

    return res.status(200).json({
      success: true,
      payments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPayments / limit),
        totalPayments,
        hasNext: page < Math.ceil(totalPayments / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    logger.error("Error fetching payments:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
};

// Get payment statistics for admin dashboard
export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const totalAmount = await Payment.aggregate([
      { $match: { status: "captured" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const methodStats = await Payment.aggregate([
      {
        $group: {
          _id: "$method",
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
    ]);

    const statusStats = await Payment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const recentPayments = await Payment.find()
      .populate("userId", "name email")
      .populate("orderId", "orderStatus")
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      stats: {
        totalPayments,
        totalAmount: totalAmount[0]?.total || 0,
        methodStats,
        statusStats,
        recentPayments,
      },
    });
  } catch (error) {
    logger.error("Error fetching payment stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment statistics",
    });
  }
};

// Payment callback handler (for webhooks)
export const paymentCallback = async (req: Request, res: Response) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment data",
      });
    }

    // Verify the signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET!
      )
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment is verified - you can update your database here
      logger.info("Payment verified via webhook:", {
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
      });

      return res.status(200).json({
        success: true,
        message: "Payment callback processed successfully",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }
  } catch (error) {
    logger.error("Error processing payment callback:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process payment callback",
    });
  }
};
