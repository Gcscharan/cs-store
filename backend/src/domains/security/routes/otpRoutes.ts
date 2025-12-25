import express from "express";
import { authenticateToken } from "../../../middleware/auth";
import {
  generatePaymentOTP,
  verifyPaymentOTP,
  resendPaymentOTP,
  generateVerificationOTP,
} from "../controllers/otpController";
import { sendSMS } from "../../../utils/sms";

const router = express.Router();

// Generate OTP for mobile verification (authentication optional)
router.post("/verification/generate", (req, res, next) => {
  // Try to authenticate if token is provided, but don't require it
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    // Temporarily attach user for this request
    authenticateToken(req, res, (err) => {
      if (err) {
        // Ignore authentication errors, proceed without user
        generateVerificationOTP(req, res);
      } else {
        generateVerificationOTP(req, res);
      }
    });
  } else {
    // No token provided, proceed without authentication
    generateVerificationOTP(req, res);
  }
});


// Generate OTP for payment verification
router.post("/payment/generate", authenticateToken, generatePaymentOTP);

// Verify OTP for payment
router.post("/payment/verify", authenticateToken, verifyPaymentOTP);

// Resend OTP for payment
router.post("/payment/resend", authenticateToken, resendPaymentOTP);

export default router;
