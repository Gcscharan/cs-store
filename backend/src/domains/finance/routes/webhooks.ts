import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { razorpayWebhook } from "../controllers/webhookController";
import { verifyRazorpayWebhook } from "../../../middleware/razorpayWebhook";
import { deprecatedRoute } from "../../../middleware/deprecatedRoute";

const router = express.Router();

router.use(
  deprecatedRoute({
    label: "legacy_finance_webhooks",
    replacement: "POST /api/webhooks/razorpay",
  })
);

// Webhook routes
router.post("/razorpay", verifyRazorpayWebhook, (req, res) => {
  // Pass socket.io instance to the webhook handler
  (req as any).io = (req as any).app.get("io");
  razorpayWebhook(req, res);
});

export default router;
