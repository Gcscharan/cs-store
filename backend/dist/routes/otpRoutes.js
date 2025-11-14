"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const otpController_1 = require("../controllers/otpController");
const router = express_1.default.Router();
router.post("/payment/generate", auth_1.authenticateToken, otpController_1.generatePaymentOTP);
router.post("/payment/verify", auth_1.authenticateToken, otpController_1.verifyPaymentOTP);
router.post("/payment/resend", auth_1.authenticateToken, otpController_1.resendPaymentOTP);
exports.default = router;
//# sourceMappingURL=otpRoutes.js.map