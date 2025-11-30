"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middleware/auth");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
// Admin routes
router.get("/stats", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getStats);
router.get("/dashboard", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getStats);
router.get("/analytics", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getStats); // Using getStats as analytics
router.get("/dashboard-stats", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getDashboardStats);
router.get("/profile", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminProfile);
router.get("/users", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getUsers);
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
// Development endpoint to get admin token for direct access
router.get("/dev-token", (req, res) => {
    try {
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
        // Create a token for the admin user (using the existing admin user ID)
        const adminToken = jsonwebtoken_1.default.sign({
            userId: "68e73b6feaa9ca840b481c77", // Admin user ID
            email: "admin@cps.com",
            role: "admin",
        }, JWT_SECRET, { expiresIn: "24h" } // Longer expiry for development
        );
        res.json({
            token: adminToken,
            user: {
                id: "68e73b6feaa9ca840b481c77",
                name: "Admin User",
                email: "admin@cps.com",
                role: "admin",
                isAdmin: true,
            },
        });
    }
    catch (error) {
        console.error("Error generating dev token:", error);
        res.status(500).json({ error: "Failed to generate admin token" });
    }
});
// Dev-only admin route
router.get("/admin", async (req, res) => {
    try {
        // Only allow in development
        if (process.env.NODE_ENV === "production") {
            return res.status(403).json({
                error: "Admin-direct access is not available in production",
            });
        }
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
        const DEV_ADMIN_EMAIL = "gcs.charan@gmail.com";
        // Find the dev admin user
        const User = require("../models/User").User;
        const devAdmin = await User.findOne({ email: DEV_ADMIN_EMAIL });
        if (!devAdmin) {
            return res.status(500).json({
                error: "Dev admin user not found. Please restart the server to bootstrap the admin user.",
            });
        }
        // Create a token for the dev admin user
        const adminToken = jsonwebtoken_1.default.sign({
            userId: devAdmin._id.toString(),
            email: devAdmin.email,
            role: devAdmin.role,
        }, JWT_SECRET, { expiresIn: "24h" });
        // Set the token as a cookie and redirect to frontend admin page
        res.cookie("adminToken", adminToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });
        // Redirect to frontend admin page
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return res.redirect(`${frontendUrl}/admin?token=${adminToken}`);
    }
    catch (error) {
        console.error("Error in admin route:", error);
        return res.status(500).json({ error: "Failed to access admin" });
    }
});
// Dev-only destructive user deletion endpoint
router.post("/dev-wipe-others", auth_1.authenticateToken, async (req, res) => {
    try {
        const DEV_ADMIN_EMAIL = "gcs.charan@gmail.com";
        const requesterIP = req.ip || req.connection.remoteAddress;
        const requesterUser = req.user; // Type assertion for req.user
        // Log the attempt
        console.log(`🚨 WIPE ATTEMPT - IP: ${requesterIP}, User: ${requesterUser?.email}, Time: ${new Date().toISOString()}`);
        // Pre-conditions check
        if (process.env.NODE_ENV === "production") {
            console.log("❌ WIPE BLOCKED - Production environment");
            return res.status(403).json({
                error: "User deletion is not allowed in production environment",
            });
        }
        if (process.env.CONFIRM_WIPE !== "true") {
            console.log("❌ WIPE BLOCKED - CONFIRM_WIPE not set");
            return res.status(400).json({
                error: "CONFIRM_WIPE environment variable must be set to 'true' to execute this operation",
            });
        }
        if (!requesterUser || requesterUser.email !== DEV_ADMIN_EMAIL) {
            console.log("❌ WIPE BLOCKED - Unauthorized user");
            return res.status(403).json({
                error: "Only the dev admin user can execute this operation",
            });
        }
        // Get User model
        const User = require("../models/User").User;
        // Count users before deletion
        const totalUsersBefore = await User.countDocuments();
        const devAdminCount = await User.countDocuments({ email: DEV_ADMIN_EMAIL });
        if (devAdminCount === 0) {
            console.log("❌ WIPE BLOCKED - Dev admin user not found");
            return res.status(400).json({
                error: "Dev admin user not found. Cannot proceed with deletion.",
            });
        }
        // Perform the deletion
        console.log("⚠️  EXECUTING USER DELETION - This is a destructive operation!");
        console.log(`📊 Users before deletion: ${totalUsersBefore}`);
        console.log(`👤 Dev admin users: ${devAdminCount}`);
        const deleteResult = await User.deleteMany({
            email: { $ne: DEV_ADMIN_EMAIL },
        });
        const deletedCount = deleteResult.deletedCount;
        const remainingUsers = await User.countDocuments();
        console.log(`🗑️  DELETION COMPLETED - Deleted: ${deletedCount} users`);
        console.log(`👥 Remaining users: ${remainingUsers}`);
        // Log the completion
        console.log(`✅ WIPE COMPLETED - IP: ${requesterIP}, User: ${requesterUser?.email}, Deleted: ${deletedCount}, Time: ${new Date().toISOString()}`);
        return res.json({
            success: true,
            deletedCount: deletedCount,
            remainingUsers: remainingUsers,
            timestamp: new Date().toISOString(),
            message: `Successfully deleted ${deletedCount} users. ${remainingUsers} users remain.`,
        });
    }
    catch (error) {
        console.error("❌ Error in dev-wipe-others:", error);
        return res.status(500).json({
            error: "Failed to execute user deletion",
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});
exports.default = router;
