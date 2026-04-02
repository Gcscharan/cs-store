import { logger } from '../utils/logger';
import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  user?: any;
}

class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
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

  private setupMiddleware() {
    this.io.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace("Bearer ", "");

        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          return next(new Error("Authentication error: Server misconfigured"));
        }

        const decoded = jwt.verify(token, jwtSecret) as any;
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
          return next(new Error("Authentication error: User not found"));
        }

        (socket as AuthenticatedSocket).userId = user._id.toString();
        (socket as AuthenticatedSocket).user = user;
        next();
      } catch (error) {
        logger.error("Socket authentication error:", error);
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      const userId = authSocket.userId;

      if (userId) {
        logger.info(`🔌 User ${userId} connected via WebSocket`);
        this.connectedUsers.set(userId, socket.id);

        // Join user to their personal room
        socket.join(`user_${userId}`);
      }

      socket.on("disconnect", () => {
        if (userId) {
          logger.info(`🔌 User ${userId} disconnected from WebSocket`);
          this.connectedUsers.delete(userId);
        }
      });

      // Handle OTP verification requests
      socket.on("verify_otp", (data: any) => {
        logger.info("OTP verification request:", data);
        // This will be handled by the OTP controller
      });

      // Handle payment status requests
      socket.on("get_payment_status", (data: any) => {
        logger.info("Payment status request:", data);
        // This will be handled by the payment controller
      });
    });
  }

  // Send OTP to specific user
  sendOTPToUser(userId: string, otpData: any): boolean {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit("otp_delivered", otpData);
      logger.info(`📱 OTP sent to user ${userId} via WebSocket`);
      return true;
    }
    logger.info(`📱 User ${userId} not connected, OTP will be sent via SMS`);
    return false;
  }

  // Send OTP verification result
  sendOTPVerificationResult(userId: string, result: any): boolean {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit("otp_verification_result", result);
      logger.info(`✅ OTP verification result sent to user ${userId}`);
      return true;
    }
    return false;
  }

  // Send payment status update
  sendPaymentStatusUpdate(userId: string, status: any): boolean {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit("payment_status_update", status);
      logger.info(`💳 Payment status update sent to user ${userId}`);
      return true;
    }
    return false;
  }

  // Get connected users count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  // Get all connected users
  getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  // Send order status update to specific user
  sendOrderStatusUpdate(userId: string, data: { orderId: string; status: string; updatedAt?: string }): boolean {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit("order_status_updated", data);
      logger.info(`📦 Order status update sent to user ${userId}: ${data.status}`);
      return true;
    }
    return false;
  }

  // Send delivery location update to specific user
  sendDeliveryLocationUpdate(userId: string, data: {
    orderId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    timestamp: string;
  }): boolean {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit("delivery_location_updated", data);
      return true;
    }
    return false;
  }

  // Broadcast delivery location to user room (for multiple devices)
  broadcastDeliveryLocation(userId: string, data: any): void {
    this.io.to(`user_${userId}`).emit("delivery_location_updated", data);
  }
}

export default SocketService;
