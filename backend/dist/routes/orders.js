"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("../controllers/orderController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get("/", auth_1.authenticateToken, orderController_1.getOrders);
router.get("/:id", auth_1.authenticateToken, orderController_1.getOrderById);
router.post("/:id/cancel", auth_1.authenticateToken, orderController_1.cancelOrder);
exports.default = router;
//# sourceMappingURL=orders.js.map