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
// Generate OTP for payment verification
router.post("/payment/generate", auth_1.authenticateToken, otpController_1.generatePaymentOTP);
// Verify OTP for payment
router.post("/payment/verify", auth_1.authenticateToken, otpController_1.verifyPaymentOTP);
// Resend OTP for payment
router.post("/payment/resend", auth_1.authenticateToken, otpController_1.resendPaymentOTP);
exports.default = router;
