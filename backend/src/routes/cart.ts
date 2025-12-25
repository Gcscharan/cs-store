import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
} from "../domains/cart/controllers/CartController";
import { createOrder, verifyPayment } from "../controllers/cartController";
import { authenticateToken, requireRole } from "../middleware/auth";
import { IUser } from "../models/User";

const router = express.Router();

// Test endpoint to verify route is working
router.get("/test", (req, res) => {
  console.log('[CartRoute] Test endpoint called');
  res.json({ message: "Cart route is working!" });
});

// Middleware to ensure only customers can access cart
const customerOnly = requireRole(["customer"]);

// Cart routes - customers only can manage carts
router.get("/", authenticateToken, customerOnly, getCart);

// Unified POST endpoint for cart operations (frontend compatibility)
router.post("/", authenticateToken, customerOnly, async (req, res) => {
  console.log('[CartRoute] POST /api/cart called with body:', req.body);
  console.log('[CartRoute] POST /api/cart - req.user exists:', !!req.user);
  if (req.user) {
    console.log('[CartRoute] POST /api/cart - user role:', (req.user as IUser).role);
  }
  
  try {
    // If body contains productId, treat as addToCart
    if (req.body.productId) {
      console.log('[CartRoute] Treating as addToCart request');
      return await addToCart(req, res);
    }
    
    // Otherwise, treat as getCart request
    console.log('[CartRoute] Treating as getCart request');
    return await getCart(req, res);
  } catch (error) {
    console.log('[CartRoute] POST /api/cart error:', error);
    res.status(500).json({ message: "Cart operation failed" });
  }
});

// Unified PUT endpoint for cart item updates (frontend compatibility)
router.put("/", authenticateToken, customerOnly, async (req, res) => {
  console.log('[CartRoute] PUT /api/cart called with body:', req.body);
  try {
    return await updateCartItem(req, res);
  } catch (error) {
    console.log('[CartRoute] PUT /api/cart error:', error);
    res.status(500).json({ message: "Cart update failed" });
  }
});

router.post("/add", authenticateToken, customerOnly, addToCart);
router.put("/update", authenticateToken, customerOnly, updateCartItem);
// Frontend calls DELETE /api/cart/:productId, so support both param and body-based removal
router.delete("/remove", authenticateToken, customerOnly, removeFromCart);
router.delete("/clear", authenticateToken, customerOnly, clearCart);
router.delete("/:productId", authenticateToken, customerOnly, removeFromCart);

// Checkout routes - customers only can create orders
router.post("/checkout/create-order", authenticateToken, customerOnly, createOrder);
router.post("/checkout/verify", authenticateToken, customerOnly, verifyPayment);

export default router;
