"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../../middleware/auth");
const paymentController_1 = require("../controllers/paymentController");
const razorpayWebhook_1 = require("../../../middleware/razorpayWebhook");
const router = express_1.default.Router();
// Create Razorpay order
router.post("/create-order", auth_1.authenticateToken, paymentController_1.createOrder);
// Verify payment signature
router.post("/verify", auth_1.authenticateToken, paymentController_1.verifyPayment);
// Get payment details
router.get("/details/:payment_id", auth_1.authenticateToken, paymentController_1.getPaymentDetails);
// Payment callback (for webhooks)
router.post("/callback", razorpayWebhook_1.verifyRazorpayWebhook, paymentController_1.paymentCallback);
exports.default = router;
