"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../../middleware/auth");
const otpController_1 = require("../controllers/otpController");
const router = express_1.default.Router();
// Generate OTP for mobile verification (authentication optional)
router.post("/verification/generate", (req, res, next) => {
    // Try to authenticate if token is provided, but don't require it
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        // Temporarily attach user for this request
        (0, auth_1.authenticateToken)(req, res, (err) => {
            if (err) {
                // Ignore authentication errors, proceed without user
                (0, otpController_1.generateVerificationOTP)(req, res);
            }
            else {
                (0, otpController_1.generateVerificationOTP)(req, res);
            }
        });
    }
    else {
        // No token provided, proceed without authentication
        (0, otpController_1.generateVerificationOTP)(req, res);
    }
});
// --- TEMP: debug route (unprotected) ---
// POST /api/otp/debug/generate
// Calls the same controller but bypasses authenticateToken so we can test easily.
router.post("/debug/generate", async (req, res, next) => {
    try {
        return (0, otpController_1.generateVerificationOTP)(req, res);
    }
    catch (err) {
        next(err);
    }
});
// --- DEBUG SMS ENDPOINT (unprotected) ---
// POST /api/otp/debug/sms
// Body: { "phone": "9876543210" }
// Directly tests SMS sending without OTP logic
router.post("/debug/sms", async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({
                success: false,
                message: "Phone number is required",
            });
        }
        // Validate phone format before processing
        const { validatePhoneNumber } = require("../../../utils/sms");
        if (!validatePhoneNumber(phone)) {
            return res.status(400).json({
                success: false,
                message: "Invalid phone number format",
            });
        }
        const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const testMessage = `TEST OTP from CS Store: ${testOtp}. This is a debug test message.`;
        const { sendSMS } = require("../../../utils/sms");
        const smsOk = await sendSMS(phone, testMessage);
        if (smsOk) {
            return res.status(200).json({
                success: true,
                message: "SMS sent successfully",
                phone,
                testOtp,
                timestamp: new Date().toISOString()
            });
        }
        else {
            return res.status(500).json({
                success: false,
                message: "SMS sending failed",
                phone,
                testOtp,
                timestamp: new Date().toISOString()
            });
        }
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: "Exception occurred",
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});
// Generate OTP for payment verification
router.post("/payment/generate", auth_1.authenticateToken, otpController_1.generatePaymentOTP);
// Verify OTP for payment
router.post("/payment/verify", auth_1.authenticateToken, otpController_1.verifyPaymentOTP);
// Resend OTP for payment
router.post("/payment/resend", auth_1.authenticateToken, otpController_1.resendPaymentOTP);
exports.default = router;
