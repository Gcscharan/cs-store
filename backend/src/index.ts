// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

// Comprehensive Environment Variable Validation
function validateEnvironmentVariables() {
  const errors: string[] = [];
  
  // Database
  if (!process.env.MONGODB_URI) {
    errors.push("❌ MONGODB_URI is required");
  }
  
  // JWT Secrets
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push(`❌ JWT_SECRET must be at least 32 characters long. Current length: ${process.env.JWT_SECRET?.length || 0}`);
  }
  
  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    errors.push(`❌ JWT_REFRESH_SECRET must be at least 32 characters long. Current length: ${process.env.JWT_REFRESH_SECRET?.length || 0}`);
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
    errors.push("⚠️  REDIS_URL is recommended (using localhost fallback)");
  }
  
  // Frontend
  if (!process.env.FRONTEND_URL) {
    errors.push("⚠️  FRONTEND_URL is recommended (using localhost fallback)");
  }
  
  // Razorpay
  if (!process.env.RAZORPAY_KEY_ID) {
    errors.push("⚠️  RAZORPAY_KEY_ID is recommended");
  }
  
  if (!process.env.RAZORPAY_KEY_SECRET) {
    errors.push("⚠️  RAZORPAY_KEY_SECRET is recommended");
  }
  
  // Google OAuth
  if (!process.env.GOOGLE_CLIENT_ID) {
    errors.push("⚠️  GOOGLE_CLIENT_ID is recommended for OAuth login");
  }
  
  if (!process.env.GOOGLE_CLIENT_SECRET) {
    errors.push("⚠️  GOOGLE_CLIENT_SECRET is recommended for OAuth login");
  }
  
  // Critical errors that prevent startup
  const criticalErrors = errors.filter(err => err.startsWith("❌"));
  const warnings = errors.filter(err => err.startsWith("⚠️"));
  
  if (criticalErrors.length > 0) {
    console.error("\n🚨 CRITICAL ENVIRONMENT ERRORS:");
    criticalErrors.forEach(err => console.error(err));
    console.error("\n❌ Server cannot start due to critical configuration errors.");
    console.error("❌ Please check your .env file and restart the server.\n");
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.warn("\n⚠️  Environment warnings:");
    warnings.forEach(warn => console.warn(warn));
    console.warn("⚠️  Consider adding these variables for full functionality.\n");
  }
  
  console.log("✅ Environment variables validated successfully");
}

// Run validation immediately after dotenv config
validateEnvironmentVariables();

// Validate critical environment variables immediately
console.log("\n========================================");
console.log("🔧 Environment Variables Check");
console.log("========================================");
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log(`🚪 PORT: ${process.env.PORT || "5001"}`);
console.log(`🔗 MONGODB_URI present: ${process.env.MONGODB_URI ? "✅ Yes" : "❌ NO"}`);
console.log(`🔑 JWT_SECRET present: ${process.env.JWT_SECRET ? "✅ Yes" : "❌ NO"}`);
console.log(`🔑 JWT_REFRESH_SECRET present: ${process.env.JWT_REFRESH_SECRET ? "✅ Yes" : "❌ NO"}`);
console.log(`☁️ CLOUDINARY_CLOUD_NAME present: ${process.env.CLOUDINARY_CLOUD_NAME ? "✅ Yes" : "❌ NO"}`);
console.log(`📧 MOCK_OTP: ${process.env.MOCK_OTP || "false"}`);
console.log("[ENV][SMS] FAST2SMS key loaded:", !!process.env.FAST2SMS_API_KEY);

// Check FAST2SMS API key validity
if (process.env.FAST2SMS_API_KEY && process.env.FAST2SMS_API_KEY.length < 20) {
   console.warn("[SMS][WARN] FAST2SMS_API_KEY appears invalid.");
}
console.log("========================================\n");

import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app";
import { connectDB } from "./utils/database";
import { bootstrapDevAdmin } from "./scripts/bootstrapDevAdmin";
// import SocketService from "./services/socketService";
import { exec } from "child_process";
import { promisify } from "util";
import {
  LiveLocationStore,
  smoothMarkerMovement,
} from "./utils/locationSmoothing";
import { DeliveryBoy } from "./models/DeliveryBoy";
import { deliveryPartnerLoadService } from "./domains/operations/services/deliveryPartnerLoadService";

const execAsync = promisify(exec);

// Initialize live location store for smooth tracking
const liveLocationStore = new LiveLocationStore();

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173", // Vite default port
      process.env.FRONTEND_URL || "http://localhost:3000",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize Socket Service for OTP (disabled for now)
// const socketService = new SocketService(server);

// Store socket.io instance in app for webhook access
app.set("io", io);
// app.set("socketService", socketService);

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join rooms based on user role
  socket.on("join_room", (data) => {
    const { room, userId, userRole } = data;
    socket.join(room);
    console.log(`User ${userId} (${userRole}) joined room: ${room}`);

    // Join admin room if user is admin
    if (userRole === "admin") {
      socket.join("admin_room");
    }
  });

  // Handle order status updates
  socket.on("order_status_update", (data) => {
    const { orderId, status } = data;
    io.to(`order_${orderId}`).emit("order:status:update", { orderId, status });
    io.to("admin_room").emit("order:status:update", { orderId, status });
  });

  // Handle driver location updates with smooth tracking
  socket.on("driver_location_update", async (data) => {
    const { driverId, lat, lng } = data;

    try {
      // Update location in live store with smoothing and throttling
      const smoothedLocation = liveLocationStore.updateLocation(driverId, {
        lat,
        lng,
        timestamp: Date.now(),
      });

      // Only broadcast if throttle allows (every 3 seconds)
      if (smoothedLocation) {
        // Get delivery boy's active route
        const deliveryBoy = await DeliveryBoy.findById(driverId)
          .select("activeRoute currentLocation assignedOrders")
          .lean();

        // Generate smooth path for animation
        const oldLocation = deliveryBoy?.currentLocation || { lat, lng };
        const smoothPath = smoothMarkerMovement(
          oldLocation,
          { lat: smoothedLocation.lat, lng: smoothedLocation.lng },
          10 // 10 interpolation steps
        );

        const updateData = {
          driverId,
          lat: smoothedLocation.lat,
          lng: smoothedLocation.lng,
          speed: smoothedLocation.speed || 0,
          heading: smoothedLocation.heading || 0,
          smoothPath, // Array of intermediate positions for smooth animation
          activeRoute: deliveryBoy?.activeRoute?.polyline || null,
          destination: deliveryBoy?.activeRoute?.destination || null,
          eta: deliveryBoy?.activeRoute?.estimatedArrival || null,
          timestamp: smoothedLocation.timestamp,
        };

        // Emit to driver's room
        io.to(`driver_${driverId}`).emit("driver:location:update", updateData);

        // Emit to admin room for tracking
        io.to("admin_room").emit("driver:location:update", updateData);

        // Emit to order rooms for customers tracking their delivery
        if (deliveryBoy?.assignedOrders) {
          deliveryBoy.assignedOrders.forEach((orderId: any) => {
            io.to(`order_${orderId}`).emit(
              "driver:location:update",
              updateData
            );
          });
        }

        // Update database every 30 seconds (batch update to reduce DB writes)
        // This is handled by a separate periodic task
      }
    } catch (error) {
      console.error("Error processing driver location update:", error);
    }
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
    console.log("Client disconnected:", socket.id);
  });
});

// Periodic task to batch update delivery boy locations in database
// Runs every 30 seconds to reduce DB write load
setInterval(async () => {
  try {
    const activeDeliveryBoys = liveLocationStore.getActiveDeliveryBoys();

    for (const deliveryBoyId of activeDeliveryBoys) {
      const location = liveLocationStore.getLocation(deliveryBoyId);

      if (location) {
        await DeliveryBoy.findByIdAndUpdate(
          deliveryBoyId,
          {
            $set: {
              "currentLocation.lat": location.lat,
              "currentLocation.lng": location.lng,
              "currentLocation.lastUpdatedAt": new Date(
                location.timestamp || Date.now()
              ),
            },
          },
          { new: false }
        );
      }
    }

    if (activeDeliveryBoys.length > 0) {
      console.log(
        `✅ Batch updated ${activeDeliveryBoys.length} delivery boy locations`
      );
    }
  } catch (error) {
    console.error("Error in batch location update:", error);
  }
}, 30000); // 30 seconds

// Start server
const PORT = process.env.PORT || 5001;

// Function to gracefully close existing server instances on a port
const closeExistingServer = async (port: number): Promise<void> => {
  try {
    // Find processes using the port
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    const pids = stdout
      .trim()
      .split("\n")
      .filter((pid) => pid);

    if (pids.length > 0) {
      console.log(
        `🔄 Found existing processes on port ${port}, closing them gracefully...`
      );

      // Try graceful shutdown first (SIGTERM)
      for (const pid of pids) {
        try {
          await execAsync(`kill -TERM ${pid}`);
          console.log(`📤 Sent SIGTERM to process ${pid}`);
        } catch (err) {
          console.log(`⚠️  Could not send SIGTERM to process ${pid}`);
        }
      }

      // Wait a bit for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check if processes are still running and force kill if needed
      try {
        const { stdout: remainingPids } = await execAsync(`lsof -ti:${port}`);
        const stillRunning = remainingPids
          .trim()
          .split("\n")
          .filter((pid) => pid);

        if (stillRunning.length > 0) {
          console.log(
            `🔨 Force closing remaining processes on port ${port}...`
          );
          for (const pid of stillRunning) {
            try {
              await execAsync(`kill -9 ${pid}`);
              console.log(`💥 Force killed process ${pid}`);
            } catch (err) {
              console.log(`⚠️  Could not force kill process ${pid}`);
            }
          }
        }
      } catch (err) {
        // No processes found, port is free
      }

      console.log(`✅ Port ${port} is now available`);
    }
  } catch (err) {
    // No processes found on this port, which is fine
    console.log(`✅ Port ${port} is available`);
  }
};

const startServer = async () => {
  try {
    await connectDB();

    // Bootstrap dev admin user in development
    await bootstrapDevAdmin();

    // Initialize Redis ZSET for delivery partner load tracking
    console.log("🚚 Initializing delivery partner load tracking...");
    await deliveryPartnerLoadService.initializeLoads();

    // Function to try starting server on a specific port
    const tryStartServer = (port: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if server is already listening
        if (server.listening) {
          console.log(`✅ Server already running on port ${port}`);
          resolve();
          return;
        }

        const serverInstance = server.listen(port, () => {
          console.log(`🚀 Server running on port ${port}`);
          console.log(`🏥 Health check: http://localhost:${port}/health`);
          resolve();
        });

        serverInstance.on("error", (err: any) => {
          if (err.code === "EADDRINUSE") {
            console.log(
              `⚠️  Port ${port} in use, trying next available port...`
            );
            reject(err);
          } else {
            reject(err);
          }
        });
      });
    };

    // Try to start server on the specified port, then try next ports if needed
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
            console.error(
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
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

// Prevent multiple servers
if (process.env.NODE_ENV !== "production") {
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
  });
}

startServer();
