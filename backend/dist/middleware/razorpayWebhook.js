"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRazorpayWebhook = void 0;
const crypto_1 = __importDefault(require("crypto"));
const verifyRazorpayWebhook = (req, res, next) => {
    try {
        const razorpaySignature = req.headers['x-razorpay-signature'];
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!razorpaySignature) {
            return res.status(400).json({ error: 'Missing Razorpay signature' });
        }
        if (!webhookSecret) {
            return res.status(500).json({ error: 'Webhook secret not configured' });
        }
        const body = JSON.stringify(req.body);
        const expectedSignature = crypto_1.default
            .createHmac('sha256', webhookSecret)
            .update(body)
            .digest('hex');
        if (razorpaySignature !== expectedSignature) {
            return res.status(401).json({ error: 'Invalid webhook signature' });
        }
        next();
    }
    catch (error) {
        return res.status(500).json({ error: 'Webhook verification failed' });
    }
};
exports.verifyRazorpayWebhook = verifyRazorpayWebhook;
