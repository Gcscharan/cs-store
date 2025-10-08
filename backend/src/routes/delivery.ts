import express from "express";
import {
  getAllDeliveryBoys,
  getDeliveryBoyById,
  createDeliveryBoy,
  updateDeliveryBoy,
  deleteDeliveryBoy,
  getAvailableDeliveryBoys,
  assignOrder,
  autoAssignOrder,
  updateLocation,
  updateOrderStatus,
  getMyOrders,
  getEarnings,
} from "../controllers/deliveryController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Admin routes (require admin role)
router.get("/", authenticateToken, getAllDeliveryBoys);
router.get("/available", getAvailableDeliveryBoys);
router.get("/:id", authenticateToken, getDeliveryBoyById);
router.post("/", authenticateToken, createDeliveryBoy);
router.put("/:id", authenticateToken, updateDeliveryBoy);
router.delete("/:id", authenticateToken, deleteDeliveryBoy);

// Assignment routes
router.post("/assign", authenticateToken, assignOrder);
router.post("/auto-assign", authenticateToken, autoAssignOrder);

// Delivery boy routes (require delivery role)
router.post("/update-location", authenticateToken, updateLocation);
router.post("/update-status", authenticateToken, updateOrderStatus);
router.get("/my-orders", authenticateToken, getMyOrders);
router.get("/earnings", authenticateToken, getEarnings);

export default router;
