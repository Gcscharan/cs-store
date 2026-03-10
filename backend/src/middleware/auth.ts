import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import mongoose from "mongoose";

interface AuthRequest extends Request {
  user?: any;
  file?: any; // For multer file uploads
}

interface GoogleAuthOnlyClaims {
  authState: "GOOGLE_AUTH_ONLY";
  email: string;
  provider?: string;
  providerId?: string;
  name?: string;
}

// Export the interface for use in other files
export { AuthRequest };

export const authenticateGoogleAuthOnly = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ message: "Server misconfigured" });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, jwtSecret) as any;

    // GOOGLE_AUTH_ONLY onboarding sessions must NOT be treated as ACTIVE auth.
    // They do not correspond to a persisted user yet.
    if (decoded?.authState === "GOOGLE_AUTH_ONLY" && decoded?.email) {
      (req as any).googleAuthOnly = decoded as GoogleAuthOnlyClaims;
      return next();
    }

    if (decoded?.authState !== "GOOGLE_AUTH_ONLY" || !decoded?.email) {
      return res.status(403).json({ message: "Invalid onboarding session" });
    }

    (req as any).googleAuthOnly = decoded as GoogleAuthOnlyClaims;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ message: "Server misconfigured" });
    }

    const debug = process.env.NODE_ENV !== "production";
    if (debug) console.log('[Auth] authenticateToken - starting');
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (debug) console.log('[Auth] authenticateToken - authHeader exists:', !!authHeader);
    if (debug) console.log('[Auth] authenticateToken - token exists:', !!token);

    if (!token) {
      if (debug) console.log('[Auth] authenticateToken - no token, returning 401');
      return res.status(401).json({ message: "Authentication required" });
    }

    // Check if token is blacklisted
    try {
      const redisClient = require('../config/redis').default;
      const isBlacklisted = await redisClient.get(`blacklist:access:${token}`);
      if (isBlacklisted) {
        if (debug) console.log('[Auth] authenticateToken - token blacklisted, returning 401');
        return res.status(401).json({ message: "Token revoked - please login again", code: "TOKEN_REVOKED" });
      }
    } catch (redisError) {
      // Redis not available, proceed with token verification
    }

    const decoded = jwt.verify(token, jwtSecret) as any;

    if (debug) console.log('[Auth] authenticateToken - token decoded, userId:', decoded.userId);

    if (!mongoose.Types.ObjectId.isValid(decoded.userId)) {
      return res.status(401).json({ message: "Invalid userId in token", code: "INVALID_USERID" });
    }
    
    const user = await User.findById(decoded.userId).select("-passwordHash");
    if (debug) console.log('[Auth] authenticateToken - user found:', !!user);
    if (debug && user) {
      console.log('[Auth] authenticateToken - user._id:', user._id);
    }

    if (!user) {
      if (debug) console.log('[Auth] authenticateToken - user not found, returning 404');
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user account is active
    if (user.status === 'suspended') {
      if (debug) console.log('[Auth] authenticateToken - user suspended, returning 403');
      return res.status(403).json({ message: "Account suspended" });
    }

    // Set both user object and userId for compatibility
    req.user = user;
    (req as any).userId = user._id.toString();
    if (debug) console.log('[Auth] authenticateToken - req.user set, calling next()');
    
    next();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.log('[Auth] authenticateToken - error:', error);
    }

    if (error instanceof jwt.JsonWebTokenError) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(401).json({ message: error.message, code: "INVALID_TOKEN" });
      }
    }
    
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireRole = (roles: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Response | void => {
    const debug = process.env.NODE_ENV !== "production";
    if (debug) console.log('[Auth] requireRole - checking roles:', roles);
    if (debug) console.log('[Auth] requireRole - req.user exists:', !!req.user);
    if (debug && req.user) {
      console.log('[Auth] requireRole - user role:', req.user.role);
      console.log('[Auth] requireRole - role check:', roles.includes(req.user.role));
    }
    
    if (!req.user) {
      if (debug) console.log('[Auth] requireRole - no req.user, returning 401');
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      if (debug) console.log('[Auth] requireRole - role not allowed, returning 403');

      const normalizedRoles = (roles || [])
        .map((r) => String(r || "").trim())
        .filter(Boolean);

      const roleLabel = (r: string): string =>
        r.length > 0 ? r.charAt(0).toUpperCase() + r.slice(1) : r;

      const message =
        normalizedRoles.length === 1
          ? `${roleLabel(normalizedRoles[0])} role required`
          : `One of the following roles required: ${normalizedRoles.join(", ")}`;

      return res.status(403).json({ message });
    }

    if (debug) console.log('[Auth] requireRole - role check passed, calling next()');
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
