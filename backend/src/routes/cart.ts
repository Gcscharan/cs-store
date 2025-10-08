import express from "express";
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  createOrder,
  verifyPayment,
} from "../controllers/cartController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Cart routes
router.get("/", authenticateToken, getCart);
router.post("/", authenticateToken, addToCart);
router.put("/", authenticateToken, updateCartItem);
router.delete("/:itemId", authenticateToken, removeFromCart);

// Checkout routes
router.post("/checkout/create-order", authenticateToken, createOrder);
router.post("/checkout/verify", authenticateToken, verifyPayment);

export default router;
