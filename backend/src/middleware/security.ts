import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { body, validationResult } from "express-validator";
import { captureSecurityEvent, logger } from "../utils/logger";

interface ExtendedRequest extends Request {
  verifiedPayment?: any;
}

const isTestEnv = process.env.NODE_ENV === "test";
const noOpMiddleware = (req: Request, res: Response, next: NextFunction) => next();

// Global API rate limiter
export const apiLimiter = isTestEnv
  ? noOpMiddleware
  : rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 120,
      standardHeaders: true,
      legacyHeaders: false,
    });

/**
 * Security Middleware for CS Store
 * Implements security best practices and input validation
 */

// Rate limiting configurations
export const createRateLimit = (
  windowMs: number,
  max: number,
  message?: string,
  options?: {
    keyGenerator?: (req: Request) => string;
    skip?: (req: Request) => boolean;
    tag?: string;
  }
) => {
  if (isTestEnv) {
    return noOpMiddleware;
  }
  return rateLimit({
    windowMs,
    max,
    message:
      message || "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options?.keyGenerator,
    skip: options?.skip,
    handler: (req, res) => {
      const ip = req.ip || req.connection.remoteAddress || "unknown";
      const userId = (req as any).user?._id || "anonymous";
      const tag = options?.tag || "rate_limit";

      // Log rate limit breach
      logger.security(`Rate limit exceeded: ${tag}`, {
        ip,
        userId,
        path: req.path,
        method: req.method,
        tag,
      });

      // Send to Sentry with SECURITY tag
      captureSecurityEvent(`rate_limit_exceeded_${tag}`, "medium", {
        ip,
        userId,
        path: req.path,
        method: req.method,
      });

      res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests, please try again later.",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Specific rate limits for different endpoints

// Login: max 10 requests per 15 min per IP
export const loginRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  10, // 10 attempts
  "Too many login attempts, please try again later.",
  { tag: "login" }
);

// Signup: max 5 per hour per IP
export const signupRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  5, // 5 attempts
  "Too many signup attempts, please try again later.",
  { tag: "signup" }
);

// Checkout: max 20 per hour per user (or per IP if not authenticated)
export const checkoutRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  20, // 20 attempts
  "Too many checkout attempts, please try again later.",
  {
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?._id;
      if (userId) return `user_${userId}`;
      return req.ip || "unknown";
    },
    tag: "checkout",
  }
);

// Payment verification: strict limit - 5 per 5 min per user/IP
export const paymentVerificationRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  5, // 5 attempts
  "Too many payment verification attempts, please try again later.",
  {
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?._id;
      if (userId) return `payment_verify_user_${userId}`;
      return `payment_verify_ip_${req.ip || "unknown"}`;
    },
    tag: "payment_verification",
  }
);

// Legacy exports for backward compatibility
export const authRateLimit = loginRateLimit;
export const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  "Too many API requests, please try again later.",
  { tag: "api" }
);
export const paymentRateLimit = paymentVerificationRateLimit;

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      connectSrc: ["'self'", "https://api.razorpay.com", "wss:"],
      frameSrc: ["https://checkout.razorpay.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// Input sanitization middleware
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Buffer.isBuffer(obj)) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Remove undefined fields - they should not be sent
      if (value === undefined) {
        continue;
      }
      
      if (typeof value === "string") {
        // Remove potentially dangerous characters but preserve empty strings
        // Controllers will validate and reject empty strings explicitly
        let sanitizedValue = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, "");
        
        // Preserve empty strings so controllers can validate and return 400
        sanitized[key] = sanitizedValue;
      } else if (typeof value === "object" && value !== null) {
        // Recursively sanitize nested objects
        const nested = sanitizeObject(value);
        // Only include nested object if it has properties after sanitization
        if (Object.keys(nested).length > 0) {
          sanitized[key] = nested;
        }
      } else {
        // Keep non-string, non-object values as-is (numbers, booleans, null)
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  if (req.body) {
    if (!Buffer.isBuffer(req.body)) {
      req.body = sanitizeObject(req.body);
    }
  }
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Razorpay signature verification
export const verifyRazorpaySignature = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  const { razorpay_signature, razorpay_payment_id, razorpay_order_id } =
    req.body;

  if (!razorpay_signature || !razorpay_payment_id || !razorpay_order_id) {
    return res.status(400).json({
      error: "Missing required Razorpay parameters",
    });
  }

  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!razorpayKeySecret) {
    logger.error("RAZORPAY_KEY_SECRET not configured");
    return res.status(500).json({
      error: "Payment verification not configured",
    });
  }

  try {
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      logger.warn("Invalid Razorpay signature:", {
        expected: expectedSignature,
        received: razorpay_signature,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
      });

      return res.status(400).json({
        error: "Invalid payment signature",
      });
    }

    // Add verified payment data to request
    req.verifiedPayment = {
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    };

    next();
  } catch (error) {
    logger.error("Razorpay signature verification error:", error);
    res.status(500).json({
      error: "Payment verification failed",
    });
  }
};

// Input validation middleware
export const validateInput = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

// Common validation rules
export const userValidationRules = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("Name can only contain letters and spaces"),

  body("email").isEmail().normalizeEmail().withMessage("Invalid email format"),

  body("phone")
    .isMobilePhone("en-IN")
    .withMessage("Invalid phone number format"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),
];

export const addressValidationRules = [
  body("addresses.*.pincode")
    .isPostalCode("IN")
    .withMessage("Invalid pincode format"),

  body("addresses.*.city")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("City must be between 2 and 50 characters"),

  body("addresses.*.state")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("State must be between 2 and 50 characters"),

  body("addresses.*.addressLine")
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage("Address must be between 10 and 200 characters"),
];

export const productValidationRules = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Product name must be between 2 and 100 characters"),

  body("price")
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  body("stock")
    .isInt({ min: 0 })
    .withMessage("Stock must be a non-negative integer"),

  body("category")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Category must be between 2 and 50 characters"),
];

// Security logging middleware
export const securityLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  // Log security-relevant events
  const logSecurityEvent = (event: string, details: any) => {
    logger.info(`[SECURITY] ${event}:`, {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      url: req.url,
      method: req.method,
      details,
    });
  };

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function (body: any) {
    const duration = Date.now() - startTime;

    // Log failed authentication attempts
    if (req.url.includes("/auth/login") && res.statusCode === 401) {
      logSecurityEvent("FAILED_LOGIN_ATTEMPT", {
        email: req.body?.email,
        duration,
      });
    }

    // Log payment failures
    if (req.url.includes("/payment") && res.statusCode >= 400) {
      logSecurityEvent("PAYMENT_FAILURE", {
        orderId: req.body?.orderId,
        amount: req.body?.amount,
        duration,
      });
    }

    // Log admin actions
    if (req.url.includes("/admin") && req.user) {
      logSecurityEvent("ADMIN_ACTION", {
        userId: (req.user as any)?._id,
        action: req.method,
        duration,
      });
    }

    return originalJson.call(this, body);
  };

  next();
};

// Request size limiter
export const requestSizeLimit = (limit: string = "10mb") => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const contentLength = parseInt(req.get("content-length") || "0");
    const maxSize = parseInt(limit.replace("mb", "")) * 1024 * 1024;

    if (contentLength > maxSize) {
      return res.status(413).json({
        error: "Request too large",
        message: `Request size exceeds ${limit} limit`,
      });
    }

    next();
  };
};

// CORS configuration
export const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    const allowedOrigins = [
      ...(process.env.NODE_ENV === "production"
        ? []
        : ["http://localhost:5173", "http://localhost:3000"]),
      "https://cpsstore.com",
      "https://www.cpsstore.com",
      process.env.FRONTEND_URL || "",
      ...String(process.env.CORS_ORIGIN || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

export default {
  createRateLimit,
  authRateLimit,
  apiRateLimit,
  paymentRateLimit,
  securityHeaders,
  sanitizeInput,
  verifyRazorpaySignature,
  validateInput,
  userValidationRules,
  addressValidationRules,
  productValidationRules,
  securityLogger,
  requestSizeLimit,
  corsOptions,
};
