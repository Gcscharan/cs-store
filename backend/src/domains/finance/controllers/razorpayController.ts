import { logger } from '../../../utils/logger';
import { Request, Response } from "express";

/**
 * Create Razorpay Order
 * This endpoint creates a Razorpay order and returns the order_id
 */
export const createRazorpayOrder = async (req: Request, res: Response) => {
  // SAFETY: Disabled to enforce single payment source-of-truth
  return res.status(410).json({
    error: "LEGACY_PAYMENT_PATH_DISABLED",
    message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
  });
};

/**
 * Verify Razorpay Payment
 * This endpoint verifies the payment signature and updates order status
 */
export const verifyRazorpayPayment = async (req: Request, res: Response) => {
  try {
    // SAFETY: Disabled to enforce single payment source-of-truth
    return res.status(410).json({
      error: "LEGACY_PAYMENT_PATH_DISABLED",
      message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
    });
  } catch (error: any) {
    logger.error("Payment verification error:", error);
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
    // SAFETY: Disabled to enforce single payment source-of-truth
    return res.status(410).json({
      error: "LEGACY_PAYMENT_PATH_DISABLED",
      message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
    });
  } catch (error: any) {
    logger.error("Webhook handling error:", error);
    return res.status(500).json({ 
      error: "Failed to handle webhook",
      message: error.message || "Unknown error occurred"
    });
  }
};
