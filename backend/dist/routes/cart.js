"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cartController_1 = require("../controllers/cartController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Middleware to ensure customers and admins can access cart (for debugging - expanded access)
const customerOrAdmin = (0, auth_1.requireRole)(["customer", "admin"]);
// Cart routes - customers and admins can manage carts (for debugging)
router.get("/", auth_1.authenticateToken, customerOrAdmin, cartController_1.getCart);
router.post("/add", auth_1.authenticateToken, customerOrAdmin, cartController_1.addToCart);
router.put("/update", auth_1.authenticateToken, customerOrAdmin, cartController_1.updateCartItem);
router.delete("/remove", auth_1.authenticateToken, customerOrAdmin, cartController_1.removeFromCart);
router.delete("/clear", auth_1.authenticateToken, customerOrAdmin, cartController_1.clearCart);
// Checkout routes - customers and admins can create orders (for debugging)
router.post("/checkout/create-order", auth_1.authenticateToken, customerOrAdmin, cartController_1.createOrder);
router.post("/checkout/verify", auth_1.authenticateToken, customerOrAdmin, cartController_1.verifyPayment);
exports.default = router;
