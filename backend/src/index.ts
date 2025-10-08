import { createServer } from "http";
import { Server } from "socket.io";
import app from "./app";
import { connectDB } from "./utils/database";

// Create HTTP server
const server = createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Store socket.io instance in app for webhook access
app.set("io", io);

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

  // Handle driver location updates
  socket.on("driver_location_update", (data) => {
    const { driverId, lat, lng, speed, eta } = data;
    io.to(`driver_${driverId}`).emit("driver:location:update", {
      driverId,
      lat,
      lng,
      speed,
      eta,
    });

    // Emit to admin room for tracking
    io.to("admin_room").emit("driver:location:update", {
      driverId,
      lat,
      lng,
      speed,
      eta,
    });
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

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
