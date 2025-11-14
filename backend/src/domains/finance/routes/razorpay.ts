import express from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
} from "../controllers/razorpayController";
import { authenticateToken } from "../../../middleware/auth";

const router = express.Router();

// Razorpay payment routes
router.post("/create-order", authenticateToken, createRazorpayOrder);
router.post("/verify-payment", authenticateToken, verifyRazorpayPayment);

// Webhook route (no authentication required as it comes from Razorpay)
router.post("/webhook", express.raw({ type: "application/json" }), handleRazorpayWebhook);

export default router;
