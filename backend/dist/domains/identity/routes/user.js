"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../../../middleware/auth");
const userController_1 = require("../controllers/userController");
const router = express_1.default.Router();
// User profile routes
router.get("/profile", auth_1.authenticateToken, userController_1.getUserProfile);
router.put("/profile", auth_1.authenticateToken, userController_1.updateUserProfile);
// Mobile verification route
router.post("/verify-mobile", userController_1.markMobileAsVerified);
// User address routes
router.get("/addresses", auth_1.authenticateToken, userController_1.getUserAddresses);
router.post("/addresses", auth_1.authenticateToken, userController_1.addUserAddress);
router.put("/addresses/:addressId", auth_1.authenticateToken, userController_1.updateUserAddress);
router.delete("/addresses/:addressId", auth_1.authenticateToken, userController_1.deleteUserAddress);
router.patch("/addresses/:addressId/default", auth_1.authenticateToken, userController_1.setDefaultAddress);
// Notification preferences routes
router.get("/notification-preferences", auth_1.authenticateToken, userController_1.getNotificationPreferences);
router.put("/notification-preferences", auth_1.authenticateToken, userController_1.updateNotificationPreferences);
// Account deletion route - CRITICAL: Requires authentication
router.delete("/delete-account", auth_1.authenticateToken, userController_1.deleteAccount);
exports.default = router;
