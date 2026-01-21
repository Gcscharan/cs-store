import express, { Application } from "express";
import cors from "cors";
import passport from "passport";

// JWT Secret Validation moved to index.ts after dotenv.config()
import compression from "compression";
import { apiLimiter } from "./middleware/security";
import { connectDB } from "./utils/database";
import { errorHandler } from "./middleware/errorHandler";
import "./config/oauth"; // Initialize OAuth strategies
import { deliveryPartnerLoadService } from "./domains/operations/services/deliveryPartnerLoadService";
import authRoutes from "./domains/identity/routes/auth";
import productRoutes from "./domains/catalog/routes/products";
import cartRoutes from "./routes/cart";
import orderRoutes from "./routes/orders";
import deliveryFeeRoutes from "./routes/deliveryFee";
import enhancedDeliveryFeeRoutes from "./routes/enhancedDeliveryFeeRoutes";
import deliveryPersonnelRoutes from "./routes/deliveryPersonnel";
import deliveryAuthRoutes from "./routes/deliveryAuth";
import pincodeRoutes from "./routes/pincode";
import locationRoutes from "./routes/locationRoutes";
import adminRoutes from "./routes/admin";
import adminOpsRoutes from "./routes/adminOps";
import adminTrackingRoutes from "./routes/adminTracking";
import internalTrackingRoutes from "./routes/internalTracking";
import userRoutes from "./domains/identity/routes/user";
import otpRoutes from "./domains/security/routes/otpRoutes";
import mobileVerifyRoutes from "./domains/security/routes/mobileVerifyRoutes";
import notificationRoutes from "./domains/communication/routes/notifications";
import devNotificationRoutes from "./domains/communication/routes/devNotifications";
import uploadRoutes from "./domains/uploads/routes/uploads";
import paymentIntentsRoutes from "./domains/payments/routes/paymentIntents.routes";
import paymentWebhooksRoutes from "./domains/payments/routes/webhooks.routes";

console.log("App.ts loaded successfully");

const app: Application = express();

// Middleware
const allowedCorsOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://cs-store-frontend-p9sszldr6-randoms-projects-e13b50d6.vercel.app",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, Postman)
      if (!origin) return callback(null, true);

      if (allowedCorsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  })
);
app.use(compression() as any);
app.use('/api/', apiLimiter as any);
app.use(passport.initialize() as any);

// Razorpay webhooks require raw body for signature verification. Keep this BEFORE express.json().
app.use("/api/webhooks/razorpay", express.raw({ type: "application/json" }));

// body parsers BEFORE routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    status: "ok",
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/users", mobileVerifyRoutes); // Only use mobile verify routes for /api/users
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery-fee", deliveryFeeRoutes);
app.use("/api/delivery-fee-v2", enhancedDeliveryFeeRoutes); // Enhanced delivery fee calculation
app.use("/api/delivery-personnel", deliveryPersonnelRoutes);
app.use("/api/delivery", deliveryAuthRoutes); // Delivery auth & order management
app.use("/api/pincode", pincodeRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/ops", adminOpsRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/dev/notifications", devNotificationRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/payment-intents", paymentIntentsRoutes);
app.use("/api/webhooks", paymentWebhooksRoutes);

// Admin tracking (Phase 4)
app.use("/admin/tracking", adminTrackingRoutes);

// Internal (non-customer) routes
app.use("/internal/tracking", internalTrackingRoutes);

console.log("OTP routes registered successfully");
console.log("Notification routes registered successfully");
console.log("Upload routes registered successfully");

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
