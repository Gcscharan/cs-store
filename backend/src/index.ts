import { logger } from './utils/logger';
import "./config/env";

// Load environment variables FIRST before any other imports
import path from "path";
import dotenv from "dotenv";

const ENV_PATH = path.resolve(__dirname, "..", ".env");
dotenv.config({ path: ENV_PATH });

logger.info("[CACHE] Product read cache enabled");

if (!process.env.MONGODB_URI) {
  throw new Error("❌ MONGODB_URI is missing. Backend refusing to start.");
}

const NODE_ENV = process.env.NODE_ENV || "development";
const DEV_LOW_POWER = String(process.env.DEV_LOW_POWER || "").toLowerCase() === "true";
const verboseLoggingEnabled = NODE_ENV === "production" ? true : !DEV_LOW_POWER;

// Comprehensive Environment Variable Validation
function validateEnvironmentVariables() {
  const errors: string[] = [];

  // Database
  if (!process.env.MONGODB_URI) {
    errors.push("❌ MONGODB_URI is required");
  }

  // JWT Secrets
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push(`❌ JWT_SECRET must be at least 32 characters long. Current length: ${process.env.JWT_SECRET!.length}`);
  }

  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    errors.push(`❌ JWT_REFRESH_SECRET must be at least 32 characters long. Current length: ${process.env.JWT_REFRESH_SECRET!.length}`);
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
    } else {
      errors.push("⚠️  REDIS_URL is recommended");
    }
  }

  // Frontend
  if (!process.env.FRONTEND_URL) {
    if (NODE_ENV === "production") {
      errors.push("❌ FRONTEND_URL is required in production");
    } else {
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

  // ============================================================
  // SELLER GST CONFIGURATION (Required for Invoice Generation)
  // ============================================================
  // In production, these are MANDATORY for GST-compliant invoices.
  // Missing values will cause invoice generation to fail silently
  // or produce invalid invoices.
  // ============================================================
  if (NODE_ENV === "production") {
    const sellerGstErrors: string[] = [];

    // Required seller details
    const requiredSellerFields = [
      { key: "SELLER_LEGAL_NAME", name: "Seller Legal Name" },
      { key: "SELLER_GSTIN", name: "Seller GSTIN" },
      { key: "SELLER_ADDRESS_LINE1", name: "Seller Address Line 1" },
      { key: "SELLER_CITY", name: "Seller City" },
      { key: "SELLER_STATE", name: "Seller State" },
      { key: "SELLER_STATE_CODE", name: "Seller State Code" },
      { key: "SELLER_PINCODE", name: "Seller Pincode" },
    ];

    for (const field of requiredSellerFields) {
      if (!process.env[field.key] || process.env[field.key]!.trim() === "") {
        sellerGstErrors.push(`❌ ${field.name} (${field.key}) is required for GST invoices`);
      }
    }

    // GSTIN format validation (Indian GSTIN pattern)
    // Format: 2-digit state code + PAN + entity + checksum
    // Example: 29AABCU9603R1ZM
    const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const sellerGstin = process.env.SELLER_GSTIN;

    if (sellerGstin && !GSTIN_REGEX.test(sellerGstin)) {
      sellerGstErrors.push(`❌ SELLER_GSTIN format is invalid. Expected format: 29AABCU9603R1ZM (2-digit state code + PAN + entity + checksum)`);
    }

    // State code validation (2-digit)
    const STATE_CODE_REGEX = /^[0-9]{2}$/;
    const sellerStateCode = process.env.SELLER_STATE_CODE;

    if (sellerStateCode && !STATE_CODE_REGEX.test(sellerStateCode)) {
      sellerGstErrors.push(`❌ SELLER_STATE_CODE must be a 2-digit number (e.g., 29 for Karnataka)`);
    }

    // Pincode validation (6-digit)
    const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
    const sellerPincode = process.env.SELLER_PINCODE;

    if (sellerPincode && !PINCODE_REGEX.test(sellerPincode)) {
      sellerGstErrors.push(`❌ SELLER_PINCODE must be a valid 6-digit Indian pincode`);
    }

    // Add seller GST errors to main errors array
    if (sellerGstErrors.length > 0) {
      logger.error("\n🚨 SELLER GST CONFIGURATION ERRORS:");
      sellerGstErrors.forEach(err => logger.error(err));
      logger.error("\n❌ Invoice generation will fail without valid seller GST details.");
      logger.error("❌ Please add these variables to your .env file:\n");
      logger.error("   SELLER_LEGAL_NAME=\"Your Company Pvt Ltd\"");
      logger.error("   SELLER_GSTIN=\"29AABCU9603R1ZM\"");
      logger.error("   SELLER_ADDRESS_LINE1=\"123, Business Park\"");
      logger.error("   SELLER_CITY=\"Bengaluru\"");
      logger.error("   SELLER_STATE=\"Karnataka\"");
      logger.error("   SELLER_STATE_CODE=\"29\"");
      logger.error("   SELLER_PINCODE=\"560001\"\n");
      errors.push(...sellerGstErrors);
    } else if (sellerGstin) {
      // All seller fields present and valid
      logger.info("✅ Seller GST configuration validated");
    }
  } else {
    // Development mode: warn if seller details missing
    if (!process.env.SELLER_GSTIN) {
      errors.push("⚠️  SELLER_GSTIN is not set. Invoices will use placeholder GST details.");
    }
  }

  // Critical errors that prevent startup
  const criticalErrors = errors.filter(err => err.startsWith("❌"));
  const warnings = errors.filter(err => err.startsWith("⚠️"));

  if (criticalErrors.length > 0) {
    logger.error("\n🚨 CRITICAL ENVIRONMENT ERRORS:");
    criticalErrors.forEach(err => logger.error(err));
    logger.error("\n❌ Server cannot start due to critical configuration errors.");
    logger.error("❌ Please check your .env file and restart the server.\n");
    process.exit(1);
  }

  if (warnings.length > 0) {
    logger.warn("\n⚠️  Environment warnings:");
    warnings.forEach(warn => logger.warn(warn));
    logger.warn("⚠️  Consider adding these variables for full functionality.\n");
  }

  if (verboseLoggingEnabled) {
    logger.info("✅ Environment variables validated successfully");
  }
}

// Run validation immediately after dotenv config
validateEnvironmentVariables();

// Runtime proof (dev only): log DB name derived from MONGODB_URI
if (NODE_ENV !== "production") {
  try {
    const dbPathname = new URL(String(process.env.MONGODB_URI)).pathname;
    logger.info("[BOOT] Connected DB:", dbPathname);
  } catch {
    logger.info("[BOOT] Connected DB:", "<unparseable>");
  }
}

// Validate critical environment variables immediately
if (verboseLoggingEnabled) {
  logger.info("\n========================================");
  logger.info("🔧 Environment Variables Check");
  logger.info("========================================");
  logger.info(`🌍 NODE_ENV: ${process.env.NODE_ENV || "development"}`);
  logger.info(`🚪 PORT: ${process.env.PORT || "5001"}`);
  logger.info(`🔗 MONGODB_URI present: ${process.env.MONGODB_URI ? "✅ Yes" : "❌ NO"}`);
  logger.info(`🔑 JWT_SECRET present: ${process.env.JWT_SECRET ? "✅ Yes" : "❌ NO"}`);
  logger.info(`🔑 JWT_REFRESH_SECRET present: ${process.env.JWT_REFRESH_SECRET ? "✅ Yes" : "❌ NO"}`);
  logger.info(`☁️ CLOUDINARY_CLOUD_NAME present: ${process.env.CLOUDINARY_CLOUD_NAME ? "✅ Yes" : "❌ NO"}`);
  logger.info(`📧 MOCK_OTP: ${process.env.MOCK_OTP || "false"}`);
  logger.info("[ENV][SMS] FAST2SMS key loaded:", !!process.env.FAST2SMS_API_KEY);
}

// Check FAST2SMS API key validity
if (process.env.FAST2SMS_API_KEY && process.env.FAST2SMS_API_KEY.length < 20) {
   logger.warn("[SMS][WARN] FAST2SMS_API_KEY appears invalid.");
}
if (verboseLoggingEnabled) {
  logger.info("========================================\n");
}

import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app";
import { connectDB } from "./utils/database";
import { bootstrapDevAdmin } from "./scripts/bootstrapDevAdmin";
import { ensureRedisConnection } from "./config/redis";
// import SocketService from "./services/socketService";
import jwt from "jsonwebtoken";
import { liveLocationEvents, liveLocationStore } from "./services/liveLocationStore";
import { User } from "./models/User";
import { Order } from "./models/Order";
import { deliveryPartnerLoadService } from "./domains/operations/services/deliveryPartnerLoadService";
import { OrderEventBroadcaster } from "./domains/orders/services/orderEventBroadcaster";
import { initializeNotificationWriter } from "./domains/communication/services/notificationWriter";
import { initializeOutboxDispatcher } from "./domains/events/outboxDispatcher";
import { initializeInventoryReservationSweeper } from "./domains/orders/services/inventoryReservationSweeper";
import { startStuckPaymentScanner } from "./domains/payments/services/stuckPaymentScanner";
import { initializePaymentReconciliation } from "./domains/payments/services/paymentReconciliationService";
import { calculateETA } from "./domains/tracking/services/etaCalculator";

// Create HTTP server
const server = createServer(app);

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

const io = new Server(server, {
  cors: {
    origin: socketCorsOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.use(async (socket, next) => {
  try {
    const provided =
      (typeof (socket.handshake as any)?.auth?.token === "string" && String((socket.handshake as any).auth.token).trim()) ||
      (typeof socket.handshake.headers?.authorization === "string" && String(socket.handshake.headers.authorization).replace(/^Bearer\s+/i, "").trim()) ||
      "";

    if (!provided) {
      return next();
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return next();
    }

    const decoded = jwt.verify(provided, jwtSecret) as any;
    const userId = String(decoded?.userId || "");
    if (!userId) {
      return next();
    }

    const u = await User.findById(userId).select("_id role").lean();
    if (!u) {
      return next();
    }

    (socket.data as any).userId = userId;
    (socket.data as any).role = String((u as any).role || "");
    return next();
  } catch (e) {
    logger.warn("[Socket] auth middleware failed", e);
    return next();
  }
});

// Initialize Socket Service for OTP (disabled for now)
// const socketService = new SocketService(server);

// Initialize OrderEventBroadcaster for real-time order status updates
const orderEventBroadcaster = new OrderEventBroadcaster(io);

// Store socket.io instance in app for webhook access
app.set("io", io);
app.set("orderEventBroadcaster", orderEventBroadcaster);
// app.set("socketService", socketService);

// Fan-out for accepted HTTP location updates (Phase 1B)
// Also emits to customer order rooms for live tracking
liveLocationEvents.on("location", async (loc: any) => {
  try {
    const driverId = String(loc?.driverId || "");
    if (!driverId) return;

    const payload = {
      driverId,
      routeId: String(loc?.routeId || ""),
      lat: Number(loc?.lat),
      lng: Number(loc?.lng),
      lastUpdatedAt: new Date(Number(loc?.receivedAt || Date.now())).toISOString(),
    };

    // Emit to admin room (exact coordinates)
    io.to("admin_room").emit("driver:location:update", payload);

    // Emit to customer order rooms (privacy-safe rounded coordinates)
    const orderId = String(loc?.orderId || "");
    if (orderId) {
      try {
        // Check if order is still in a trackable state
        const order = await Order.findById(orderId).select("status user deliveryPartnerId").lean();
        if (order && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(String((order as any).status || "").toUpperCase())) {
          // Round coordinates to 3 decimal places (~111m accuracy) for privacy
          const roundedLat = Math.round(Number(loc?.lat) * 1000) / 1000;
          const roundedLng = Math.round(Number(loc?.lng) * 1000) / 1000;

          // Calculate ETA if we have destination
          let etaMinutes = 0;
          let distanceRemainingM = 0;
          
          if ((order as any).deliveryPartnerId && loc?.lat && loc?.lng) {
            // Get order address for ETA calculation
            const fullOrder = await Order.findById(orderId).select("address").lean();
            if (fullOrder?.address?.lat && fullOrder?.address?.lng) {
              try {
                const etaResult = await calculateETA({
                  riderLat: Number(loc?.lat),
                  riderLng: Number(loc?.lng),
                  destLat: fullOrder.address.lat,
                  destLng: fullOrder.address.lng,
                  orderId,
                  accuracyM: loc?.accuracy,
                });
                etaMinutes = etaResult.etaMinutes;
                distanceRemainingM = etaResult.distanceRemainingM;
              } catch (e) {
                logger.warn("[LiveLocation][ETA] calculation failed:", e);
              }
            }
          }

          const customerPayload = {
            riderLat: roundedLat,
            riderLng: roundedLng,
            etaMinutes,
            distanceRemainingM,
            lastUpdated: payload.lastUpdatedAt,
          };

          // Emit to order-specific room
          io.to(`order:${orderId}`).emit("order:location:update", customerPayload);
        }
      } catch (e) {
        logger.warn("[LiveLocation][customer] fan-out error:", e);
      }
    }
  } catch (e) {
    logger.error("[LiveLocation][socket] fan-out error:", e);
  }
});

// Socket.io connection handling
io.on("connection", (socket) => {
  if (verboseLoggingEnabled) {
    logger.info("Client connected:", socket.id);
  }

  try {
    const userId = String((socket.data as any)?.userId || "");
    if (userId) {
      socket.join(`user_${userId}`);
    }
  } catch (e) {
    logger.warn("[Socket] personal room join failed", e);
  }

  // Join rooms based on user role
  socket.on("join_room", (data) => {
    const { room, userId, userRole, token } = data || {};
    const roomStr = String(room || "");

    // Admin-only: joining admin_room requires a valid admin JWT.
    if (roomStr === "admin_room") {
      try {
        const provided =
          (typeof token === "string" && token.trim()) ||
          (typeof (socket.handshake as any)?.auth?.token === "string" && String((socket.handshake as any).auth.token).trim()) ||
          (typeof socket.handshake.headers?.authorization === "string" && String(socket.handshake.headers.authorization).replace(/^Bearer\s+/i, "").trim()) ||
          "";

        if (!provided) {
          logger.warn("[Socket] Admin join denied: missing token", { socketId: socket.id });
          return;
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          logger.warn("[Socket] Admin join denied: server misconfigured", { socketId: socket.id });
          return;
        }

        const decoded = jwt.verify(provided, jwtSecret) as any;
        const adminId = String(decoded?.userId || "");
        if (!adminId) {
          logger.warn("[Socket] Admin join denied: invalid token payload", { socketId: socket.id });
          return;
        }

        // Role check must be server authoritative.
        User.findById(adminId)
          .select("role")
          .then((u: any) => {
            if (!u || String(u.role) !== "admin") {
              logger.warn("[Socket] Admin join denied: role mismatch", { socketId: socket.id, adminId });
              return;
            }

            socket.join("admin_room");
            if (verboseLoggingEnabled) {
              logger.info(`✅ Admin ${adminId} joined admin_room`);
            }
          })
          .catch((e: any) => {
            logger.warn("[Socket] Admin join denied: user lookup failed", e);
          });
      } catch (e) {
        logger.warn("[Socket] Admin join denied: token verify failed", e);
      }
      return;
    }

    // Security hard rule: only admin_room is joinable via join_room.
    logger.warn("[Socket] join_room denied: only admin_room is allowed", {
      socketId: socket.id,
      room: roomStr,
      userId,
      userRole,
    });
    return;
  });

  // Customer: join order-specific room for live tracking
  socket.on("join_order_room", async (data) => {
    const { orderId, token } = data || {};
    const orderIdStr = String(orderId || "").trim();

    if (!orderIdStr) {
      logger.warn("[Socket] Customer join denied: missing orderId", { socketId: socket.id });
      return;
    }

    try {
      const provided =
        (typeof token === "string" && token.trim()) ||
        (typeof (socket.handshake as any)?.auth?.token === "string" && String((socket.handshake as any).auth.token).trim()) ||
        (typeof socket.handshake.headers?.authorization === "string" && String(socket.handshake.headers.authorization).replace(/^Bearer\s+/i, "").trim()) ||
        "";

      if (!provided) {
        logger.warn("[Socket] Customer join denied: missing token", { socketId: socket.id, orderId: orderIdStr });
        return;
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.warn("[Socket] Customer join denied: server misconfigured", { socketId: socket.id });
        return;
      }

      const decoded = jwt.verify(provided, jwtSecret) as any;
      const userId = String(decoded?.userId || "");
      if (!userId) {
        logger.warn("[Socket] Customer join denied: invalid token payload", { socketId: socket.id, orderId: orderIdStr });
        return;
      }

      // Verify user owns this order
      const order = await Order.findById(orderIdStr).select("user status").lean();
      if (!order) {
        logger.warn("[Socket] Customer join denied: order not found", { socketId: socket.id, orderId: orderIdStr });
        return;
      }

      if (String((order as any).user) !== userId) {
        logger.warn("[Socket] Customer join denied: not order owner", { socketId: socket.id, orderId: orderIdStr, userId });
        return;
      }

      // Join the order-specific room
      const roomName = `order:${orderIdStr}`;
      socket.join(roomName);
      if (verboseLoggingEnabled) {
        logger.info(`✅ Customer ${userId} joined ${roomName}`);
      }
    } catch (e) {
      logger.warn("[Socket] Customer join denied: error", e);
    }
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
      logger.info("Client disconnected:", socket.id);
    }
  });
});

// Start server
const PORT = process.env.PORT || 5001;

// Function to gracefully close existing server instances on a port (development only)
const closeExistingServer = async (port: number): Promise<void> => {
  if (NODE_ENV === "production") {
    return;
  }
  return;
};

const startServer = async () => {
  try {
    // Redis is MANDATORY in production - fail fast if unavailable
    logger.info("\n========================================");
    logger.info("🔌 Checking Redis connection...");
    logger.info("========================================");
    
    const redisCheck = await ensureRedisConnection();
    if (!redisCheck.connected) {
      logger.error("❌ Redis connection failed - exiting");
      process.exit(1);
    }
    
    await connectDB();

    // CRITICAL: MongoDB must run as replica set for transactions
    // Fail fast if transactions are not enabled (skip in test env for CI)
    async function assertTransactionsEnabled(): Promise<void> {
      // Skip replica set check in test environment (CI uses standalone MongoDB)
      if (process.env.NODE_ENV === "test") {
        logger.info("⚠️  Skipping replica set check in test environment");
        return;
      }
      try {
        if (!mongoose.connection.db) {
          throw new Error("MongoDB connection not established");
        }
        const admin = mongoose.connection.db.admin();
        await admin.command({ replSetGetStatus: 1 });
        logger.info("✅ MongoDB replica set detected - transactions enabled");
      } catch (err: any) {
        logger.error("\n❌ ═════════════════════════════════════════════════════════");
        logger.error("❌ FATAL: MongoDB must run as replica set for transactions.");
        logger.error("❌ Order creation, inventory reservation, and payment finalization");
        logger.error("❌ require atomic transactions to prevent data corruption.");
        logger.error("❌");
        logger.error("❌ To fix:");
        logger.error("❌   - Local: Start MongoDB with --replSet flag");
        logger.error("❌   - Atlas: Replica set is enabled by default");
        logger.error("❌ ═════════════════════════════════════════════════════════\n");
        process.exit(1);
      }
    }

    await assertTransactionsEnabled();

    // Skip background pollers in test environment to prevent open handles
    if (NODE_ENV !== "test") {
      // Start in-memory live location store timers (flush + TTL cleanup)
      liveLocationStore.start();

      initializeNotificationWriter();
      initializeOutboxDispatcher();
      initializeInventoryReservationSweeper();

      startStuckPaymentScanner();

      // Initialize payment reconciliation service (reconciles captured payments missed by webhook)
      initializePaymentReconciliation();

      // Bootstrap dev admin user in development
      await bootstrapDevAdmin();

      // Initialize Redis ZSET for delivery partner load tracking
      logger.info("🚚 Initializing delivery partner load tracking...");
      await deliveryPartnerLoadService.initializeLoads();

      // Start OrderEventBroadcaster polling for real-time sync
      logger.info("📡 Starting OrderEventBroadcaster polling...");
      orderEventBroadcaster.startPolling(5000); // Poll every 5 seconds
    }

    // Function to try starting server on a specific port
    const tryStartServer = (port: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if server is already listening
        if (server.listening) {
          logger.info(`✅ Server already running on port ${port}`);
          resolve();
          return;
        }

        const serverInstance = server.listen(port, () => {
          logger.info(`🚀 Server running on port ${port}`);
          logger.info(`🏥 Health check: /health`);
          resolve();
        });

        serverInstance.on("error", (err: any) => {
          if (err.code === "EADDRINUSE") {
            logger.info(
              `⚠️  Port ${port} in use, trying next available port...`
            );
            reject(err);
          } else {
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
      } catch (error: any) {
        if (error.code === "EADDRINUSE") {
          currentPort++;
          attempts++;
          if (attempts >= maxAttempts) {
            logger.error(
              `❌ Failed to find available port after ${maxAttempts} attempts`
            );
            process.exit(1);
          }
        } else {
          throw error; // Re-throw non-port-related errors
        }
      }
    }
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  server.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
});

process.on("unhandledRejection", (err) => {
  logger.error("[UNHANDLED_REJECTION]", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logger.error("[UNCAUGHT_EXCEPTION]", err);
  process.exit(1);
});

startServer();
