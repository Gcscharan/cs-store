import express from "express";
import { authenticateToken } from "../../../middleware/auth";
import { deprecatedRoute } from "../../../middleware/deprecatedRoute";
import {
  createOrder,
  verifyPayment,
  getPaymentDetails,
  paymentCallback,
  getAllPayments,
  getPaymentStats,
} from "../controllers/paymentController";
import { verifyRazorpayWebhook } from "../../../middleware/razorpayWebhook";

const router = express.Router();

router.use(
  deprecatedRoute({
    label: "legacy_finance_paymentRoutes",
    replacement: "POST /api/payment-intents + POST /api/webhooks/razorpay",
  })
);


// Create Razorpay order
router.post("/create-order", authenticateToken, createOrder);

// Verify payment signature
router.post("/verify", authenticateToken, verifyPayment);

// Get payment details
router.get("/details/:payment_id", authenticateToken, getPaymentDetails);

// Get all payments for admin panel
router.get("/", authenticateToken, getAllPayments);

// Get payment statistics for admin dashboard
router.get("/stats/overview", authenticateToken, getPaymentStats);

// Payment callback (for webhooks)
router.post("/callback", verifyRazorpayWebhook, paymentCallback);

export default router;
