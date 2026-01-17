import express from "express";
import { authenticateToken } from "../../../middleware/auth";
import {
  getNotifications,
  getNotificationsV2,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
  sendTestNotificationsAllChannels,
} from "../controllers/notificationController";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Canonical cursor-paginated notifications endpoint
router.get("/v2", getNotificationsV2);

// Get all notifications for user (newest first)
router.get("/", getNotifications);

// Get unread notification count
router.get("/unread/count", getUnreadCount);

// Trigger multi-channel test notifications for the current user

// Mark all as read
router.put("/read-all", markAllAsRead);

// Mark single notification as read
router.put("/:notificationId/read", markAsRead);

// Delete notification
router.delete("/:notificationId", deleteNotification);

export default router;
