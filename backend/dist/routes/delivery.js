"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const deliveryController_1 = require("../controllers/deliveryController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get("/available-drivers", deliveryController_1.getAvailableDrivers);
router.post("/assign", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), deliveryController_1.assignDelivery);
router.post("/update-location", auth_1.authenticateToken, (0, auth_1.requireRole)(["delivery"]), deliveryController_1.updateLocation);
router.post("/update-status", auth_1.authenticateToken, (0, auth_1.requireRole)(["delivery"]), deliveryController_1.updateStatus);
router.get("/my-orders", auth_1.authenticateToken, (0, auth_1.requireRole)(["delivery"]), deliveryController_1.getMyOrders);
exports.default = router;
//# sourceMappingURL=delivery.js.map