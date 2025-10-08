import express from "express";
import {
  getAvailableDrivers,
  assignDelivery,
  updateLocation,
  updateStatus,
  getMyOrders,
} from "../controllers/deliveryController";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = express.Router();

// Delivery routes
router.get("/available-drivers", getAvailableDrivers);
router.post(
  "/assign",
  authenticateToken,
  requireRole(["admin"]),
  assignDelivery
);
router.post(
  "/update-location",
  authenticateToken,
  requireRole(["delivery"]),
  updateLocation
);
router.post(
  "/update-status",
  authenticateToken,
  requireRole(["delivery"]),
  updateStatus
);
router.get(
  "/my-orders",
  authenticateToken,
  requireRole(["delivery"]),
  getMyOrders
);

export default router;
