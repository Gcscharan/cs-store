import express from "express";
import {
  deliverySignup,
  deliveryLogin,
  getDeliveryProfile,
  updateDeliveryProfile,
  getSelfieUrl,
  updateSelfie,
} from "../controllers/deliveryAuthController";
import {
  getDeliveryBoyInfo,
  getDeliveryOrders,
  acceptOrder,
  rejectOrder,
  pickupOrder,
  startDelivery,
  markArrived,
  completeDelivery,
  updateLocation,
  toggleStatus,
  getEarnings,
} from "../domains/operations/controllers/deliveryOrderController";
import { authenticateToken, requireDeliveryRole } from "../middleware/auth";

const router = express.Router();

// Public delivery auth routes
router.post("/auth/signup", deliverySignup);
router.post("/auth/login", deliveryLogin);

// Protected delivery routes (require delivery role authentication)
router.get("/auth/profile", authenticateToken, requireDeliveryRole, getDeliveryProfile);

// Profile management routes (without /auth prefix for frontend compatibility)
router.get("/profile", authenticateToken, requireDeliveryRole, getDeliveryProfile);
router.put("/profile", authenticateToken, requireDeliveryRole, updateDeliveryProfile);
router.get("/selfie-url", authenticateToken, requireDeliveryRole, getSelfieUrl);
router.put("/update-selfie", authenticateToken, requireDeliveryRole, updateSelfie);

// Delivery boy info
router.get("/info", authenticateToken, requireDeliveryRole, getDeliveryBoyInfo);

// Order management
router.get("/orders", authenticateToken, requireDeliveryRole, getDeliveryOrders);
router.post("/orders/:orderId/accept", authenticateToken, requireDeliveryRole, acceptOrder);
router.post("/orders/:orderId/reject", authenticateToken, requireDeliveryRole, rejectOrder);
// New workflow endpoints (Amazon/Flipkart style)
router.post("/orders/:orderId/pickup", authenticateToken, requireDeliveryRole, pickupOrder);
router.post("/orders/:orderId/start-delivery", authenticateToken, requireDeliveryRole, startDelivery);
router.post("/orders/:orderId/arrived", authenticateToken, requireDeliveryRole, markArrived);
router.post("/orders/:orderId/complete", authenticateToken, requireDeliveryRole, completeDelivery);

// Location and status
router.put("/location", authenticateToken, requireDeliveryRole, updateLocation);
router.put("/status", authenticateToken, requireDeliveryRole, toggleStatus);

// Earnings
router.get("/earnings", authenticateToken, requireDeliveryRole, getEarnings);

export default router;
