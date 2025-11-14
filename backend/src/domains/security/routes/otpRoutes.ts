import express from "express";
import { authenticateToken } from "../../../middleware/auth";
import {
  generatePaymentOTP,
  verifyPaymentOTP,
  resendPaymentOTP,
} from "../controllers/otpController";

const router = express.Router();

// Generate OTP for payment verification
router.post("/payment/generate", authenticateToken, generatePaymentOTP);

// Verify OTP for payment
router.post("/payment/verify", authenticateToken, verifyPaymentOTP);

// Resend OTP for payment
router.post("/payment/resend", authenticateToken, resendPaymentOTP);

export default router;
