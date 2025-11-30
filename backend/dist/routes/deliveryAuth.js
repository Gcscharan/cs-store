"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const deliveryAuthController_1 = require("../controllers/deliveryAuthController");
const deliveryOrderController_1 = require("../domains/operations/controllers/deliveryOrderController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Public delivery auth routes
router.post("/auth/signup", deliveryAuthController_1.deliverySignup);
router.post("/auth/login", deliveryAuthController_1.deliveryLogin);
// Protected delivery routes (require delivery role authentication)
router.get("/auth/profile", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryAuthController_1.getDeliveryProfile);
// Profile management routes (without /auth prefix for frontend compatibility)
router.get("/profile", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryAuthController_1.getDeliveryProfile);
router.put("/profile", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryAuthController_1.updateDeliveryProfile);
router.get("/selfie-url", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryAuthController_1.getSelfieUrl);
router.put("/update-selfie", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryAuthController_1.updateSelfie);
// Delivery boy info
router.get("/info", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.getDeliveryBoyInfo);
// Order management
router.get("/orders", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.getDeliveryOrders);
router.post("/orders/:orderId/accept", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.acceptOrder);
router.post("/orders/:orderId/reject", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.rejectOrder);
// New workflow endpoints (Amazon/Flipkart style)
router.post("/orders/:orderId/pickup", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.pickupOrder);
router.post("/orders/:orderId/start-delivery", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.startDelivery);
router.post("/orders/:orderId/arrived", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.markArrived);
router.post("/orders/:orderId/complete", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.completeDelivery);
// Location and status
router.put("/location", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.updateLocation);
router.put("/status", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.toggleStatus);
// Earnings
router.get("/earnings", auth_1.authenticateToken, auth_1.requireDeliveryRole, deliveryOrderController_1.getEarnings);
exports.default = router;
