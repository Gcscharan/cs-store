import express from "express";
import {
  getOrders,
  getOrderById,
  cancelOrder,
} from "../controllers/orderController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Order routes
router.get("/", authenticateToken, getOrders);
router.get("/:id", authenticateToken, getOrderById);
router.post("/:id/cancel", authenticateToken, cancelOrder);

export default router;
