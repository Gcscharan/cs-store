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
        const io = req.io;
        switch (event) {
            case "payment.captured":
                const order1 = await Order_1.Order.findOneAndUpdate({ razorpayOrderId: payload.payment.entity.order_id }, {
                    paymentStatus: "paid",
                    razorpayPaymentId: payload.payment.entity.id,
                }, { new: true });
                if (order1 && io) {
                    io.to(`order_${order1._id}`).emit("order:payment:success", {
                        orderId: order1._id,
                        paymentId: payload.payment.entity.id,
                    });
                    io.to("admin_room").emit("order:payment:success", {
                        orderId: order1._id,
                        paymentId: payload.payment.entity.id,
                    });
                }
                break;
            case "payment.failed":
                const order2 = await Order_1.Order.findOneAndUpdate({ razorpayOrderId: payload.payment.entity.order_id }, { paymentStatus: "failed" }, { new: true });
                if (order2 && io) {
                    io.to(`order_${order2._id}`).emit("order:payment:failed", {
                        orderId: order2._id,
                        reason: payload.payment.entity.error_description,
                    });
                }
                break;
            case "order.paid":
                const order3 = await Order_1.Order.findOneAndUpdate({ razorpayOrderId: payload.order.entity.id }, { paymentStatus: "paid" }, { new: true });
                if (order3 && io) {
                    io.to(`order_${order3._id}`).emit("order:payment:success", {
                        orderId: order3._id,
                    });
                }
                break;
            default:
                console.log(`Unhandled webhook event: ${event}`);
        }
        res.json({ status: "success" });
    }
    catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
        return;
    }
};
exports.razorpayWebhook = razorpayWebhook;
//# sourceMappingURL=webhookController.js.map