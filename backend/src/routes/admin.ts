import express from "express";
import {
  getStats,
  exportOrders,
  getAdminProfile,
  getUsers,
  getAdminProducts,
  getAdminOrders,
  getAdminDeliveryBoys,
  getDashboardStats,
  updateProduct,
  deleteProduct,
  makeDeliveryBoy,
} from "../controllers/adminController";
import { authenticateToken, requireRole } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";
import jwt from "jsonwebtoken";
import { orderStateService } from "../domains/orders/services/orderStateService";
import { OrderStatus } from "../domains/orders/enums/OrderStatus";

const router = express.Router();

// Admin routes
router.get("/stats", authenticateToken, requireRole(["admin"]), auditLog, getStats);
router.get("/dashboard", authenticateToken, requireRole(["admin"]), auditLog, getStats);
router.get("/analytics", authenticateToken, requireRole(["admin"]), auditLog, getStats); // Using getStats as analytics
router.get("/dashboard", authenticateToken, requireRole(["admin"]), getStats);
router.get("/analytics", authenticateToken, requireRole(["admin"]), getStats); // Using getStats as analytics
router.get(
  "/dashboard-stats",
  authenticateToken,
  requireRole(["admin"]),
  getDashboardStats
);
router.get(
  "/profile",
  authenticateToken,
  requireRole(["admin"]),
  getAdminProfile
);
router.get("/users", authenticateToken, requireRole(["admin"]), getUsers);
router.delete("/users/:id", authenticateToken, requireRole(["admin"]), auditLog, async (req, res) => {
  try {
    const User = require("../models/User").User;
    const { id } = req.params;

    // Find and delete the user
    const deletedUser = await User.findByIdAndDelete(id);

    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "User deleted successfully",
      user: deletedUser
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});
router.put(
  "/users/:id/make-delivery",
  authenticateToken,
  requireRole(["admin"]),
  makeDeliveryBoy
);
router.get(
  "/products",
  authenticateToken,
  requireRole(["admin"]),
  getAdminProducts
);
router.put(
  "/products/:id",
  authenticateToken,
  requireRole(["admin"]),
  updateProduct
);
router.delete(
  "/products/:id",
  authenticateToken,
  requireRole(["admin"]),
  deleteProduct
);
router.get(
  "/orders",
  authenticateToken,
  requireRole(["admin"]),
  getAdminOrders
);
// Note: Order status updates, accept/decline, and assignment are handled by other routes
// These routes are commented out as the functions don't exist in adminController
// router.patch("/orders/:orderId", authenticateToken, requireRole(["admin"]), updateOrderStatus);
// router.post("/orders/:orderId/accept", authenticateToken, requireRole(["admin"]), acceptOrder);
// router.post("/orders/:orderId/decline", authenticateToken, requireRole(["admin"]), declineOrder);
// router.patch("/orders/:orderId/assign", authenticateToken, requireRole(["admin"]), manualAssignOrder);
router.get(
  "/delivery-boys",
  authenticateToken,
  requireRole(["admin"]),
  getAdminDeliveryBoys
);
router.get(
  "/delivery-boys-list",
  authenticateToken,
  requireRole(["admin"]),
  getAdminDeliveryBoys // Using getAdminDeliveryBoys instead of getDeliveryBoysList
);
// Note: Delivery boy approval, suspension, and auto-assignment functions don't exist in adminController
// router.put("/delivery-boys/:id/approve", authenticateToken, requireRole(["admin"]), approveDeliveryBoy);
// router.put("/delivery-boys/:id/suspend", authenticateToken, requireRole(["admin"]), suspendDeliveryBoy);
// router.post("/assign-deliveries", authenticateToken, requireRole(["admin"]), autoAssignDeliveries);
router.get(
  "/orders/export",
  authenticateToken,
  requireRole(["admin"]),
  exportOrders
);

router.post(
  "/orders/:id/confirm",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res, next) => {
    try {
      const actorId = String((req as any).user?._id || "");
      const { id } = req.params;
      const order = await orderStateService.transition({
        orderId: id,
        toStatus: OrderStatus.CONFIRMED,
        actorRole: "ADMIN",
        actorId,
      });
      res.json({ success: true, order });
    } catch (error) {
      next(error as any);
    }
  }
);

router.post(
  "/orders/:id/pack",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res, next) => {
    try {
      const actorId = String((req as any).user?._id || "");
      const { id } = req.params;
      const order = await orderStateService.transition({
        orderId: id,
        toStatus: OrderStatus.PACKED,
        actorRole: "ADMIN",
        actorId,
      });
      res.json({ success: true, order });
    } catch (error) {
      next(error as any);
    }
  }
);

router.post(
  "/orders/:id/return",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res, next) => {
    try {
      const actorId = String((req as any).user?._id || "");
      const { id } = req.params;
      const { returnReason } = (req as any).body || {};
      const order = await orderStateService.transition({
        orderId: id,
        toStatus: OrderStatus.RETURNED,
        actorRole: "ADMIN",
        actorId,
        meta: {
          returnReason,
        },
      });
      res.json({ success: true, order });
    } catch (error) {
      next(error as any);
    }
  }
);


export default router;

