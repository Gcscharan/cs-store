"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const app_1 = __importDefault(require("./app"));
const database_1 = require("./utils/database");
const bootstrapDevAdmin_1 = require("./scripts/bootstrapDevAdmin");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const server = (0, http_1.createServer)(app_1.default);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://localhost:3001",
            process.env.FRONTEND_URL || "http://localhost:3000",
        ],
        methods: ["GET", "POST"],
        credentials: true,
    },
});
app_1.default.set("io", io);
io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    socket.on("join_room", (data) => {
        const { room, userId, userRole } = data;
        socket.join(room);
        console.log(`User ${userId} (${userRole}) joined room: ${room}`);
        if (userRole === "admin") {
            socket.join("admin_room");
        }
    });
    socket.on("order_status_update", (data) => {
        const { orderId, status } = data;
        io.to(`order_${orderId}`).emit("order:status:update", { orderId, status });
        io.to("admin_room").emit("order:status:update", { orderId, status });
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
        io.to("admin_room").emit("driver:location:update", {
            driverId,
            lat,
            lng,
            speed,
            eta,
        });
    });
    socket.on("order_created", (data) => {
        const { orderId } = data;
        io.to("admin_room").emit("order:created", { orderId });
    });
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
const PORT = process.env.PORT || 5001;
const closeExistingServer = async (port) => {
    try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout
            .trim()
            .split("\n")
            .filter((pid) => pid);
        if (pids.length > 0) {
            console.log(`🔄 Found existing processes on port ${port}, closing them gracefully...`);
            for (const pid of pids) {
                try {
                    await execAsync(`kill -TERM ${pid}`);
                    console.log(`📤 Sent SIGTERM to process ${pid}`);
                }
                catch (err) {
                    console.log(`⚠️  Could not send SIGTERM to process ${pid}`);
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 2000));
            try {
                const { stdout: remainingPids } = await execAsync(`lsof -ti:${port}`);
                const stillRunning = remainingPids
                    .trim()
                    .split("\n")
                    .filter((pid) => pid);
                if (stillRunning.length > 0) {
                    console.log(`🔨 Force closing remaining processes on port ${port}...`);
                    for (const pid of stillRunning) {
                        try {
                            await execAsync(`kill -9 ${pid}`);
                            console.log(`💥 Force killed process ${pid}`);
                        }
                        catch (err) {
                            console.log(`⚠️  Could not force kill process ${pid}`);
                        }
                    }
                }
            }
            catch (err) {
            }
            console.log(`✅ Port ${port} is now available`);
        }
    }
    catch (err) {
        console.log(`✅ Port ${port} is available`);
    }
};
const startServer = async () => {
    try {
        await (0, database_1.connectDB)();
        await (0, bootstrapDevAdmin_1.bootstrapDevAdmin)();
        const tryStartServer = (port) => {
            return new Promise((resolve, reject) => {
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
                serverInstance.on("error", (err) => {
                    if (err.code === "EADDRINUSE") {
                        console.log(`⚠️  Port ${port} in use, trying next available port...`);
                        reject(err);
                    }
                    else {
                        reject(err);
                    }
                });
            });
        };
        let currentPort = parseInt(PORT.toString());
        const maxAttempts = 5;
        let attempts = 0;
        while (attempts < maxAttempts) {
            try {
                if (attempts === 0) {
                    await closeExistingServer(currentPort);
                }
                await tryStartServer(currentPort);
                break;
            }
            catch (error) {
                if (error.code === "EADDRINUSE") {
                    currentPort++;
                    attempts++;
                    if (attempts >= maxAttempts) {
                        console.error(`❌ Failed to find available port after ${maxAttempts} attempts`);
                        process.exit(1);
                    }
                }
                else {
                    throw error;
                }
            }
        }
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};
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
//# sourceMappingURL=index.js.map