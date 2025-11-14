import express from "express";
import {
  createOrder,
  verifyPayment,
  getPaymentDetails,
  paymentCallback,
} from "../controllers/paymentController";

const router = express.Router();

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Payment routes working!" });
});

// Create Razorpay order
router.post("/create-order", createOrder);

// Verify payment signature
router.post("/verify", verifyPayment);

// Get payment details
router.get("/details/:payment_id", getPaymentDetails);

// Payment callback (for webhooks)
router.post("/callback", paymentCallback);

export default router;
