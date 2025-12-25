"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const deliveryController_1 = require("../controllers/deliveryController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Calculate delivery fee
router.post("/calculate-fee", auth_1.authenticateToken, deliveryController_1.calculateDeliveryFeeController);
exports.default = router;
