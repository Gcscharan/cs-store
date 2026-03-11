"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
class SocketService {
    constructor(server) {
        this.connectedUsers = new Map(); // userId -> socketId
        this.io = new socket_io_1.Server(server, {
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
        this.setupMiddleware();
        this.setupEventHandlers();
    }
    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token ||
                    socket.handshake.headers.authorization?.replace("Bearer ", "");
                if (!token) {
                    return next(new Error("Authentication error: No token provided"));
                }
                const jwtSecret = process.env.JWT_SECRET;
                if (!jwtSecret) {
                    return next(new Error("Authentication error: Server misconfigured"));
                }
                const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
                const user = await User_1.User.findById(decoded.userId).select("-password");
                if (!user) {
                    return next(new Error("Authentication error: User not found"));
                }
                socket.userId = user._id.toString();
                socket.user = user;
                next();
            }
            catch (error) {
                logger_1.logger.error("Socket authentication error:", error);
                next(new Error("Authentication error: Invalid token"));
            }
        });
    }
    setupEventHandlers() {
        this.io.on("connection", (socket) => {
            const authSocket = socket;
            const userId = authSocket.userId;
            if (userId) {
                logger_1.logger.info(`🔌 User ${userId} connected via WebSocket`);
                this.connectedUsers.set(userId, socket.id);
                // Join user to their personal room
                socket.join(`user_${userId}`);
            }
            socket.on("disconnect", () => {
                if (userId) {
                    logger_1.logger.info(`🔌 User ${userId} disconnected from WebSocket`);
                    this.connectedUsers.delete(userId);
                }
            });
            // Handle OTP verification requests
            socket.on("verify_otp", (data) => {
                logger_1.logger.info("OTP verification request:", data);
                // This will be handled by the OTP controller
            });
            // Handle payment status requests
            socket.on("get_payment_status", (data) => {
                logger_1.logger.info("Payment status request:", data);
                // This will be handled by the payment controller
            });
        });
    }
    // Send OTP to specific user
    sendOTPToUser(userId, otpData) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(socketId).emit("otp_delivered", otpData);
            logger_1.logger.info(`📱 OTP sent to user ${userId} via WebSocket`);
            return true;
        }
        logger_1.logger.info(`📱 User ${userId} not connected, OTP will be sent via SMS`);
        return false;
    }
    // Send OTP verification result
    sendOTPVerificationResult(userId, result) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(socketId).emit("otp_verification_result", result);
            logger_1.logger.info(`✅ OTP verification result sent to user ${userId}`);
            return true;
        }
        return false;
    }
    // Send payment status update
    sendPaymentStatusUpdate(userId, status) {
        const socketId = this.connectedUsers.get(userId);
        if (socketId) {
            this.io.to(socketId).emit("payment_status_update", status);
            logger_1.logger.info(`💳 Payment status update sent to user ${userId}`);
            return true;
        }
        return false;
    }
    // Get connected users count
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }
    // Get all connected users
    getConnectedUsers() {
        return Array.from(this.connectedUsers.keys());
    }
}
exports.default = SocketService;
