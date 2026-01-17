import express from "express";
import {
  deliverySignup,
  deliveryLogin,
  getDeliveryProfile,
  updateDeliveryProfile,
  getSelfieUrl,
  updateSelfie,
  getDeliveryReferral,
  getDeliveryMessages,
} from "../controllers/deliveryAuthController";
import {
  getDeliveryBoyInfo,
  getDeliveryOrders,
  acceptOrder,
  rejectOrder,
  pickupOrder,
  startDelivery,
  markArrived,
  getCodCollection,
  createCodCollection,
  deliverAttempt,
  verifyDeliveryOtp,
  completeDelivery,
  failDelivery,
  recordDeliveryAttempt,
  getCurrentRoute,
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

// Referral + messages
router.get("/referral", authenticateToken, requireDeliveryRole, getDeliveryReferral);
router.get("/messages", authenticateToken, requireDeliveryRole, getDeliveryMessages);

// Delivery boy info
router.get("/info", authenticateToken, requireDeliveryRole, getDeliveryBoyInfo);

// Route consumption (read-only)
router.get("/routes/current", authenticateToken, requireDeliveryRole, getCurrentRoute);

// Order management
router.get("/orders", authenticateToken, requireDeliveryRole, getDeliveryOrders);
router.post("/orders/:orderId/accept", authenticateToken, requireDeliveryRole, acceptOrder);
router.post("/orders/:orderId/reject", authenticateToken, requireDeliveryRole, rejectOrder);
// New workflow endpoints (Amazon/Flipkart style)
router.post("/orders/:orderId/pickup", authenticateToken, requireDeliveryRole, pickupOrder);
router.post("/orders/:orderId/start-delivery", authenticateToken, requireDeliveryRole, startDelivery);
router.post("/orders/:orderId/arrived", authenticateToken, requireDeliveryRole, markArrived);
router.get("/orders/:orderId/cod-collection", authenticateToken, requireDeliveryRole, getCodCollection);
router.post("/orders/:orderId/cod-collection", authenticateToken, requireDeliveryRole, createCodCollection);
router.post("/orders/:orderId/deliver", authenticateToken, requireDeliveryRole, deliverAttempt);
router.post("/orders/:orderId/verify-otp", authenticateToken, requireDeliveryRole, verifyDeliveryOtp);
router.post("/orders/:orderId/complete", authenticateToken, requireDeliveryRole, completeDelivery);
router.post("/orders/:orderId/fail", authenticateToken, requireDeliveryRole, failDelivery);
router.post("/orders/:orderId/attempt", authenticateToken, requireDeliveryRole, recordDeliveryAttempt);

// Location and status
router.put("/location", authenticateToken, requireDeliveryRole, updateLocation);
router.put("/status", authenticateToken, requireDeliveryRole, toggleStatus);

// Earnings
router.get("/earnings", authenticateToken, requireDeliveryRole, getEarnings);

export default router;
