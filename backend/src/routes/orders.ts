import express from "express";
import {
  createOrder,
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
import { authenticateToken, requireRole } from "../middleware/auth";
import { Order } from "../models/Order";
import { getTrackingKillSwitchMode } from "../domains/tracking/services/trackingKillSwitch";
import { getTrackingProjection } from "../domains/tracking/services/trackingProjectionStore";

const router = express.Router();

// Order routes
router.get("/", authenticateToken, getOrders);
router.get("/:id", authenticateToken, getOrderById);
router.post("/", authenticateToken, createOrder);
router.post("/create", authenticateToken, placeOrderCOD); // Add missing create route
router.post("/cod", authenticateToken, placeOrderCOD);
router.put("/:id/cancel", authenticateToken, cancelOrder); // Changed from POST to PUT
router.get("/:id/tracking", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;

    // Find the order
    const order = await Order.findOne({ _id: id, userId })
      .populate("deliveryBoyId", "name phone vehicleType currentLocation")
      .populate("items.productId", "name images");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const mode = await getTrackingKillSwitchMode();
    if (mode !== "CUSTOMER_READ_ENABLED") {
      return res.json({ trackingState: "HIDDEN" });
    }

    const projection = await getTrackingProjection(String(order._id));
    if (!projection) {
      return res.json({
        trackingState: "OFFLINE",
        lastUpdatedAt: null,
        freshnessState: "OFFLINE",
      });
    }

    return res.json({
      trackingState: "AVAILABLE",
      lastUpdatedAt: projection.lastUpdatedAt,
      freshnessState: projection.freshnessState,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to get tracking information" });
  }
});
router.get("/:orderId/payment-status", authenticateToken, getPaymentStatus);
router.put("/:orderId/payment-status", authenticateToken, updatePaymentStatus);

// Order assignment routes
router.post(
  "/:orderId/assign",
  authenticateToken,
  requireRole(["admin"]),
  assignDeliveryBoyToOrder
);
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
