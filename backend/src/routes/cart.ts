import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  createOrder,
  verifyPayment,
} from "../controllers/cartController";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = express.Router();

// Middleware to ensure customers and admins can access cart (for debugging - expanded access)
const customerOrAdmin = requireRole(["customer", "admin"]);

// Cart routes - customers and admins can manage carts (for debugging)
router.get("/", authenticateToken, customerOrAdmin, getCart);
router.post("/add", authenticateToken, customerOrAdmin, addToCart);
router.put("/update", authenticateToken, customerOrAdmin, updateCartItem);
router.delete("/remove", authenticateToken, customerOrAdmin, removeFromCart);
router.delete("/clear", authenticateToken, customerOrAdmin, clearCart);

// Checkout routes - customers and admins can create orders (for debugging)
router.post("/checkout/create-order", authenticateToken, customerOrAdmin, createOrder);
router.post("/checkout/verify", authenticateToken, customerOrAdmin, verifyPayment);

export default router;
