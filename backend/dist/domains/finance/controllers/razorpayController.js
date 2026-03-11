"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRazorpayWebhook = exports.verifyRazorpayPayment = exports.createRazorpayOrder = void 0;
const logger_1 = require("../../../utils/logger");
/**
 * Create Razorpay Order
 * This endpoint creates a Razorpay order and returns the order_id
 */
const createRazorpayOrder = async (req, res) => {
    // SAFETY: Disabled to enforce single payment source-of-truth
    return res.status(410).json({
        error: "LEGACY_PAYMENT_PATH_DISABLED",
        message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
    });
};
exports.createRazorpayOrder = createRazorpayOrder;
/**
 * Verify Razorpay Payment
 * This endpoint verifies the payment signature and updates order status
 */
const verifyRazorpayPayment = async (req, res) => {
    try {
        // SAFETY: Disabled to enforce single payment source-of-truth
        return res.status(410).json({
            error: "LEGACY_PAYMENT_PATH_DISABLED",
            message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
        });
    }
    catch (error) {
        logger_1.logger.error("Payment verification error:", error);
        return res.status(500).json({
            error: "Failed to verify payment",
            message: error.message || "Unknown error occurred"
        });
    }
};
exports.verifyRazorpayPayment = verifyRazorpayPayment;
/**
 * Razorpay Webhook Handler
 * This endpoint handles Razorpay webhook events for extra security
 */
const handleRazorpayWebhook = async (req, res) => {
    try {
        // SAFETY: Disabled to enforce single payment source-of-truth
        return res.status(410).json({
            error: "LEGACY_PAYMENT_PATH_DISABLED",
            message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
        });
    }
    catch (error) {
        logger_1.logger.error("Webhook handling error:", error);
        return res.status(500).json({
            error: "Failed to handle webhook",
            message: error.message || "Unknown error occurred"
        });
    }
};
exports.handleRazorpayWebhook = handleRazorpayWebhook;
