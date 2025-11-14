import express from "express";
import { authenticateToken } from "../../../middleware/auth";
import {
  getUserProfile,
  updateUserProfile,
  getUserAddresses,
  addUserAddress,
  updateUserAddress,
  deleteUserAddress,
  setDefaultAddress,
  deleteAccount,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "../controllers/userController";

const router = express.Router();

// User profile routes
router.get("/profile", authenticateToken, getUserProfile);
router.put("/profile", authenticateToken, updateUserProfile);

// User address routes
router.get("/addresses", authenticateToken, getUserAddresses);
router.post("/addresses", authenticateToken, addUserAddress);
router.put("/addresses/:addressId", authenticateToken, updateUserAddress);
router.delete("/addresses/:addressId", authenticateToken, deleteUserAddress);
router.patch(
  "/addresses/:addressId/default",
  authenticateToken,
  setDefaultAddress
);

// Notification preferences routes
router.get("/notification-preferences", authenticateToken, getNotificationPreferences);
router.put("/notification-preferences", authenticateToken, updateNotificationPreferences);

// Account deletion route - CRITICAL: Requires authentication
router.delete("/delete-account", authenticateToken, deleteAccount);

export default router;
