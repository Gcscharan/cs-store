import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";

// Import routes
import authRoutes from "./routes/auth";
import productRoutes from "./routes/products";
import cartRoutes from "./routes/cart";
import orderRoutes from "./routes/orders";
import deliveryRoutes from "./routes/delivery";
import pincodeRoutes from "./routes/pincode";
import adminRoutes from "./routes/admin";
import webhookRoutes from "./routes/webhooks";
import cloudinaryRoutes from "./routes/cloudinary";

// Import middleware
import { errorHandler } from "./middleware/errorHandler";

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// MongoDB connection
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((error) => console.error("❌ MongoDB connection error:", error));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/pincode", pincodeRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id);

  // Join order room
  socket.on("join_order", (orderId) => {
    socket.join(`order_${orderId}`);
    console.log(`User ${socket.id} joined order ${orderId}`);
  });

  // Join driver room
  socket.on("join_driver", (driverId) => {
    socket.join(`driver_${driverId}`);
    console.log(`User ${socket.id} joined driver ${driverId}`);
  });

  // Join admin room
  socket.on("join_admin", () => {
    socket.join("admin_room");
    console.log(`User ${socket.id} joined admin room`);
  });

  // Handle order events
  socket.on("order:created", (data) => {
    const { orderId } = data;
    io.to("admin_room").emit("order:created", { orderId });
    console.log(`Order created: ${orderId}`);
  });

  // Handle order status updates
  socket.on("order:status:update", (data) => {
    const { orderId, status } = data;
    io.to(`order_${orderId}`).emit("order:status:update", { orderId, status });
    io.to("admin_room").emit("order:status:update", { orderId, status });
    console.log(`Order ${orderId} status updated to ${status}`);
  });

  // Handle driver location updates
  socket.on("driver:location:update", (data) => {
    const { driverId, lat, lng, speed, eta } = data;
    io.to(`driver_${driverId}`).emit("driver:location:update", {
      driverId,
      lat,
      lng,
      speed,
      eta,
    });
    io.to("admin_room").emit("driver:location:update", {
      driverId,
      lat,
      lng,
      speed,
      eta,
    });
    console.log(`Driver ${driverId} location updated`);
  });

  // Handle payment success
  socket.on("order:payment:success", (data) => {
    const { orderId } = data;
    io.to(`order_${orderId}`).emit("order:payment:success", { orderId });
    io.to("admin_room").emit("order:payment:success", { orderId });
    console.log(`Payment successful for order: ${orderId}`);
  });

  socket.on("disconnect", () => {
    console.log("🔌 User disconnected:", socket.id);
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

export { io };
