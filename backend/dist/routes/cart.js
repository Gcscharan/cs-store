"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const CartController_1 = require("../domains/cart/controllers/CartController");
const cartController_1 = require("../controllers/cartController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Test endpoint to verify route is working
router.get("/test", (req, res) => {
    console.log('[CartRoute] Test endpoint called');
    res.json({ message: "Cart route is working!" });
});
// Middleware to ensure only customers can access cart
const customerOnly = (0, auth_1.requireRole)(["customer"]);
// Cart routes - customers only can manage carts
router.get("/", auth_1.authenticateToken, customerOnly, CartController_1.getCart);
// Unified POST endpoint for cart operations (frontend compatibility)
router.post("/", auth_1.authenticateToken, customerOnly, async (req, res) => {
    console.log('[CartRoute] POST /api/cart called with body:', req.body);
    console.log('[CartRoute] POST /api/cart - req.user exists:', !!req.user);
    if (req.user) {
        console.log('[CartRoute] POST /api/cart - user role:', req.user.role);
    }
    try {
        // If body contains productId, treat as addToCart
        if (req.body.productId) {
            console.log('[CartRoute] Treating as addToCart request');
            return await (0, CartController_1.addToCart)(req, res);
        }
        // Otherwise, treat as getCart request
        console.log('[CartRoute] Treating as getCart request');
        return await (0, CartController_1.getCart)(req, res);
    }
    catch (error) {
        console.log('[CartRoute] POST /api/cart error:', error);
        res.status(500).json({ message: "Cart operation failed" });
    }
});
// Unified PUT endpoint for cart item updates (frontend compatibility)
router.put("/", auth_1.authenticateToken, customerOnly, async (req, res) => {
    console.log('[CartRoute] PUT /api/cart called with body:', req.body);
    try {
        return await (0, CartController_1.updateCartItem)(req, res);
    }
    catch (error) {
        console.log('[CartRoute] PUT /api/cart error:', error);
        res.status(500).json({ message: "Cart update failed" });
    }
});
router.post("/add", auth_1.authenticateToken, customerOnly, CartController_1.addToCart);
router.put("/update", auth_1.authenticateToken, customerOnly, CartController_1.updateCartItem);
// Frontend calls DELETE /api/cart/:productId, so support both param and body-based removal
router.delete("/:productId", auth_1.authenticateToken, customerOnly, CartController_1.removeFromCart);
router.delete("/remove", auth_1.authenticateToken, customerOnly, CartController_1.removeFromCart);
router.delete("/clear", auth_1.authenticateToken, customerOnly, CartController_1.clearCart);
// Checkout routes - customers only can create orders
router.post("/checkout/create-order", auth_1.authenticateToken, customerOnly, cartController_1.createOrder);
router.post("/checkout/verify", auth_1.authenticateToken, customerOnly, cartController_1.verifyPayment);
exports.default = router;
