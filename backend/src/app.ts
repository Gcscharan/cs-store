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
import userRoutes from "./domains/identity/routes/user";
import otpRoutes from "./domains/security/routes/otpRoutes";
import mobileVerifyRoutes from "./domains/security/routes/mobileVerifyRoutes";
import notificationRoutes from "./domains/communication/routes/notifications";
import uploadRoutes from "./domains/uploads/routes/uploads";

console.log("App.ts loaded successfully");

const app: Application = express();

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
  })
);
app.use(compression() as any);
app.use('/api/', apiLimiter as any);
app.use(passport.initialize());

// body parsers BEFORE routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Test payment route directly in app.ts
app.get("/api/payment/test-direct", (req, res) => {
  res.json({ message: "Direct payment route working!" });
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
app.use("/api/otp", otpRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/uploads", uploadRoutes);

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
