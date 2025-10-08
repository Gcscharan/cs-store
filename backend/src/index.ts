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

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join rooms based on user role
  socket.on("join_room", (data) => {
    const { room, userId } = data;
    socket.join(room);
    console.log(`User ${userId} joined room: ${room}`);
  });

  // Handle order status updates
  socket.on("order_status_update", (data) => {
    const { orderId, status } = data;
    io.to(`order_${orderId}`).emit("order:status:update", { orderId, status });
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
