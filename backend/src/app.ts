import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import passport from "passport";
import { connectDB } from "./utils/database";
import { errorHandler } from "./middleware/errorHandler";
import "./config/oauth"; // Initialize OAuth strategies
import "./config/redis"; // Initialize Redis connection
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
import webhookRoutes from "./domains/finance/routes/webhooks";
import cloudinaryRoutes from "./routes/cloudinary";
import userRoutes from "./domains/identity/routes/user";
import otpRoutes from "./domains/security/routes/otpRoutes";
import deliveryRoutes from "./routes/deliveryRoutes";
import razorpayRoutes from "./domains/finance/routes/razorpay";
import notificationRoutes from "./domains/communication/routes/notifications";
import paymentRoutes from "./domains/finance/routes/paymentRoutes";

console.log("App.ts loaded successfully");

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      process.env.FRONTEND_URL || "http://localhost:3001",
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

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
app.use("/api/webhooks", webhookRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/razorpay", razorpayRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/notifications", notificationRoutes);
console.log("Payment routes registered successfully");
console.log("Razorpay routes registered successfully");
console.log("OTP routes registered successfully");
console.log("Notification routes registered successfully");

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
