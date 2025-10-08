import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./utils/database";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import cartRoutes from "./routes/cart";
import orderRoutes from "./routes/orders";
import deliveryRoutes from "./routes/delivery";
import pincodeRoutes from "./routes/pincode";
import adminRoutes from "./routes/admin";
import webhookRoutes from "./routes/webhooks";
import cloudinaryRoutes from "./routes/cloudinary";

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
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

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/pincode", pincodeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
