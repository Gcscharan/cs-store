import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

interface AuthRequest extends Request {
  user?: any;
  file?: any; // For multer file uploads
}

// Export the interface for use in other files
export { AuthRequest };

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Check if token is blacklisted
    try {
      const redisClient = require('../config/redis').default;
      const isBlacklisted = await redisClient.get(`blacklist:access:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ message: "Token revoked - please login again", code: "TOKEN_REVOKED" });
      }
    } catch (redisError) {
      // Redis not available, proceed with token verification
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as any;
    
    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user account is active
    if (user.status === 'suspended') {
      return res.status(403).json({ message: "Account suspended" });
    }

    // Set both user object and userId for compatibility
    req.user = user;
    (req as any).userId = user._id.toString();
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      if (error.name === 'TokenExpiredError') {
        return res.status(403).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(403).json({ message: "Invalid token format", code: "INVALID_TOKEN" });
      }
    }
    
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

export const requireRole = (roles: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Response | void => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }

    next();
  };
};

// Specific middleware for delivery role
export const requireDeliveryRole = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.role !== "delivery") {
    return res
      .status(403)
      .json({ message: "Access denied. Delivery role required." });
  }

  next();
};
