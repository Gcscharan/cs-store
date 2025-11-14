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

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "your-secret-key"
        ) as any;
        const user = await User.findById(decoded.userId).select("-password");

        if (!user) {
          return next(new Error("Authentication error: User not found"));
        }

        (socket as AuthenticatedSocket).userId = user._id.toString();
        (socket as AuthenticatedSocket).user = user;
        next();
      } catch (error) {
        console.error("Socket authentication error:", error);
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: Socket) => {
      const authSocket = socket as AuthenticatedSocket;
      const userId = authSocket.userId;

      if (userId) {
        console.log(`🔌 User ${userId} connected via WebSocket`);
        this.connectedUsers.set(userId, socket.id);

        // Join user to their personal room
        socket.join(`user_${userId}`);
      }

      socket.on("disconnect", () => {
        if (userId) {
          console.log(`🔌 User ${userId} disconnected from WebSocket`);
          this.connectedUsers.delete(userId);
        }
      });

      // Handle OTP verification requests
      socket.on("verify_otp", (data: any) => {
        console.log("OTP verification request:", data);
        // This will be handled by the OTP controller
      });

      // Handle payment status requests
      socket.on("get_payment_status", (data: any) => {
        console.log("Payment status request:", data);
        // This will be handled by the payment controller
      });
    });
  }

  // Send OTP to specific user
  sendOTPToUser(userId: string, otpData: any): boolean {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit("otp_delivered", otpData);
      console.log(`📱 OTP sent to user ${userId} via WebSocket`);
      return true;
    }
    console.log(`📱 User ${userId} not connected, OTP will be sent via SMS`);
    return false;
  }

  // Send OTP verification result
  sendOTPVerificationResult(userId: string, result: any): boolean {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit("otp_verification_result", result);
      console.log(`✅ OTP verification result sent to user ${userId}`);
      return true;
    }
    return false;
  }

  // Send payment status update
  sendPaymentStatusUpdate(userId: string, status: any): boolean {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit("payment_status_update", status);
      console.log(`💳 Payment status update sent to user ${userId}`);
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
}

export default SocketService;
