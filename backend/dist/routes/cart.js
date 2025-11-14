"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cartController_1 = require("../controllers/cartController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.get("/", auth_1.authenticateToken, cartController_1.getCart);
router.post("/", auth_1.authenticateToken, cartController_1.addToCart);
router.put("/", auth_1.authenticateToken, cartController_1.updateCartItem);
router.delete("/:itemId", auth_1.authenticateToken, cartController_1.removeFromCart);
router.delete("/", auth_1.authenticateToken, cartController_1.clearCart);
router.post("/checkout/create-order", auth_1.authenticateToken, cartController_1.createOrder);
router.post("/checkout/verify", auth_1.authenticateToken, cartController_1.verifyPayment);
exports.default = router;
//# sourceMappingURL=cart.js.map