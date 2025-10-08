"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const database_1 = require("./utils/database");
const server = (0, http_1.createServer)(app_1.default);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
    },
});
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("join_room", (data) => {
        const { room, userId } = data;
        socket.join(room);
        console.log(`User ${userId} joined room: ${room}`);
    });
    socket.on("order_status_update", (data) => {
        const { orderId, status } = data;
        io.to(`order_${orderId}`).emit("order:status:update", { orderId, status });
    });
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
const PORT = process.env.PORT || 5000;
const startServer = async () => {
    try {
        await (0, database_1.connectDB)();
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};
startServer();
//# sourceMappingURL=index.js.map