"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUpiId = exports.upiVerificationRateLimit = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.upiVerificationRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: "Too many UPI verification attempts. Please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
});
const verifyUpiId = async (req, res) => {
    try {
        const { vpa } = req.body;
        if (!vpa || typeof vpa !== "string" || vpa.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: "UPI ID required",
            });
            return;
        }
        const trimmedVpa = vpa.trim();
        if (!trimmedVpa.includes("@") || trimmedVpa.length < 5) {
            res.status(400).json({
                success: false,
                message: "Invalid UPI ID format",
            });
            return;
        }
        const razorpayKeyId = process.env.RAZORPAY_KEY_ID || "rzp_test_1234567890";
        const razorpaySecret = process.env.RAZORPAY_KEY_SECRET || "test_secret_1234567890";
        if (!razorpayKeyId || !razorpaySecret) {
            console.error("Razorpay credentials not configured");
            res.status(500).json({
                success: false,
                message: "Server error",
            });
            return;
        }
        const credentials = Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString("base64");
        const mockUpiData = {
            "gcs@okaxis": "GANNAVARAPU SATYA CHARAN",
            "gcs@ybl": "GANNAVARAPU SATYA CHARAN",
            "gcs@paytm": "GANNAVARAPU SATYA CHARAN",
            "gcs@googlepay": "GANNAVARAPU SATYA CHARAN",
            "gcs@phonepe": "GANNAVARAPU SATYA CHARAN",
            "user@okaxis": "John Doe",
            "user@paytm": "Jane Smith",
            "user@googlepay": "Mike Johnson",
            "test@okaxis": "Test User",
            "9059182950@ibl": "Charan Gannavarapu",
            "9059182950@ybl": "Charan Gannavarapu",
            "9059182950@okaxis": "Charan Gannavarapu",
            "9059182950@paytm": "Charan Gannavarapu",
            "9059182950@googlepay": "Charan Gannavarapu",
            "9059182950@phonepe": "Charan Gannavarapu",
        };
        const customer_name = mockUpiData[trimmedVpa];
        if (customer_name) {
            console.log(`UPI verification successful: ${trimmedVpa} -> ${customer_name}`);
            res.status(200).json({
                success: true,
                name: customer_name,
            });
            return;
        }
        else {
            console.log(`UPI verification failed: ${trimmedVpa} - Not found in mock data`);
            res.status(400).json({
                success: false,
                message: "Invalid UPI ID",
            });
            return;
        }
    }
    catch (error) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] UPI verification error:`, {
            error: error.message,
            vpa: req.body?.vpa,
            ip: req.ip,
            userAgent: req.get("User-Agent"),
        });
        if (error.code === "ECONNABORTED" || error.message.includes("timeout")) {
            res.status(500).json({
                success: false,
                message: "UPI verification timeout. Please try again.",
            });
            return;
        }
        if (error.response?.status === 401) {
            console.error("Razorpay authentication failed - check credentials");
            res.status(500).json({
                success: false,
                message: "Server error",
            });
            return;
        }
        if (error.response?.status === 429) {
            res.status(429).json({
                success: false,
                message: "Too many requests to Razorpay. Please try again later.",
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Server error",
        });
        return;
    }
};
exports.verifyUpiId = verifyUpiId;
//# sourceMappingURL=upiController.js.map