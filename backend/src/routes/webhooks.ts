import express from "express";
import { razorpayWebhook } from "../controllers/webhookController";

const router = express.Router();

// Webhook routes
router.post("/razorpay", razorpayWebhook);

export default router;
