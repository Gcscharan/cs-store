"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentCallback = exports.getPaymentStats = exports.getAllPayments = exports.getPaymentDetails = exports.verifyPayment = exports.createOrder = void 0;
const crypto_1 = __importDefault(require("crypto"));
const razorpay_1 = __importDefault(require("../config/razorpay"));
const Order_1 = require("../models/Order");
const Payment_1 = require("../models/Payment");
const User_1 = require("../models/User");
const createOrder = async (req, res) => {
    try {
        const { items, address, totalAmount } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Items are required",
            });
        }
        if (!address) {
            return res.status(400).json({
                success: false,
                message: "Delivery address is required",
            });
        }
        if (!totalAmount || totalAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid total amount",
            });
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        const order = new Order_1.Order({
            userId,
            items,
            totalAmount,
            address,
            paymentStatus: "pending",
            orderStatus: "created",
        });
        await order.save();
        const amountInPaise = Math.round(totalAmount * 100);
        const razorpayOptions = {
            amount: amountInPaise,
            currency: "INR",
            receipt: `order_${order._id}`,
            notes: {
                orderId: order._id.toString(),
                userId: userId,
            },
        };
        const razorpayOrder = await razorpay_1.default.orders.create(razorpayOptions);
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();
        return res.status(200).json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            orderId: order._id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_RREROYUEXDmjIA",
        });
    }
    catch (error) {
        console.error("Error creating Razorpay order:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create payment order",
        });
    }
};
exports.createOrder = createOrder;
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
        }
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Missing required payment verification data",
            });
        }
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto_1.default
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "ICsVMT4uFvM53f0Czkqr5vmW")
            .update(body.toString())
            .digest("hex");
        const isAuthentic = expectedSignature === razorpay_signature;
        if (!isAuthentic) {
            return res.status(400).json({
                success: false,
                message: "Payment verification failed - Invalid signature",
            });
        }
        const order = await Order_1.Order.findOne({ razorpayOrderId: razorpay_order_id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }
        const paymentDetails = await razorpay_1.default.payments.fetch(razorpay_payment_id);
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }
        let paymentMethod = "card";
        if (paymentDetails.method === "upi")
            paymentMethod = "upi";
        else if (paymentDetails.method === "card")
            paymentMethod = "card";
        else if (paymentDetails.method === "netbanking")
            paymentMethod = "netbanking";
        else if (paymentDetails.method === "wallet")
            paymentMethod = "wallet";
        else if (paymentDetails.method === "emi")
            paymentMethod = "emi";
        else if (paymentDetails.method === "paylater")
            paymentMethod = "paylater";
        const methodDetails = {};
        const acquirerData = paymentDetails.acquirer_data;
        if (paymentMethod === "upi" && acquirerData) {
            methodDetails.upi = {
                vpa: acquirerData.upi?.vpa,
                flow: acquirerData.upi?.flow,
            };
        }
        else if (paymentMethod === "card" && paymentDetails.card) {
            methodDetails.card = {
                last4: paymentDetails.card.last4,
                network: paymentDetails.card.network,
                type: paymentDetails.card.type,
                issuer: paymentDetails.card.issuer,
            };
        }
        else if (paymentMethod === "netbanking" && acquirerData) {
            methodDetails.netbanking = {
                bank: acquirerData.bank,
            };
        }
        else if (paymentMethod === "wallet" && acquirerData) {
            methodDetails.wallet = {
                wallet_name: acquirerData.wallet?.wallet_name,
            };
        }
        const payment = new Payment_1.Payment({
            orderId: order._id,
            paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            amount: Number(paymentDetails.amount) / 100,
            currency: paymentDetails.currency,
            status: paymentDetails.status === "captured" ? "captured" : "pending",
            method: paymentMethod,
            methodDetails,
            userId,
            userDetails: {
                name: user.name,
                email: user.email,
                phone: user.phone,
            },
            orderDetails: {
                items: order.items,
                totalAmount: order.totalAmount,
                address: order.address,
            },
            razorpayResponse: paymentDetails,
        });
        await payment.save();
        order.paymentStatus =
            paymentDetails.status === "captured" ? "paid" : "pending";
        order.razorpayPaymentId = razorpay_payment_id;
        await order.save();
        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            payment: {
                id: payment._id,
                paymentId: payment.paymentId,
                orderId: order._id,
                amount: payment.amount,
                status: payment.status,
                method: payment.method,
            },
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
const paymentCallback = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Missing required payment data",
            });
        }
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto_1.default
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "ICsVMT4uFvM53f0Czkqr5vmW")
            .update(body.toString())
            .digest("hex");
        const isAuthentic = expectedSignature === razorpay_signature;
        if (isAuthentic) {
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
//# sourceMappingURL=paymentController.js.map