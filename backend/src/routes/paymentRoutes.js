const express = require("express");
const router = express.Router();
const {
  createOrder,
  verifyPayment,
  getPaymentDetails,
  getAllPayments,
  getPaymentStats,
  paymentCallback,
} = require("../controllers/paymentController");
const {
  validateCardDetails,
} = require("../controllers/cardValidationController");
const {
  verifyUpiId,
  upiVerificationRateLimit,
} = require("../controllers/upiController");
const { authenticateToken } = require("../middleware/auth");

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Payment routes working!" });
});

// Create Razorpay order for cart checkout
router.post("/create-order", authenticateToken, createOrder);

// Verify payment signature
router.post("/verify", authenticateToken, verifyPayment);

// Get payment details
router.get("/:payment_id", authenticateToken, getPaymentDetails);

// Get all payments for admin panel
router.get("/", authenticateToken, getAllPayments);

// Get payment statistics for admin dashboard
router.get("/stats/overview", authenticateToken, getPaymentStats);

// Payment callback handler (for webhooks)
router.post("/callback", paymentCallback);

// Card validation route
router.post("/validate-card", validateCardDetails);

// UPI verification route with rate limiting
router.post("/verify-upi", upiVerificationRateLimit, verifyUpiId);

module.exports = router;
