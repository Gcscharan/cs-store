import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

interface AuthRequest extends Request {
  user?: any;
}

// Export the interface for use in other files
export { AuthRequest };

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    console.log('🔐 AUTH MIDDLEWARE: Starting token authentication');
    console.log('🔐 AUTH MIDDLEWARE: Headers:', {
      authorization: req.headers.authorization ? 'present' : 'missing',
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']
    });

    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      console.log('❌ AUTH MIDDLEWARE: No token provided');
      return res.status(401).json({ error: "Access token required" });
    }

    console.log('🔐 AUTH MIDDLEWARE: Token found, verifying...');
    console.log('🔐 AUTH MIDDLEWARE: JWT_SECRET exists:', !!process.env.JWT_SECRET);

    // Check if token is blacklisted
    try {
      const redisClient = require('../config/redis').default;
      const isBlacklisted = await redisClient.get(`blacklist:access:${token}`);
      if (isBlacklisted) {
        console.log('❌ AUTH MIDDLEWARE: Token is blacklisted (logged out)');
        return res.status(401).json({ error: "Token revoked - please login again", code: "TOKEN_REVOKED" });
      }
    } catch (redisError) {
      console.warn('⚠️ AUTH MIDDLEWARE: Redis blacklist check failed, proceeding with token verification');
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as any;
    
    console.log('✅ AUTH MIDDLEWARE: Token decoded successfully:', {
      userId: decoded.userId,
      email: decoded.email,
      exp: decoded.exp,
      iat: decoded.iat
    });

    const user = await User.findById(decoded.userId).select("-passwordHash");

    if (!user) {
      console.log('❌ AUTH MIDDLEWARE: User not found in database:', decoded.userId);
      return res.status(404).json({ error: "User not found" });
    }

    console.log('✅ AUTH MIDDLEWARE: User found:', {
      userId: user._id,
      email: user.email,
      role: user.role,
      status: user.status
    });

    // Check if user account is active
    if (user.status === 'suspended') {
      console.log('❌ AUTH MIDDLEWARE: User account suspended');
      return res.status(403).json({ error: "Account suspended" });
    }

    // Set both user object and userId for compatibility
    req.user = user;
    (req as any).userId = user._id.toString();
    
    console.log('✅ AUTH MIDDLEWARE: Authentication successful, proceeding to next middleware');
    next();
  } catch (error) {
    console.log('❌ AUTH MIDDLEWARE: Token verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : 'No stack'
    });
    
    if (error instanceof jwt.JsonWebTokenError) {
      if (error.name === 'TokenExpiredError') {
        console.log('❌ AUTH MIDDLEWARE: Token expired');
        return res.status(403).json({ error: "Token expired", code: "TOKEN_EXPIRED" });
      } else if (error.name === 'JsonWebTokenError') {
        console.log('❌ AUTH MIDDLEWARE: Invalid token format');
        return res.status(403).json({ error: "Invalid token format", code: "INVALID_TOKEN" });
      }
    }
    
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

export const requireRole = (roles: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Response | void => {
    console.log('🔒 ROLE CHECK: Starting role validation');
    console.log('🔒 ROLE CHECK: Required roles:', roles);
    console.log('🔒 ROLE CHECK: User exists:', !!req.user);
    
    if (!req.user) {
      console.log('❌ ROLE CHECK: No user found in request');
      return res.status(401).json({ error: "Authentication required" });
    }

    console.log('🔒 ROLE CHECK: User role:', req.user.role);
    console.log('🔒 ROLE CHECK: Role included in allowed roles:', roles.includes(req.user.role));

    if (!roles.includes(req.user.role)) {
      console.log('❌ ROLE CHECK: Role validation failed');
      console.log('❌ ROLE CHECK: User role not in allowed roles:', {
        userRole: req.user.role,
        allowedRoles: roles,
        comparison: roles.map(role => ({ role, matches: role === req.user.role }))
      });
      return res.status(403).json({ 
        error: "Insufficient permissions", 
        code: "ROLE_NOT_ALLOWED",
        details: {
          userRole: req.user.role,
          requiredRoles: roles
        }
      });
    }

    console.log('✅ ROLE CHECK: Role validation successful, proceeding');
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
    return res.status(401).json({ error: "Authentication required" });
  }

  if (req.user.role !== "delivery") {
    return res
      .status(403)
      .json({ error: "Access denied. Delivery role required." });
  }

  next();
};
