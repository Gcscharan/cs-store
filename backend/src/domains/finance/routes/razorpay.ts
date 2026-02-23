import express from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} from "../controllers/razorpayController";
import { authenticateToken } from "../../../middleware/auth";
import { verifyRazorpayWebhook } from "../../../middleware/razorpayWebhook";
import { deprecatedRoute } from "../../../middleware/deprecatedRoute";

const router = express.Router();

router.use(
  deprecatedRoute({
    label: "legacy_finance_razorpay_routes",
    replacement: "POST /api/payment-intents + POST /api/webhooks/razorpay",
  })
);

// Razorpay payment routes
router.post("/create-order", authenticateToken, createRazorpayOrder);
router.post("/verify-payment", authenticateToken, verifyRazorpayPayment);

// Webhook route (no authentication required as it comes from Razorpay)
router.post("/webhook", express.raw({ type: "application/json" }), verifyRazorpayWebhook, handleRazorpayWebhook);

export default router;
