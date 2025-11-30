"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../../middleware/auth");
const paymentController_1 = require("../controllers/paymentController");
const router = express_1.default.Router();
// Test route
router.get("/test", (req, res) => {
    res.json({ message: "Payment routes working!" });
});
// Create Razorpay order
router.post("/create-order", auth_1.authenticateToken, paymentController_1.createOrder);
// Verify payment signature
router.post("/verify", paymentController_1.verifyPayment);
// Get payment details
router.get("/details/:payment_id", paymentController_1.getPaymentDetails);
// Payment callback (for webhooks)
router.post("/callback", paymentController_1.paymentCallback);
exports.default = router;
