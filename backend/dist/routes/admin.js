"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminController_1 = require("../controllers/adminController");
const orderAssignmentController_1 = require("../controllers/orderAssignmentController");
const auth_1 = require("../middleware/auth");
const auditLog_1 = require("../middleware/auditLog");
const orderStateService_1 = require("../domains/orders/services/orderStateService");
const OrderStatus_1 = require("../domains/orders/enums/OrderStatus");
const deliveryOrderController_1 = require("../domains/operations/controllers/deliveryOrderController");
const router = express_1.default.Router();
// Admin routes
router.get("/stats", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.getStats);
router.get("/dashboard", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.getStats);
router.get("/analytics", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.getStats); // Using getStats as analytics
router.get("/dashboard", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getStats);
router.get("/analytics", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getStats); // Using getStats as analytics
router.get("/dashboard-stats", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getDashboardStats);
router.get("/profile", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminProfile);
router.get("/users", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getUsers);
router.delete("/users/:id", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, async (req, res) => {
    try {
        const User = require("../models/User").User;
        const { id } = req.params;
        // Find and delete the user
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ error: "User not found" });
        }
        res.json({
            message: "User deleted successfully",
            user: deletedUser
        });
    }
    catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: "Failed to delete user" });
    }
});
router.put("/users/:id/make-delivery", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.makeDeliveryBoy);
router.get("/products", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminProducts);
router.put("/products/:id", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.updateProduct);
router.delete("/products/:id", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.deleteProduct);
router.get("/orders", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminOrders);
router.get("/orders/:orderId/attempt", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, deliveryOrderController_1.getAdminOrderAttempt);
router.get("/orders/:orderId/cod-collection", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, deliveryOrderController_1.getAdminCodCollection);
// Note: Order status updates, accept/decline, and assignment are handled by other routes
// These routes are commented out as the functions don't exist in adminController
// router.patch("/orders/:orderId", authenticateToken, requireRole(["admin"]), updateOrderStatus);
// router.post("/orders/:orderId/accept", authenticateToken, requireRole(["admin"]), acceptOrder);
// router.post("/orders/:orderId/decline", authenticateToken, requireRole(["admin"]), declineOrder);
router.patch("/orders/:orderId/assign", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), orderAssignmentController_1.assignDeliveryBoyToOrder);
router.get("/delivery-boys", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminDeliveryBoys);
router.get("/delivery-boys-list", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminDeliveryBoys // Using getAdminDeliveryBoys instead of getDeliveryBoysList
);
router.put("/delivery-boys/:id/approve", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.approveDeliveryBoy);
// router.put("/delivery-boys/:id/suspend", authenticateToken, requireRole(["admin"]), suspendDeliveryBoy);
// router.post("/assign-deliveries", authenticateToken, requireRole(["admin"]), autoAssignDeliveries);
router.post("/orders/purge", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.purgeOrders);
router.get("/orders/export", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.exportOrders);
// CVRP Route Assignment
router.post("/routes/compute", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.computeRoutes);
router.post("/routes/assign", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.assignComputedCluster);
router.get("/routes", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.listRoutes);
router.get("/routes/recent", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.listRecentAssignedRoutes);
router.post("/routes/:routeId/assign", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.assignRoute);
router.get("/routes/:routeId/status", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.getRouteStatus);
router.get("/routes/:routeId/detail", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), auditLog_1.auditLog, adminController_1.getRouteDetail);
router.post("/orders/:id/confirm", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), async (req, res, next) => {
    try {
        const actorId = String(req.user?._id || "");
        const { id } = req.params;
        const order = await orderStateService_1.orderStateService.transition({
            orderId: id,
            toStatus: OrderStatus_1.OrderStatus.CONFIRMED,
            actorRole: "ADMIN",
            actorId,
        });
        res.json({ success: true, order });
    }
    catch (error) {
        next(error);
    }
});
router.post("/orders/:id/pack", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), async (req, res, next) => {
    try {
        const actorId = String(req.user?._id || "");
        const { id } = req.params;
        const order = await orderStateService_1.orderStateService.transition({
            orderId: id,
            toStatus: OrderStatus_1.OrderStatus.PACKED,
            actorRole: "ADMIN",
            actorId,
        });
        res.json({ success: true, order });
    }
    catch (error) {
        next(error);
    }
});
router.post("/orders/:id/return", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), async (req, res, next) => {
    try {
        const actorId = String(req.user?._id || "");
        const { id } = req.params;
        const { returnReason } = req.body || {};
        const order = await orderStateService_1.orderStateService.transition({
            orderId: id,
            toStatus: OrderStatus_1.OrderStatus.RETURNED,
            actorRole: "ADMIN",
            actorId,
            meta: {
                returnReason,
            },
        });
        res.json({ success: true, order });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
