"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/env");
// Load environment variables FIRST before any other imports
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const ENV_PATH = path_1.default.resolve(__dirname, "..", ".env");
dotenv_1.default.config({ path: ENV_PATH });
console.log("[CACHE] Product read cache enabled");
if (!process.env.MONGODB_URI) {
    throw new Error("❌ MONGODB_URI is missing. Backend refusing to start.");
}
const NODE_ENV = process.env.NODE_ENV || "development";
const DEV_LOW_POWER = String(process.env.DEV_LOW_POWER || "").toLowerCase() === "true";
const verboseLoggingEnabled = NODE_ENV === "production" ? true : !DEV_LOW_POWER;
// Comprehensive Environment Variable Validation
function validateEnvironmentVariables() {
    const errors = [];
    // Database
    if (!process.env.MONGODB_URI) {
        errors.push("❌ MONGODB_URI is required");
    }
    // JWT Secrets
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        errors.push(`❌ JWT_SECRET must be at least 32 characters long. Current length: ${process.env.JWT_SECRET.length}`);
    }
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
        errors.push(`❌ JWT_REFRESH_SECRET must be at least 32 characters long. Current length: ${process.env.JWT_REFRESH_SECRET.length}`);
    }
    // Cloudinary
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        errors.push("❌ CLOUDINARY_CLOUD_NAME is required");
    }
    if (!process.env.CLOUDINARY_API_KEY) {
        errors.push("❌ CLOUDINARY_API_KEY is required");
    }
    if (!process.env.CLOUDINARY_API_SECRET) {
        errors.push("❌ CLOUDINARY_API_SECRET is required");
    }
    // Redis
    if (!process.env.REDIS_URL) {
        if (NODE_ENV === "production") {
            errors.push("⚠️  REDIS_URL is recommended in production");
        }
        else {
            errors.push("⚠️  REDIS_URL is recommended");
        }
    }
    // Frontend
    if (!process.env.FRONTEND_URL) {
        if (NODE_ENV === "production") {
            errors.push("❌ FRONTEND_URL is required in production");
        }
        else {
            errors.push("⚠️  FRONTEND_URL is recommended");
        }
    }
    // Razorpay
    if (!process.env.RAZORPAY_KEY_ID) {
        errors.push(NODE_ENV === "production" ? "❌ RAZORPAY_KEY_ID is required" : "⚠️  RAZORPAY_KEY_ID is recommended");
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
        errors.push(NODE_ENV === "production" ? "❌ RAZORPAY_KEY_SECRET is required" : "⚠️  RAZORPAY_KEY_SECRET is recommended");
    }
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
        errors.push(NODE_ENV === "production" ? "❌ RAZORPAY_WEBHOOK_SECRET is required" : "⚠️  RAZORPAY_WEBHOOK_SECRET is recommended");
    }
    // Google OAuth
    if (!process.env.GOOGLE_CLIENT_ID) {
        errors.push("⚠️  GOOGLE_CLIENT_ID is recommended for OAuth login");
    }
    if (!process.env.GOOGLE_CLIENT_SECRET) {
        errors.push("⚠️  GOOGLE_CLIENT_SECRET is recommended for OAuth login");
    }
    // Critical errors that prevent startup
    const criticalErrors = errors.filter(err => err.startsWith("❌"));
    const warnings = errors.filter(err => err.startsWith("⚠️"));
    if (criticalErrors.length > 0) {
        console.error("\n🚨 CRITICAL ENVIRONMENT ERRORS:");
        criticalErrors.forEach(err => console.error(err));
        console.error("\n❌ Server cannot start due to critical configuration errors.");
        console.error("❌ Please check your .env file and restart the server.\n");
        process.exit(1);
    }
    if (warnings.length > 0) {
        console.warn("\n⚠️  Environment warnings:");
        warnings.forEach(warn => console.warn(warn));
        console.warn("⚠️  Consider adding these variables for full functionality.\n");
    }
    if (verboseLoggingEnabled) {
        console.log("✅ Environment variables validated successfully");
    }
}
// Run validation immediately after dotenv config
validateEnvironmentVariables();
// Runtime proof (dev only): log DB name derived from MONGODB_URI
if (NODE_ENV !== "production") {
    try {
        const dbPathname = new URL(String(process.env.MONGODB_URI)).pathname;
        console.log("[BOOT] Connected DB:", dbPathname);
    }
    catch {
        console.log("[BOOT] Connected DB:", "<unparseable>");
    }
}
// Validate critical environment variables immediately
if (verboseLoggingEnabled) {
    console.log("\n========================================");
    console.log("🔧 Environment Variables Check");
    console.log("========================================");
    console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || "development"}`);
    console.log(`🚪 PORT: ${process.env.PORT || "5001"}`);
    console.log(`🔗 MONGODB_URI present: ${process.env.MONGODB_URI ? "✅ Yes" : "❌ NO"}`);
    console.log(`🔑 JWT_SECRET present: ${process.env.JWT_SECRET ? "✅ Yes" : "❌ NO"}`);
    console.log(`🔑 JWT_REFRESH_SECRET present: ${process.env.JWT_REFRESH_SECRET ? "✅ Yes" : "❌ NO"}`);
    console.log(`☁️ CLOUDINARY_CLOUD_NAME present: ${process.env.CLOUDINARY_CLOUD_NAME ? "✅ Yes" : "❌ NO"}`);
    console.log(`📧 MOCK_OTP: ${process.env.MOCK_OTP || "false"}`);
    console.log("[ENV][SMS] FAST2SMS key loaded:", !!process.env.FAST2SMS_API_KEY);
}
// Check FAST2SMS API key validity
if (process.env.FAST2SMS_API_KEY && process.env.FAST2SMS_API_KEY.length < 20) {
    console.warn("[SMS][WARN] FAST2SMS_API_KEY appears invalid.");
}
if (verboseLoggingEnabled) {
    console.log("========================================\n");
}
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const database_1 = require("./utils/database");
const bootstrapDevAdmin_1 = require("./scripts/bootstrapDevAdmin");
// import SocketService from "./services/socketService";
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const liveLocationStore_1 = require("./services/liveLocationStore");
const User_1 = require("./models/User");
const deliveryPartnerLoadService_1 = require("./domains/operations/services/deliveryPartnerLoadService");
const orderEventBroadcaster_1 = require("./domains/orders/services/orderEventBroadcaster");
const notificationWriter_1 = require("./domains/communication/services/notificationWriter");
const outboxDispatcher_1 = require("./domains/events/outboxDispatcher");
const inventoryReservationSweeper_1 = require("./domains/orders/services/inventoryReservationSweeper");
const stuckPaymentScanner_1 = require("./domains/payments/services/stuckPaymentScanner");
// Create HTTP server
const server = (0, http_1.createServer)(app_1.default);
// Initialize Socket.io
const socketCorsOriginFromEnv = String(process.env.CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
const socketCorsOrigins = [
    ...(NODE_ENV === "production" ? [] : ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"]),
    process.env.FRONTEND_URL || "",
    ...socketCorsOriginFromEnv,
].filter(Boolean);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: socketCorsOrigins,
        methods: ["GET", "POST"],
        credentials: true,
    },
});
io.use(async (socket, next) => {
    try {
        const provided = (typeof socket.handshake?.auth?.token === "string" && String(socket.handshake.auth.token).trim()) ||
            (typeof socket.handshake.headers?.authorization === "string" && String(socket.handshake.headers.authorization).replace(/^Bearer\s+/i, "").trim()) ||
            "";
        if (!provided) {
            return next();
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return next();
        }
        const decoded = jsonwebtoken_1.default.verify(provided, jwtSecret);
        const userId = String(decoded?.userId || "");
        if (!userId) {
            return next();
        }
        const u = await User_1.User.findById(userId).select("_id role").lean();
        if (!u) {
            return next();
        }
        socket.data.userId = userId;
        socket.data.role = String(u.role || "");
        return next();
    }
    catch (e) {
        console.warn("[Socket] auth middleware failed", e);
        return next();
    }
});
// Initialize Socket Service for OTP (disabled for now)
// const socketService = new SocketService(server);
// Initialize OrderEventBroadcaster for real-time order status updates
const orderEventBroadcaster = new orderEventBroadcaster_1.OrderEventBroadcaster(io);
// Store socket.io instance in app for webhook access
app_1.default.set("io", io);
app_1.default.set("orderEventBroadcaster", orderEventBroadcaster);
// app.set("socketService", socketService);
// Fan-out for accepted HTTP location updates (Phase 1B)
liveLocationStore_1.liveLocationEvents.on("location", (loc) => {
    try {
        const driverId = String(loc?.driverId || "");
        if (!driverId)
            return;
        const payload = {
            driverId,
            routeId: String(loc?.routeId || ""),
            lat: Number(loc?.lat),
            lng: Number(loc?.lng),
            lastUpdatedAt: new Date(Number(loc?.receivedAt || Date.now())).toISOString(),
        };
        io.to("admin_room").emit("driver:location:update", payload);
    }
    catch (e) {
        console.error("[LiveLocation][socket] fan-out error:", e);
    }
});
// Socket.io connection handling
io.on("connection", (socket) => {
    if (verboseLoggingEnabled) {
        console.log("Client connected:", socket.id);
    }
    try {
        const userId = String(socket.data?.userId || "");
        if (userId) {
            socket.join(`user_${userId}`);
        }
    }
    catch (e) {
        console.warn("[Socket] personal room join failed", e);
    }
    // Join rooms based on user role
    socket.on("join_room", (data) => {
        const { room, userId, userRole, token } = data || {};
        const roomStr = String(room || "");
        // Admin-only: joining admin_room requires a valid admin JWT.
        if (roomStr === "admin_room") {
            try {
                const provided = (typeof token === "string" && token.trim()) ||
                    (typeof socket.handshake?.auth?.token === "string" && String(socket.handshake.auth.token).trim()) ||
                    (typeof socket.handshake.headers?.authorization === "string" && String(socket.handshake.headers.authorization).replace(/^Bearer\s+/i, "").trim()) ||
                    "";
                if (!provided) {
                    console.warn("[Socket] Admin join denied: missing token", { socketId: socket.id });
                    return;
                }
                const jwtSecret = process.env.JWT_SECRET;
                if (!jwtSecret) {
                    console.warn("[Socket] Admin join denied: server misconfigured", { socketId: socket.id });
                    return;
                }
                const decoded = jsonwebtoken_1.default.verify(provided, jwtSecret);
                const adminId = String(decoded?.userId || "");
                if (!adminId) {
                    console.warn("[Socket] Admin join denied: invalid token payload", { socketId: socket.id });
                    return;
                }
                // Role check must be server authoritative.
                User_1.User.findById(adminId)
                    .select("role")
                    .then((u) => {
                    if (!u || String(u.role) !== "admin") {
                        console.warn("[Socket] Admin join denied: role mismatch", { socketId: socket.id, adminId });
                        return;
                    }
                    socket.join("admin_room");
                    if (verboseLoggingEnabled) {
                        console.log(`✅ Admin ${adminId} joined admin_room`);
                    }
                })
                    .catch((e) => {
                    console.warn("[Socket] Admin join denied: user lookup failed", e);
                });
            }
            catch (e) {
                console.warn("[Socket] Admin join denied: token verify failed", e);
            }
            return;
        }
        // Security hard rule: only admin_room is joinable.
        console.warn("[Socket] join_room denied: only admin_room is allowed", {
            socketId: socket.id,
            room: roomStr,
            userId,
            userRole,
        });
        return;
    });
    // Handle order status updates
    socket.on("order_status_update", (data) => {
        const { orderId, status } = data;
        io.to("admin_room").emit("order:status:update", { orderId, status });
    });
    // Handle order creation events
    socket.on("order_created", (data) => {
        const { orderId } = data;
        io.to("admin_room").emit("order:created", { orderId });
    });
    // Handle driver status updates
    socket.on("driver_status_update", (data) => {
        const { driverId, status, availability } = data;
        io.to("admin_room").emit("driver:status:update", {
            driverId,
            status,
            availability,
        });
    });
    socket.on("disconnect", () => {
        if (verboseLoggingEnabled) {
            console.log("Client disconnected:", socket.id);
        }
    });
});
// Start server
const PORT = process.env.PORT || 5001;
// Function to gracefully close existing server instances on a port (development only)
const closeExistingServer = async (port) => {
    if (NODE_ENV === "production") {
        return;
    }
    return;
};
const startServer = async () => {
    try {
        await (0, database_1.connectDB)();
        // Start in-memory live location store timers (flush + TTL cleanup)
        liveLocationStore_1.liveLocationStore.start();
        (0, notificationWriter_1.initializeNotificationWriter)();
        (0, outboxDispatcher_1.initializeOutboxDispatcher)();
        (0, inventoryReservationSweeper_1.initializeInventoryReservationSweeper)();
        (0, stuckPaymentScanner_1.startStuckPaymentScanner)();
        // Bootstrap dev admin user in development
        await (0, bootstrapDevAdmin_1.bootstrapDevAdmin)();
        // Initialize Redis ZSET for delivery partner load tracking
        console.log("🚚 Initializing delivery partner load tracking...");
        await deliveryPartnerLoadService_1.deliveryPartnerLoadService.initializeLoads();
        // Start OrderEventBroadcaster polling for real-time sync
        console.log("📡 Starting OrderEventBroadcaster polling...");
        orderEventBroadcaster.startPolling(5000); // Poll every 5 seconds
        // Function to try starting server on a specific port
        const tryStartServer = (port) => {
            return new Promise((resolve, reject) => {
                // Check if server is already listening
                if (server.listening) {
                    console.log(`✅ Server already running on port ${port}`);
                    resolve();
                    return;
                }
                const serverInstance = server.listen(port, () => {
                    console.log(`🚀 Server running on port ${port}`);
                    console.log(`🏥 Health check: /health`);
                    resolve();
                });
                serverInstance.on("error", (err) => {
                    if (err.code === "EADDRINUSE") {
                        console.log(`⚠️  Port ${port} in use, trying next available port...`);
                        reject(err);
                    }
                    else {
                        reject(err);
                    }
                });
            });
        };
        // In production (Railway), bind ONLY to process.env.PORT (no port hopping / no lsof/kill)
        if (NODE_ENV === "production") {
            const port = Number(PORT);
            await tryStartServer(port);
            return;
        }
        // In development, try to start server on the specified port, then try next ports if needed
        let currentPort = parseInt(PORT.toString());
        const maxAttempts = 5; // Reduced attempts to prevent too many servers
        let attempts = 0;
        while (attempts < maxAttempts) {
            try {
                // First try to close any existing server on this port
                if (attempts === 0) {
                    await closeExistingServer(currentPort);
                }
                await tryStartServer(currentPort);
                break; // Success, exit the loop
            }
            catch (error) {
                if (error.code === "EADDRINUSE") {
                    currentPort++;
                    attempts++;
                    if (attempts >= maxAttempts) {
                        console.error(`❌ Failed to find available port after ${maxAttempts} attempts`);
                        process.exit(1);
                    }
                }
                else {
                    throw error; // Re-throw non-port-related errors
                }
            }
        }
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};
// Graceful shutdown handling
process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    server.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    server.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
// Prevent multiple servers
if (process.env.NODE_ENV !== "production") {
    process.on("uncaughtException", (error) => {
        console.error("Uncaught Exception:", error);
        process.exit(1);
    });
    process.on("unhandledRejection", (reason, promise) => {
        console.error("Unhandled Rejection at:", promise, "reason:", reason);
        process.exit(1);
    });
}
startServer();
