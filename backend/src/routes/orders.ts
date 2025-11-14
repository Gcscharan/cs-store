import express from "express";
import {
  getOrders,
  getOrderById,
  cancelOrder,
  placeOrderCOD,
  getPaymentStatus,
  updatePaymentStatus,
} from "../domains/operations/controllers/orderController";
import {
  assignDeliveryBoyToOrder,
  unassignDeliveryBoyFromOrder,
  getOptimalDeliveryBoy,
} from "../controllers/orderAssignmentController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Order routes
router.get("/", authenticateToken, getOrders);
router.get("/:id", authenticateToken, getOrderById);
router.post("/cod", authenticateToken, placeOrderCOD);
router.post("/:id/cancel", authenticateToken, cancelOrder);
router.get("/:orderId/payment-status", authenticateToken, getPaymentStatus);
router.put("/:orderId/payment-status", authenticateToken, updatePaymentStatus);

// Order assignment routes
router.post("/:orderId/assign", authenticateToken, assignDeliveryBoyToOrder);
router.delete(
  "/:orderId/assign",
  authenticateToken,
  unassignDeliveryBoyFromOrder
);
router.get(
  "/:orderId/optimal-delivery-boy",
  authenticateToken,
  getOptimalDeliveryBoy
);

export default router;
