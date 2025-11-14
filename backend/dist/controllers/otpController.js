"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendPaymentOTP = exports.verifyPaymentOTP = exports.generatePaymentOTP = void 0;
const Otp_1 = __importDefault(require("../models/Otp"));
const Order_1 = require("../models/Order");
const User_1 = require("../models/User");
const sms_1 = require("../utils/sms");
const cardValidation_1 = require("../utils/cardValidation");
const generatePaymentOTP = async (req, res) => {
    try {
        const { orderId, cardNumber, cardHolderName, expiryDate, cvv } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: "User not authenticated" });
            return;
        }
        if (!orderId || !cardNumber || !cardHolderName || !expiryDate || !cvv) {
            res.status(400).json({
                message: "Order ID, card number, card holder name, expiry date, and CVV are required",
            });
            return;
        }
        const cardValidation = (0, cardValidation_1.validateCard)(cardNumber, expiryDate, cvv, cardHolderName);
        if (!cardValidation.isValid) {
            res.status(400).json({
                message: "Invalid card details",
                errors: cardValidation.errors,
            });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "User not found" });
            return;
        }
        const order = await Order_1.Order.findById(orderId);
        if (!order) {
            res.status(404).json({ message: "Order not found" });
            return;
        }
        if (order.userId.toString() !== userId) {
            res.status(403).json({ message: "Unauthorized access to order" });
            return;
        }
        const otp = (0, sms_1.generateOTP)();
        const otpRecord = new Otp_1.default({
            phone: user.phone,
            otp,
            type: "payment",
            orderId: order._id,
            paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });
        await otpRecord.save();
        const message = `Your CS Store payment OTP is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
        await (0, sms_1.sendSMS)(user.phone, message);
        const otpData = {
            paymentId: otpRecord.paymentId,
            orderId: order._id,
            amount: order.totalAmount,
            cardLast4: cardNumber.slice(-4),
            cardHolderName,
            expiresIn: 600,
            timestamp: new Date().toISOString(),
        };
        const realTimeDelivered = false;
        if (realTimeDelivered) {
            console.log(`📱 OTP delivered in real-time to user ${userId}`);
        }
        else {
            console.log(`⚠️ User ${userId} not connected, OTP sent via SMS only`);
        }
        res.status(200).json({
            message: realTimeDelivered
                ? "OTP sent successfully (real-time)"
                : "OTP sent successfully (SMS)",
            paymentId: otpRecord.paymentId,
            expiresIn: 600,
            realTimeDelivered,
        });
        return;
    }
    catch (error) {
        console.error("Generate payment OTP error:", error);
        res.status(500).json({ message: "Failed to generate OTP" });
        return;
    }
};
exports.generatePaymentOTP = generatePaymentOTP;
const verifyPaymentOTP = async (req, res) => {
    try {
        const { paymentId, otp } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        if (!paymentId || !otp) {
            return res.status(400).json({
                message: "Payment ID and OTP are required",
            });
        }
        const otpRecord = await Otp_1.default.findOne({
            paymentId,
            type: "payment",
            isUsed: false,
            expiresAt: { $gt: new Date() },
        });
        if (!otpRecord) {
            return res.status(400).json({
                message: "Invalid or expired OTP",
            });
        }
        if (otpRecord.attempts >= 3) {
            return res.status(400).json({
                message: "Maximum OTP attempts exceeded. Please generate a new OTP.",
            });
        }
        if (otpRecord.otp !== otp) {
            otpRecord.attempts += 1;
            await otpRecord.save();
            return res.status(400).json({
                message: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`,
            });
        }
        otpRecord.isUsed = true;
        await otpRecord.save();
        const order = await Order_1.Order.findById(otpRecord.orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        order.paymentStatus = "paid";
        await order.save();
        const verificationResult = {
            success: true,
            orderId: order._id,
            paymentId,
            amount: order.totalAmount,
            status: "verified",
            timestamp: new Date().toISOString(),
        };
        res.status(200).json({
            message: "Payment verified successfully",
            orderId: order._id,
            paymentId,
            amount: order.totalAmount,
        });
        return;
    }
    catch (error) {
        console.error("Verify payment OTP error:", error);
        res.status(500).json({ message: "Failed to verify OTP" });
        return;
    }
};
exports.verifyPaymentOTP = verifyPaymentOTP;
const resendPaymentOTP = async (req, res) => {
    try {
        const { paymentId } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "User not authenticated" });
        }
        if (!paymentId) {
            return res.status(400).json({ message: "Payment ID is required" });
        }
        const existingOtp = await Otp_1.default.findOne({
            paymentId,
            type: "payment",
            isUsed: false,
        });
        if (!existingOtp) {
            return res.status(404).json({ message: "Payment session not found" });
        }
        const timeSinceLastUpdate = Date.now() - existingOtp.updatedAt.getTime();
        if (timeSinceLastUpdate < 30000) {
            return res.status(400).json({
                message: "Please wait 30 seconds before resending OTP",
            });
        }
        const newOtp = (0, sms_1.generateOTP)();
        existingOtp.otp = newOtp;
        existingOtp.attempts = 0;
        existingOtp.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await existingOtp.save();
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const message = `Your CS Store payment OTP is ${newOtp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
        await (0, sms_1.sendSMS)(user.phone, message);
        const otpData = {
            paymentId: existingOtp.paymentId,
            orderId: existingOtp.orderId,
            expiresIn: 600,
            timestamp: new Date().toISOString(),
            isResend: true,
        };
        const realTimeDelivered = false;
        if (realTimeDelivered) {
            console.log(`📱 OTP resent in real-time to user ${userId}`);
        }
        else {
            console.log(`⚠️ User ${userId} not connected, OTP resent via SMS only`);
        }
        res.status(200).json({
            message: realTimeDelivered
                ? "OTP resent successfully (real-time)"
                : "OTP resent successfully (SMS)",
            expiresIn: 600,
            realTimeDelivered,
        });
        return;
    }
    catch (error) {
        console.error("Resend payment OTP error:", error);
        res.status(500).json({ message: "Failed to resend OTP" });
        return;
    }
};
exports.resendPaymentOTP = resendPaymentOTP;
//# sourceMappingURL=otpController.js.map