import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { razorpayWebhook } from "../controllers/webhookController";
import { verifyRazorpayWebhook } from "../../../middleware/razorpayWebhook";

const router = express.Router();

// Webhook routes
router.post("/razorpay", verifyRazorpayWebhook, (req, res) => {
  // Pass socket.io instance to the webhook handler
  (req as any).io = (req as any).app.get("io");
  razorpayWebhook(req, res);
});

export default router;
