"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../../middleware/auth");
const notificationController_1 = require("../controllers/notificationController");
const router = express_1.default.Router();
// All routes require authentication
router.use(auth_1.authenticateToken);
// Get all notifications for user (newest first)
router.get("/", notificationController_1.getNotifications);
// Get unread notification count
router.get("/unread/count", notificationController_1.getUnreadCount);
// Trigger multi-channel test notifications for the current user
router.post("/test-all-channels", notificationController_1.sendTestNotificationsAllChannels);
// Mark all as read
router.put("/read-all", notificationController_1.markAllAsRead);
// Mark single notification as read
router.put("/:notificationId/read", notificationController_1.markAsRead);
// Delete notification
router.delete("/:notificationId", notificationController_1.deleteNotification);
exports.default = router;
