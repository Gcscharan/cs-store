"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentCallback = exports.getPaymentStats = exports.getAllPayments = exports.getPaymentDetails = exports.verifyPayment = exports.createOrder = void 0;
const crypto_1 = __importDefault(require("crypto"));
const razorpay_1 = __importDefault(require("../../../config/razorpay"));
const Payment_1 = require("../../../models/Payment");
// Create Razorpay order for cart checkout
const createOrder = async (req, res) => {
    // SAFETY: Disabled to enforce single payment source-of-truth
    return res.status(410).json({
        error: "LEGACY_PAYMENT_PATH_DISABLED",
        message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
    });
};
exports.createOrder = createOrder;
// Verify payment signature and store payment data
const verifyPayment = async (req, res) => {
    try {
        // SAFETY: Disabled to enforce single payment source-of-truth
        return res.status(410).json({
            error: "LEGACY_PAYMENT_PATH_DISABLED",
            message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
        });
    }
    catch (error) {
        console.error("Error verifying payment:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to verify payment",
        });
    }
};
exports.verifyPayment = verifyPayment;
// Get payment details
const getPaymentDetails = async (req, res) => {
    try {
        const { payment_id } = req.params;
        if (!payment_id) {
            return res.status(400).json({
                success: false,
                message: "Payment ID is required",
            });
        }
        const payment = await razorpay_1.default.payments.fetch(payment_id);
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
    }
    catch (error) {
        console.error("Error fetching payment details:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment details",
        });
    }
};
exports.getPaymentDetails = getPaymentDetails;
// Get all payments for admin panel
const getAllPayments = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const method = req.query.method;
        const search = req.query.search;
        const query = {};
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
        const payments = await Payment_1.Payment.find(query)
            .populate("orderId", "totalAmount orderStatus")
            .populate("userId", "name email phone")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        const totalPayments = await Payment_1.Payment.countDocuments(query);
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
    }
    catch (error) {
        console.error("Error fetching payments:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payments",
        });
    }
};
exports.getAllPayments = getAllPayments;
// Get payment statistics for admin dashboard
const getPaymentStats = async (req, res) => {
    try {
        const totalPayments = await Payment_1.Payment.countDocuments();
        const totalAmount = await Payment_1.Payment.aggregate([
            { $match: { status: "captured" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        const methodStats = await Payment_1.Payment.aggregate([
            {
                $group: {
                    _id: "$method",
                    count: { $sum: 1 },
                    total: { $sum: "$amount" },
                },
            },
        ]);
        const statusStats = await Payment_1.Payment.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);
        const recentPayments = await Payment_1.Payment.find()
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
    }
    catch (error) {
        console.error("Error fetching payment stats:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payment statistics",
        });
    }
};
exports.getPaymentStats = getPaymentStats;
// Payment callback handler (for webhooks)
const paymentCallback = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Missing required payment data",
            });
        }
        // Verify the signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto_1.default
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");
        const isAuthentic = expectedSignature === razorpay_signature;
        if (isAuthentic) {
            // Payment is verified - you can update your database here
            console.log("Payment verified via webhook:", {
                payment_id: razorpay_payment_id,
                order_id: razorpay_order_id,
            });
            return res.status(200).json({
                success: true,
                message: "Payment callback processed successfully",
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: "Invalid payment signature",
            });
        }
    }
    catch (error) {
        console.error("Error processing payment callback:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process payment callback",
        });
    }
};
exports.paymentCallback = paymentCallback;
