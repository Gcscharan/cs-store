"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const paymentController_1 = require("../controllers/paymentController");
const router = express_1.default.Router();
router.get("/test", (req, res) => {
    res.json({ message: "Payment routes working!" });
});
router.post("/create-order", paymentController_1.createOrder);
router.post("/verify", paymentController_1.verifyPayment);
router.get("/details/:payment_id", paymentController_1.getPaymentDetails);
router.post("/callback", paymentController_1.paymentCallback);
exports.default = router;
//# sourceMappingURL=paymentRoutes.js.map