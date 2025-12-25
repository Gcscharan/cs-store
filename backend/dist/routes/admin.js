"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middleware/auth");
const auditLog_1 = require("../middleware/auditLog");
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
// Note: Order status updates, accept/decline, and assignment are handled by other routes
// These routes are commented out as the functions don't exist in adminController
// router.patch("/orders/:orderId", authenticateToken, requireRole(["admin"]), updateOrderStatus);
// router.post("/orders/:orderId/accept", authenticateToken, requireRole(["admin"]), acceptOrder);
// router.post("/orders/:orderId/decline", authenticateToken, requireRole(["admin"]), declineOrder);
// router.patch("/orders/:orderId/assign", authenticateToken, requireRole(["admin"]), manualAssignOrder);
router.get("/delivery-boys", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminDeliveryBoys);
router.get("/delivery-boys-list", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminDeliveryBoys // Using getAdminDeliveryBoys instead of getDeliveryBoysList
);
// Note: Delivery boy approval, suspension, and auto-assignment functions don't exist in adminController
// router.put("/delivery-boys/:id/approve", authenticateToken, requireRole(["admin"]), approveDeliveryBoy);
// router.put("/delivery-boys/:id/suspend", authenticateToken, requireRole(["admin"]), suspendDeliveryBoy);
// router.post("/assign-deliveries", authenticateToken, requireRole(["admin"]), autoAssignDeliveries);
router.get("/orders/export", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.exportOrders);
exports.default = router;
