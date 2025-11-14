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
router.get("/stats", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getStats);
router.get("/dashboard", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getStats);
router.get("/dashboard-stats", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getDashboardStats);
router.get("/profile", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminProfile);
router.get("/users", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getUsers);
router.put("/users/:id/make-delivery", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.makeDeliveryBoy);
router.get("/products", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminProducts);
router.put("/products/:id", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.updateProduct);
router.delete("/products/:id", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.deleteProduct);
router.get("/orders", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminOrders);
router.get("/delivery-boys", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.getAdminDeliveryBoys);
router.get("/orders/export", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), adminController_1.exportOrders);
router.get("/dev-token", (req, res) => {
    try {
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
        const adminToken = jsonwebtoken_1.default.sign({
            userId: "68e73b6feaa9ca840b481c77",
            email: "admin@cps.com",
            role: "admin",
        }, JWT_SECRET, { expiresIn: "24h" });
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
router.get("/admin", async (req, res) => {
    try {
        if (process.env.NODE_ENV === "production") {
            return res.status(403).json({
                error: "Admin-direct access is not available in production",
            });
        }
        const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
        const DEV_ADMIN_EMAIL = "gcs.charan@gmail.com";
        const User = require("../models/User").User;
        const devAdmin = await User.findOne({ email: DEV_ADMIN_EMAIL });
        if (!devAdmin) {
            return res.status(500).json({
                error: "Dev admin user not found. Please restart the server to bootstrap the admin user.",
            });
        }
        const adminToken = jsonwebtoken_1.default.sign({
            userId: devAdmin._id.toString(),
            email: devAdmin.email,
            role: devAdmin.role,
        }, JWT_SECRET, { expiresIn: "24h" });
        res.cookie("adminToken", adminToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 24 * 60 * 60 * 1000,
        });
        const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        return res.redirect(`${frontendUrl}/admin?token=${adminToken}`);
    }
    catch (error) {
        console.error("Error in admin route:", error);
        return res.status(500).json({ error: "Failed to access admin" });
    }
});
router.post("/dev-wipe-others", auth_1.authenticateToken, async (req, res) => {
    try {
        const DEV_ADMIN_EMAIL = "gcs.charan@gmail.com";
        const requesterIP = req.ip || req.connection.remoteAddress;
        const requesterUser = req.user;
        console.log(`🚨 WIPE ATTEMPT - IP: ${requesterIP}, User: ${requesterUser?.email}, Time: ${new Date().toISOString()}`);
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
        const User = require("../models/User").User;
        const totalUsersBefore = await User.countDocuments();
        const devAdminCount = await User.countDocuments({ email: DEV_ADMIN_EMAIL });
        if (devAdminCount === 0) {
            console.log("❌ WIPE BLOCKED - Dev admin user not found");
            return res.status(400).json({
                error: "Dev admin user not found. Cannot proceed with deletion.",
            });
        }
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
//# sourceMappingURL=admin.js.map