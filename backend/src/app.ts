import express, { Application } from "express";
import cors from "cors";
import passport from "passport";
import compression from "compression";
import { generateOpenApiSpec } from "./config/autoOpenApi";

import { apiLimiter } from "./middleware/security";
import { sanitizeInput, securityHeaders } from "./middleware/security";
import { errorHandler } from "./middleware/errorHandler";
import { httpObservabilityMiddleware, requestIdMiddleware } from "./middleware/observability";
import { initializeSentry, sentryMiddleware } from "./utils/logger";

import "./config/oauth"; // Initialize OAuth strategies

// Routes
import authRoutes from "./domains/identity/routes/auth";
import userRoutes from "./domains/identity/routes/user";
import mobileVerifyRoutes from "./domains/security/routes/mobileVerifyRoutes";
import productRoutes from "./domains/catalog/routes/products";
import cartRoutes from "./routes/cart";
import orderRoutes from "./routes/orders";
import deliveryFeeRoutes from "./routes/deliveryFee";
import enhancedDeliveryFeeRoutes from "./routes/enhancedDeliveryFeeRoutes";
import deliveryPersonnelRoutes from "./routes/deliveryPersonnel";
import deliveryAuthRoutes from "./routes/deliveryAuth";
import pincodeRoutes from "./routes/pincodeRoutes";
import locationRoutes from "./routes/locationRoutes";
import adminRoutes from "./routes/admin";
import adminOpsRoutes from "./routes/adminOps";
import adminTrackingRoutes from "./routes/adminTracking";
import adminTrackingLearningRoutes from "./routes/adminTrackingLearning";
import adminTrackingOncallRoutes from "./routes/adminTrackingOncall";
import adminTrackingEscalationsRoutes from "./routes/adminTrackingEscalations";
import debugDbTestRoutes from "./routes/debugDbTest";
import internalTrackingRoutes from "./routes/internalTracking";
import internalPaymentsReconciliationRoutes from "./routes/internalPaymentsReconciliation";
import internalPaymentsRecoveryRoutes from "./routes/internalPaymentsRecovery";
import internalPaymentRecoverySuggestionRoutes from "./routes/internalPaymentRecoverySuggestion";
import internalPaymentRecoveryExecuteRoutes from "./routes/internalPaymentRecoveryExecute";
import internalFinanceReportsRoutes from "./routes/internalFinanceReports";
import internalPaymentsVerificationRoutes from "./domains/payments/routes/internalPaymentsVerification";
import internalRefundsRoutes from "./routes/internalRefunds";
import otpRoutes from "./domains/security/routes/otpRoutes";
import notificationRoutes from "./domains/communication/routes/notifications";
import devNotificationRoutes from "./domains/communication/routes/devNotifications";
import uploadRoutes from "./domains/uploads/routes/uploads";
import upiRoutes from "./routes/upi";
import paymentRoutes from "./domains/finance/routes/paymentRoutes";

// Payments (new architecture)
import paymentIntentsRoutes from "./domains/payments/routes/paymentIntents.routes";
import paymentWebhooksRoutes from "./domains/payments/routes/webhooks.routes";

// Invoice
import invoiceRoutes from "./domains/invoice/routes/invoice.routes";
import orderTrackingRoutes from "./routes/orderTracking";

console.log("✅ App.ts loaded");

initializeSentry();

const app: Application = express();

/* ======================================================
   CORS — SINGLE SOURCE OF TRUTH (REGISTER FIRST)
====================================================== */

const allowedCorsOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://cs-store-frontend.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedCorsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id", "x-request-id"],
  })
);

/* ======================================================
   GENERAL MIDDLEWARE
====================================================== */

app.use(securityHeaders);
app.use(sentryMiddleware.requestHandler());
app.use(sentryMiddleware.tracingHandler());
app.use(compression());
app.use(requestIdMiddleware);
app.use(httpObservabilityMiddleware);
app.use("/api", apiLimiter);
app.use(passport.initialize());

/* ======================================================
   RAZORPAY WEBHOOK (RAW BODY — BEFORE JSON)
====================================================== */

app.use(
  "/api/webhooks/razorpay",
  express.raw({ type: "application/json" })
);

/* ======================================================
   BODY PARSERS (AFTER WEBHOOK RAW)
====================================================== */

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(sanitizeInput);

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/openapi.json", (_req, res) => {
  const spec = generateOpenApiSpec(app);
  res.json(spec);
});

/* ======================================================
   API ROUTES
====================================================== */

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/users", mobileVerifyRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/orders", orderTrackingRoutes); // Customer tracking endpoint
app.use("/api/orders", invoiceRoutes); // Invoice routes mounted under /api/orders
app.use("/api/delivery-fee", deliveryFeeRoutes);
app.use("/api/delivery-fee-v2", enhancedDeliveryFeeRoutes);
app.use("/api/delivery-personnel", deliveryPersonnelRoutes);
app.use("/api/delivery", deliveryAuthRoutes);
app.use("/api/pincode", pincodeRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/ops", adminOpsRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dev/notifications", devNotificationRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/upi", upiRoutes);

// Payments (legacy - admin list/stats)
app.use("/api/payment", paymentRoutes);

// Payments (canonical)
app.use("/api/payment-intents", paymentIntentsRoutes);
app.use("/api/webhooks", paymentWebhooksRoutes);

// Tracking
app.use("/admin/tracking", adminTrackingRoutes);
app.use("/internal/tracking", internalTrackingRoutes);

// Internal Payments
app.use("/internal/payments", internalPaymentsReconciliationRoutes);
app.use("/internal/payments", internalPaymentsRecoveryRoutes);
app.use("/internal/payments", internalPaymentsVerificationRoutes);
app.use("/internal/payments", internalPaymentRecoverySuggestionRoutes);
app.use("/internal/payments", internalPaymentRecoveryExecuteRoutes);

// Internal Refunds (admin-only, no gateway writes)
app.use("/internal", internalRefundsRoutes);

// Internal Finance (read-only)
app.use("/internal/finance", internalFinanceReportsRoutes);

app.use("/debug", debugDbTestRoutes);

/* ======================================================
   404 HANDLER
====================================================== */

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

/* ======================================================
   ERROR HANDLER (LAST)
====================================================== */

app.use(sentryMiddleware.errorHandler());
app.use(errorHandler);

export default app;