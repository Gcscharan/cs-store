"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webhookController_1 = require("../controllers/webhookController");
const router = express_1.default.Router();
router.post("/razorpay", (req, res) => {
    req.io = req.app.get("io");
    (0, webhookController_1.razorpayWebhook)(req, res);
});
exports.default = router;
//# sourceMappingURL=webhooks.js.map