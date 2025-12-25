"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const razorpayController_1 = require("../controllers/razorpayController");
const auth_1 = require("../../../middleware/auth");
const razorpayWebhook_1 = require("../../../middleware/razorpayWebhook");
const router = express_1.default.Router();
// Razorpay payment routes
router.post("/create-order", auth_1.authenticateToken, razorpayController_1.createRazorpayOrder);
router.post("/verify-payment", auth_1.authenticateToken, razorpayController_1.verifyRazorpayPayment);
// Webhook route (no authentication required as it comes from Razorpay)
router.post("/webhook", express_1.default.raw({ type: "application/json" }), razorpayWebhook_1.verifyRazorpayWebhook, razorpayController_1.handleRazorpayWebhook);
exports.default = router;
