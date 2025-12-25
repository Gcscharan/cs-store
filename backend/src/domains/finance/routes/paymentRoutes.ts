import express from "express";
import { authenticateToken } from "../../../middleware/auth";
import {
  createOrder,
  verifyPayment,
  getPaymentDetails,
  paymentCallback,
} from "../controllers/paymentController";
import { verifyRazorpayWebhook } from "../../../middleware/razorpayWebhook";

const router = express.Router();


// Create Razorpay order
router.post("/create-order", authenticateToken, createOrder);

// Verify payment signature
router.post("/verify", authenticateToken, verifyPayment);

// Get payment details
router.get("/details/:payment_id", authenticateToken, getPaymentDetails);

// Payment callback (for webhooks)
router.post("/callback", verifyRazorpayWebhook, paymentCallback);

export default router;
