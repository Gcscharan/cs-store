"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayWebhook = void 0;
const razorpayWebhook = async (req, res) => {
    try {
        // SAFETY: Disabled to enforce single payment source-of-truth
        return res.status(410).json({
            error: "LEGACY_PAYMENT_PATH_DISABLED",
            message: "This payment path has been permanently disabled. Use PaymentIntent flow.",
        });
    }
    catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
        return;
    }
};
exports.razorpayWebhook = razorpayWebhook;
