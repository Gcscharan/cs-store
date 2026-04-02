import { logger } from './utils/logger';
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

export interface AppConfig {
  enableQueues?: boolean;
  enableRedis?: boolean;
  enableExternalAPIs?: boolean;
  enableSentry?: boolean;
  enableAuth?: boolean;
}

export function createApp(config: AppConfig = {}): Application {
  const {
    enableQueues = true,
    enableRedis = true,
    enableExternalAPIs = true,
    enableSentry = true,
    enableAuth = true,
  } = config;

  // Initialize Sentry only if enabled
  if (enableSentry && process.env.NODE_ENV !== 'test') {
    initializeSentry();
  }

  const app: Application = express();

  /* ======================================================
     CORS — SINGLE SOURCE OF TRUTH (REGISTER FIRST)
  ====================================================== */

  const allowedCorsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5000', 'http://localhost:5001'];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        // Check if origin is in the allowed list
        if (allowedCorsOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        // Development bypass: allow any localhost or private IP in dev mode
        if (process.env.NODE_ENV !== 'production') {
          if (origin.startsWith('http://localhost:') || 
              origin.startsWith('http://127.0.0.1:') || 
              origin.startsWith('http://192.168.') || 
              origin.startsWith('http://10.')) {
            return callback(null, true);
          }
        }
        
        return callback(new Error(`CORS: origin ${origin} not allowed`), false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id", "x-request-id", "X-Client-Platform", "X-Client-Version"],
    })
  );

  /* ======================================================
     GENERAL MIDDLEWARE
  ====================================================== */

  app.use(securityHeaders);
  
  if (enableSentry && process.env.NODE_ENV !== 'test') {
    app.use(sentryMiddleware.requestHandler());
    app.use(sentryMiddleware.tracingHandler());
  }
  
  app.use(compression());
  app.use(requestIdMiddleware);
  app.use(httpObservabilityMiddleware);
  app.use("/api", apiLimiter);
  
  if (enableAuth) {
    // Only initialize OAuth strategies if auth is enabled
    try {
      require("./config/oauth");
    } catch (error) {
      logger.warn("[createApp] OAuth initialization skipped:", error);
    }
    app.use(passport.initialize());
  }

  /* ======================================================
     RAZORPAY WEBHOOK (RAW BODY — BEFORE JSON)
  ====================================================== */

  // IMPORTANT: This must be before express.json() to ensure we get the raw body for signature verification
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

  app.get("/health", async (_req, res) => {
    try {
      if (enableQueues && enableRedis) {
        // Import queue/worker managers dynamically to avoid circular deps
        const { queueManager } = await import('./queues/queueManager');
        const { workerManager } = await import('./queues/workerManager');
        const { fallbackBuffer } = await import('./queues/fallbackBuffer');
        
        // Get queue health
        const queueHealth = await queueManager.getHealth();
        const workerHealth = await workerManager.getHealth();
        
        // Determine overall status
        let status: 'ok' | 'degraded' | 'down' = 'ok';
        if (!queueHealth.healthy) {
          status = workerHealth.healthy ? 'degraded' : 'down';
        }
        
        res.status(200).json({
          status,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          queues: queueHealth,
          workers: workerHealth,
          bufferSize: fallbackBuffer.size(),
        });
      } else {
        // Basic health check without queue system
        res.status(200).json({
          status: "ok",
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      // If queue system not initialized yet, return basic health
      res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }
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

  // Import routes dynamically to avoid initialization issues
  const authRoutes = require("./domains/identity/routes/auth").default;
  const userRoutes = require("./domains/identity/routes/user").default;
  const mobileVerifyRoutes = require("./domains/security/routes/mobileVerifyRoutes").default;
  const productRoutes = require("./domains/catalog/routes/products").default;
  const cartRoutes = require("./routes/cart").default;
  const orderRoutes = require("./routes/orders").default;
  const deliveryFeeRoutes = require("./routes/deliveryFee").default;
  const enhancedDeliveryFeeRoutes = require("./routes/enhancedDeliveryFeeRoutes").default;
  const deliveryPersonnelRoutes = require("./routes/deliveryPersonnel").default;
  const deliveryAuthRoutes = require("./routes/deliveryAuth").default;
  const pincodeRoutes = require("./routes/pincodeRoutes").default;
  const locationRoutes = require("./routes/locationRoutes").default;
  const adminRoutes = require("./routes/admin").default;
  const adminOpsRoutes = require("./routes/adminOps").default;
  const adminTrackingRoutes = require("./routes/adminTracking").default;
  const adminTrackingLearningRoutes = require("./routes/adminTrackingLearning").default;
  const adminTrackingOncallRoutes = require("./routes/adminTrackingOncall").default;
  const adminTrackingEscalationsRoutes = require("./routes/adminTrackingEscalations").default;
  const debugDbTestRoutes = require("./routes/debugDbTest").default;
  const internalTrackingRoutes = require("./routes/internalTracking").default;
  const internalPaymentsReconciliationRoutes = require("./routes/internalPaymentsReconciliation").default;
  const internalPaymentsRecoveryRoutes = require("./routes/internalPaymentsRecovery").default;
  const internalPaymentRecoverySuggestionRoutes = require("./routes/internalPaymentRecoverySuggestion").default;
  const internalPaymentRecoveryExecuteRoutes = require("./routes/internalPaymentRecoveryExecute").default;
  const internalFinanceReportsRoutes = require("./routes/internalFinanceReports").default;
  const internalPaymentsVerificationRoutes = require("./domains/payments/routes/internalPaymentsVerification").default;
  const internalRefundsRoutes = require("./routes/internalRefunds").default;
  const otpRoutes = require("./domains/security/routes/otpRoutes").default;
  const notificationRoutes = require("./domains/communication/routes/notifications").default;
  const devNotificationRoutes = require("./domains/communication/routes/devNotifications").default;
  const uploadRoutes = require("./domains/uploads/routes/uploads").default;
  const upiRoutes = require("./routes/upi").default;
  const paymentRoutes = require("./domains/finance/routes/paymentRoutes").default;
  const featureFlagsRoutes = require("./routes/featureFlagsApi").default;

  const metricsApiRoutes = require("./routes/metricsApi").default;

  // Payments (new architecture)
  const paymentIntentsRoutes = require("./domains/payments/routes/paymentIntents.routes").default;
  const paymentWebhooksRoutes = require("./domains/payments/routes/webhooks.routes").default;
  const paymentStatusRoutes = require("./domains/payments/routes/paymentStatus.routes").default;

  // Invoice
  const invoiceRoutes = require("./domains/invoice/routes/invoice.routes").default;
  const orderTrackingRoutes = require("./routes/orderTracking").default;

  // API Routes grouped under /api
  const apiRouter = express.Router();

  // Voice AI (only if queues enabled)
  if (enableQueues) {
    try {
      const voiceRoutes = require("./routes/voiceRoutes").default;
      const voiceCorrectionRoutes = require("./routes/voiceCorrectionRoutes").default;
      const queueAdminRoutes = require("./routes/queueAdmin").default;
      const metricsSystemRoutes = require("./routes/metricsRoutes").default;
      const voiceMetricsLogRoutes = require("./routes/voiceMetricsLog").default;
      const queueMetricsRoutes = require("./routes/queueMetrics").default;
      const experimentRoutes = require("./routes/experimentRoutes").default;
      const experimentPublicRoutes = require("./routes/experimentPublicRoutes").default;
      const semanticSearchRoutes = require("./routes/semanticSearchRoutes").default;

      apiRouter.use("/voice", voiceRoutes);
      apiRouter.use("/voice", voiceCorrectionRoutes);
      apiRouter.use("/voice", voiceMetricsLogRoutes);
      apiRouter.use("/search", semanticSearchRoutes);
      apiRouter.use("/admin/queues", queueAdminRoutes);
      apiRouter.use("/metrics", metricsSystemRoutes);
      apiRouter.use("/metrics", queueMetricsRoutes);
      apiRouter.use("/admin/experiments", experimentRoutes);
      apiRouter.use("/experiments", experimentPublicRoutes);
    } catch (error) {
      logger.warn("[createApp] Voice AI routes skipped (queues disabled):", error);
    }
  }

  if (enableAuth) {
    apiRouter.use("/auth", authRoutes);
  }

  apiRouter.use("/user", userRoutes);
  apiRouter.use("/users", mobileVerifyRoutes);
  apiRouter.use("/products", productRoutes);
  apiRouter.use("/cart", cartRoutes);
  apiRouter.use("/orders", orderRoutes);
  apiRouter.use("/orders", orderTrackingRoutes);
  apiRouter.use("/orders", invoiceRoutes);
  apiRouter.use("/delivery-fee", deliveryFeeRoutes);
  apiRouter.use("/delivery-fee-v2", enhancedDeliveryFeeRoutes);
  apiRouter.use("/delivery-personnel", deliveryPersonnelRoutes);
  apiRouter.use("/delivery", deliveryAuthRoutes);
  apiRouter.use("/pincode", pincodeRoutes);
  apiRouter.use("/location", locationRoutes);
  apiRouter.use("/admin", adminRoutes);
  apiRouter.use("/admin/ops", adminOpsRoutes);
  apiRouter.use("/otp", otpRoutes);
  apiRouter.use("/notifications", notificationRoutes);
  apiRouter.use("/dev/notifications", devNotificationRoutes);
  apiRouter.use("/uploads", uploadRoutes);
  apiRouter.use("/upi", upiRoutes);
  apiRouter.use("/payment", paymentRoutes);
  apiRouter.use("/payment-intents", paymentIntentsRoutes);
  apiRouter.use("/payment-status", paymentStatusRoutes);
  apiRouter.use("/webhooks", paymentWebhooksRoutes);
  apiRouter.use("/admin/tracking", adminTrackingRoutes);
  apiRouter.use("/admin/tracking/learning", adminTrackingLearningRoutes);
  apiRouter.use("/admin/tracking/oncall", adminTrackingOncallRoutes);
  apiRouter.use("/admin/tracking/escalations", adminTrackingEscalationsRoutes);

  // Internal Routes (Flattened for reliability)
  apiRouter.use("/internal/tracking", internalTrackingRoutes);
  apiRouter.use("/internal/payments", internalPaymentsReconciliationRoutes);
  apiRouter.use("/internal/payments", internalPaymentsRecoveryRoutes);
  apiRouter.use("/internal/payments", internalPaymentsVerificationRoutes);
  apiRouter.use("/internal/payments", internalPaymentRecoverySuggestionRoutes);
  apiRouter.use("/internal/payments", internalPaymentRecoveryExecuteRoutes);
  apiRouter.use("/internal/finance", internalFinanceReportsRoutes);
  apiRouter.use("/internal", internalRefundsRoutes);
  apiRouter.use("/internal", metricsApiRoutes);

  apiRouter.use("/debug", debugDbTestRoutes);
  apiRouter.use("/", featureFlagsRoutes);

  app.use("/api", apiRouter);

  /* ======================================================
     404 HANDLER
  ====================================================== */

  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  /* ======================================================
     ERROR HANDLER (LAST)
  ====================================================== */

  if (enableSentry && process.env.NODE_ENV !== 'test') {
    app.use(sentryMiddleware.errorHandler());
  }
  app.use(errorHandler);

  return app;
}
