"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("../domains/operations/controllers/orderController");
const orderAssignmentController_1 = require("../controllers/orderAssignmentController");
const auth_1 = require("../middleware/auth");
const Order_1 = require("../models/Order");
const trackingKillSwitch_1 = require("../domains/tracking/services/trackingKillSwitch");
const trackingProjectionStore_1 = require("../domains/tracking/services/trackingProjectionStore");
const router = express_1.default.Router();
// Order routes
router.get("/", auth_1.authenticateToken, orderController_1.getOrders);
router.get("/:id", auth_1.authenticateToken, orderController_1.getOrderById);
router.post("/", auth_1.authenticateToken, orderController_1.createOrder);
router.post("/create", auth_1.authenticateToken, orderController_1.placeOrderCOD); // Add missing create route
router.post("/cod", auth_1.authenticateToken, orderController_1.placeOrderCOD);
router.put("/:id/cancel", auth_1.authenticateToken, orderController_1.cancelOrder); // Changed from POST to PUT
router.get("/:id/tracking", auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        // Find the order
        const order = await Order_1.Order.findOne({ _id: id, userId })
            .populate("deliveryBoyId", "name phone vehicleType currentLocation")
            .populate("items.productId", "name images");
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const mode = await (0, trackingKillSwitch_1.getTrackingKillSwitchMode)();
        if (mode !== "CUSTOMER_READ_ENABLED") {
            return res.json({ trackingState: "HIDDEN" });
        }
        const projection = await (0, trackingProjectionStore_1.getTrackingProjection)(String(order._id));
        if (!projection) {
            return res.json({
                trackingState: "OFFLINE",
                lastUpdatedAt: null,
                freshnessState: "OFFLINE",
            });
        }
        return res.json({
            trackingState: "AVAILABLE",
            lastUpdatedAt: projection.lastUpdatedAt,
            freshnessState: projection.freshnessState,
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to get tracking information" });
    }
});
router.get("/:orderId/payment-status", auth_1.authenticateToken, orderController_1.getPaymentStatus);
router.put("/:orderId/payment-status", auth_1.authenticateToken, orderController_1.updatePaymentStatus);
// Order assignment routes
router.post("/:orderId/assign", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), orderAssignmentController_1.assignDeliveryBoyToOrder);
router.delete("/:orderId/assign", auth_1.authenticateToken, orderAssignmentController_1.unassignDeliveryBoyFromOrder);
router.get("/:orderId/optimal-delivery-boy", auth_1.authenticateToken, orderAssignmentController_1.getOptimalDeliveryBoy);
exports.default = router;
