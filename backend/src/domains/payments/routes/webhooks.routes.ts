import express from "express";

import { razorpayWebhook } from "../controllers/webhooks.controller";
import { verifyRazorpaySignature } from "../middleware/webhookAuth";

const router = express.Router();

// POST /api/webhooks/razorpay
// Handles Razorpay webhook events for payment verification
// Requirements: TR-004, BR-005, NFR-002
router.post("/razorpay", verifyRazorpaySignature, razorpayWebhook);

export default router;
