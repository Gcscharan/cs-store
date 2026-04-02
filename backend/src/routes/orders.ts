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
import { checkoutRateLimit } from "../middleware/security";
import { Order } from "../models/Order";
import { getTrackingKillSwitchMode } from "../domains/tracking/services/trackingKillSwitch";
import { getTrackingProjection } from "../domains/tracking/services/trackingProjectionStore";
import mongoose, { Types } from "mongoose";

const router = express.Router();

// Order routes
router.get("/", authenticateToken, getOrders);
router.get("/:id", authenticateToken, getOrderById);
router.post("/", authenticateToken, checkoutRateLimit, createOrder);
router.post("/create", authenticateToken, checkoutRateLimit, placeOrderCOD); // Add missing create route
router.post("/cod", authenticateToken, checkoutRateLimit, placeOrderCOD);
router.put("/:id/cancel", authenticateToken, cancelOrder); // Changed from POST to PUT
router.get("/:id/tracking", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid orderId format",
      });
    }
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

// UPI payment callback route (no auth required for external callbacks)
router.post("/:orderId/payment-callback", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, transactionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update payment status for UPI payments
    if (status === 'SUCCESS') {
      await Order.findByIdAndUpdate(
        orderId,
        {
          paymentStatus: 'PAID',
          'paymentIntent.status': 'completed',
          'paymentIntent.updatedAt': new Date(),
        },
        { 
          context: { paymentStatusSource: "WEBHOOK_PAYMENT_CAPTURED" } 
        } as any
      );
    }

    res.json({ success: true, message: "Payment callback processed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to process payment callback" });
  }
});

// Payment intent routes
router.post("/:orderId/payment-intent", authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if order is already paid
    if (order.paymentStatus === 'PAID') {
      return res.status(400).json({ error: "Order is already paid" });
    }

    // Create or update payment intent
    const paymentIntent = {
      id: `pi_${Date.now()}`,
      status: 'pending' as const,
      amount: order.totalAmount,
      currency: 'INR',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await Order.findByIdAndUpdate(orderId, { paymentIntent });

    res.json({ paymentIntent });
  } catch (error) {
    res.status(500).json({ error: "Failed to create payment intent" });
  }
});

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
