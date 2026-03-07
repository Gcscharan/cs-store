"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const passport_1 = __importDefault(require("passport"));
const compression_1 = __importDefault(require("compression"));
const security_1 = require("./middleware/security");
const security_2 = require("./middleware/security");
const errorHandler_1 = require("./middleware/errorHandler");
const observability_1 = require("./middleware/observability");
const logger_1 = require("./utils/logger");
require("./config/oauth"); // Initialize OAuth strategies
// Routes
const auth_1 = __importDefault(require("./domains/identity/routes/auth"));
const user_1 = __importDefault(require("./domains/identity/routes/user"));
const mobileVerifyRoutes_1 = __importDefault(require("./domains/security/routes/mobileVerifyRoutes"));
const products_1 = __importDefault(require("./domains/catalog/routes/products"));
const cart_1 = __importDefault(require("./routes/cart"));
const orders_1 = __importDefault(require("./routes/orders"));
const deliveryFee_1 = __importDefault(require("./routes/deliveryFee"));
const enhancedDeliveryFeeRoutes_1 = __importDefault(require("./routes/enhancedDeliveryFeeRoutes"));
const deliveryPersonnel_1 = __importDefault(require("./routes/deliveryPersonnel"));
const deliveryAuth_1 = __importDefault(require("./routes/deliveryAuth"));
const pincodeRoutes_1 = __importDefault(require("./routes/pincodeRoutes"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes"));
const admin_1 = __importDefault(require("./routes/admin"));
const adminOps_1 = __importDefault(require("./routes/adminOps"));
const adminTracking_1 = __importDefault(require("./routes/adminTracking"));
const debugDbTest_1 = __importDefault(require("./routes/debugDbTest"));
const internalTracking_1 = __importDefault(require("./routes/internalTracking"));
const internalPaymentsReconciliation_1 = __importDefault(require("./routes/internalPaymentsReconciliation"));
const internalPaymentsRecovery_1 = __importDefault(require("./routes/internalPaymentsRecovery"));
const internalPaymentRecoverySuggestion_1 = __importDefault(require("./routes/internalPaymentRecoverySuggestion"));
const internalPaymentRecoveryExecute_1 = __importDefault(require("./routes/internalPaymentRecoveryExecute"));
const internalFinanceReports_1 = __importDefault(require("./routes/internalFinanceReports"));
const internalPaymentsVerification_1 = __importDefault(require("./domains/payments/routes/internalPaymentsVerification"));
const internalRefunds_1 = __importDefault(require("./routes/internalRefunds"));
const otpRoutes_1 = __importDefault(require("./domains/security/routes/otpRoutes"));
const notifications_1 = __importDefault(require("./domains/communication/routes/notifications"));
const devNotifications_1 = __importDefault(require("./domains/communication/routes/devNotifications"));
const uploads_1 = __importDefault(require("./domains/uploads/routes/uploads"));
const upi_1 = __importDefault(require("./routes/upi"));
const paymentRoutes_1 = __importDefault(require("./domains/finance/routes/paymentRoutes"));
// Payments (new architecture)
const paymentIntents_routes_1 = __importDefault(require("./domains/payments/routes/paymentIntents.routes"));
const webhooks_routes_1 = __importDefault(require("./domains/payments/routes/webhooks.routes"));
// Invoice
const invoice_routes_1 = __importDefault(require("./domains/invoice/routes/invoice.routes"));
console.log("✅ App.ts loaded");
(0, logger_1.initializeSentry)();
const app = (0, express_1.default)();
/* ======================================================
   CORS — SINGLE SOURCE OF TRUTH (REGISTER FIRST)
====================================================== */
const allowedCorsOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://cs-store-frontend.vercel.app",
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (allowedCorsOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id", "x-request-id"],
}));
/* ======================================================
   GENERAL MIDDLEWARE
====================================================== */
app.use(security_2.securityHeaders);
app.use(logger_1.sentryMiddleware.requestHandler());
app.use(logger_1.sentryMiddleware.tracingHandler());
app.use((0, compression_1.default)());
app.use(observability_1.requestIdMiddleware);
app.use(observability_1.httpObservabilityMiddleware);
app.use("/api", security_1.apiLimiter);
app.use(passport_1.default.initialize());
/* ======================================================
   RAZORPAY WEBHOOK (RAW BODY — BEFORE JSON)
====================================================== */
app.use("/api/webhooks/razorpay", express_1.default.raw({ type: "application/json" }));
/* ======================================================
   BODY PARSERS (AFTER WEBHOOK RAW)
====================================================== */
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use(security_2.sanitizeInput);
/* ======================================================
   HEALTH CHECK
====================================================== */
app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
/* ======================================================
   API ROUTES
====================================================== */
app.use("/api/auth", auth_1.default);
app.use("/api/user", user_1.default);
app.use("/api/users", mobileVerifyRoutes_1.default);
app.use("/api/products", products_1.default);
app.use("/api/cart", cart_1.default);
app.use("/api/orders", orders_1.default);
app.use("/api/orders", invoice_routes_1.default); // Invoice routes mounted under /api/orders
app.use("/api/delivery-fee", deliveryFee_1.default);
app.use("/api/delivery-fee-v2", enhancedDeliveryFeeRoutes_1.default);
app.use("/api/delivery-personnel", deliveryPersonnel_1.default);
app.use("/api/delivery", deliveryAuth_1.default);
app.use("/api/pincode", pincodeRoutes_1.default);
app.use("/api/location", locationRoutes_1.default);
app.use("/api/admin", admin_1.default);
app.use("/api/admin/ops", adminOps_1.default);
app.use("/api/otp", otpRoutes_1.default);
app.use("/api/notifications", notifications_1.default);
app.use("/api/dev/notifications", devNotifications_1.default);
app.use("/api/uploads", uploads_1.default);
app.use("/api/upi", upi_1.default);
// Payments (legacy - admin list/stats)
app.use("/api/payment", paymentRoutes_1.default);
// Payments (canonical)
app.use("/api/payment-intents", paymentIntents_routes_1.default);
app.use("/api/webhooks", webhooks_routes_1.default);
// Tracking
app.use("/admin/tracking", adminTracking_1.default);
app.use("/internal/tracking", internalTracking_1.default);
// Internal Payments
app.use("/internal/payments", internalPaymentsReconciliation_1.default);
app.use("/internal/payments", internalPaymentsRecovery_1.default);
app.use("/internal/payments", internalPaymentsVerification_1.default);
app.use("/internal/payments", internalPaymentRecoverySuggestion_1.default);
app.use("/internal/payments", internalPaymentRecoveryExecute_1.default);
// Internal Refunds (admin-only, no gateway writes)
app.use("/internal", internalRefunds_1.default);
// Internal Finance (read-only)
app.use("/internal/finance", internalFinanceReports_1.default);
app.use("/debug", debugDbTest_1.default);
/* ======================================================
   404 HANDLER
====================================================== */
app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
});
/* ======================================================
   ERROR HANDLER (LAST)
====================================================== */
app.use(logger_1.sentryMiddleware.errorHandler());
app.use(errorHandler_1.errorHandler);
exports.default = app;
