"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const passport_1 = __importDefault(require("passport"));
// JWT Secret Validation moved to index.ts after dotenv.config()
const compression_1 = __importDefault(require("compression"));
const security_1 = require("./middleware/security");
const errorHandler_1 = require("./middleware/errorHandler");
require("./config/oauth"); // Initialize OAuth strategies
const auth_1 = __importDefault(require("./domains/identity/routes/auth"));
const products_1 = __importDefault(require("./domains/catalog/routes/products"));
const cart_1 = __importDefault(require("./routes/cart"));
const orders_1 = __importDefault(require("./routes/orders"));
const deliveryFee_1 = __importDefault(require("./routes/deliveryFee"));
const enhancedDeliveryFeeRoutes_1 = __importDefault(require("./routes/enhancedDeliveryFeeRoutes"));
const deliveryPersonnel_1 = __importDefault(require("./routes/deliveryPersonnel"));
const deliveryAuth_1 = __importDefault(require("./routes/deliveryAuth"));
const pincode_1 = __importDefault(require("./routes/pincode"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const admin_1 = __importDefault(require("./routes/admin"));
const adminOps_1 = __importDefault(require("./routes/adminOps"));
const adminTracking_1 = __importDefault(require("./routes/adminTracking"));
const internalTracking_1 = __importDefault(require("./routes/internalTracking"));
const user_1 = __importDefault(require("./domains/identity/routes/user"));
const otpRoutes_1 = __importDefault(require("./domains/security/routes/otpRoutes"));
const mobileVerifyRoutes_1 = __importDefault(require("./domains/security/routes/mobileVerifyRoutes"));
const notifications_1 = __importDefault(require("./domains/communication/routes/notifications"));
const devNotifications_1 = __importDefault(require("./domains/communication/routes/devNotifications"));
const uploads_1 = __importDefault(require("./domains/uploads/routes/uploads"));
const paymentIntents_routes_1 = __importDefault(require("./domains/payments/routes/paymentIntents.routes"));
const webhooks_routes_1 = __importDefault(require("./domains/payments/routes/webhooks.routes"));
console.log("App.ts loaded successfully");
const app = (0, express_1.default)();
// Middleware
const allowedCorsOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://cs-store-frontend-p9sszldr6-randoms-projects-e13b50d6.vercel.app",
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. server-to-server, Postman)
        if (!origin)
            return callback(null, true);
        if (allowedCorsOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
}));
app.use((0, compression_1.default)());
app.use('/api/', security_1.apiLimiter);
app.use(passport_1.default.initialize());
// Razorpay webhooks require raw body for signature verification. Keep this BEFORE express.json().
app.use("/api/webhooks/razorpay", express_1.default.raw({ type: "application/json" }));
// body parsers BEFORE routes
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// Health check route
app.get("/health", (req, res) => {
    res.status(200).json({
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        status: "ok",
    });
});
// API Routes
app.use("/api/auth", auth_1.default);
app.use("/api/user", user_1.default);
app.use("/api/users", mobileVerifyRoutes_1.default); // Only use mobile verify routes for /api/users
app.use("/api/products", products_1.default);
app.use("/api/cart", cart_1.default);
app.use("/api/orders", orders_1.default);
app.use("/api/delivery-fee", deliveryFee_1.default);
app.use("/api/delivery-fee-v2", enhancedDeliveryFeeRoutes_1.default); // Enhanced delivery fee calculation
app.use("/api/delivery-personnel", deliveryPersonnel_1.default);
app.use("/api/delivery", deliveryAuth_1.default); // Delivery auth & order management
app.use("/api/pincode", pincode_1.default);
app.use("/api/location", locationRoutes_1.default);
app.use("/api/admin", admin_1.default);
app.use("/api/admin/ops", adminOps_1.default);
app.use("/api/otp", otpRoutes_1.default);
app.use("/api/notifications", notifications_1.default);
app.use("/api/dev/notifications", devNotifications_1.default);
app.use("/api/uploads", uploads_1.default);
app.use("/api/payment-intents", paymentIntents_routes_1.default);
app.use("/api/webhooks", webhooks_routes_1.default);
// Admin tracking (Phase 4)
app.use("/admin/tracking", adminTracking_1.default);
// Internal (non-customer) routes
app.use("/internal/tracking", internalTracking_1.default);
console.log("OTP routes registered successfully");
console.log("Notification routes registered successfully");
console.log("Upload routes registered successfully");
// Global 404 handler
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});
// Error handling middleware (must be last)
app.use(errorHandler_1.errorHandler);
exports.default = app;
