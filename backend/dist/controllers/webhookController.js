"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayWebhook = void 0;
const Order_1 = require("../models/Order");
const crypto_1 = __importDefault(require("crypto"));
const razorpayWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const body = JSON.stringify(req.body);
        const expectedSignature = crypto_1.default
            .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "")
            .update(body)
            .digest("hex");
        if (signature !== expectedSignature) {
            return res.status(400).json({ error: "Invalid signature" });
        }
        const { event, payload } = req.body;
        switch (event) {
            case "payment.captured":
                await Order_1.Order.findOneAndUpdate({ razorpayOrderId: payload.payment.entity.order_id }, {
                    paymentStatus: "paid",
                    razorpayPaymentId: payload.payment.entity.id,
                });
                break;
            case "payment.failed":
                await Order_1.Order.findOneAndUpdate({ razorpayOrderId: payload.payment.entity.order_id }, { paymentStatus: "failed" });
                break;
            case "order.paid":
                await Order_1.Order.findOneAndUpdate({ razorpayOrderId: payload.order.entity.id }, { paymentStatus: "paid" });
                break;
            default:
                console.log(`Unhandled webhook event: ${event}`);
        }
        res.json({ status: "success" });
    }
    catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};
exports.razorpayWebhook = razorpayWebhook;
//# sourceMappingURL=webhookController.js.map