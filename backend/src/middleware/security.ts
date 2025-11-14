import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { body, validationResult } from "express-validator";

interface ExtendedRequest extends Request {
  verifiedPayment?: any;
}

/**
 * Security Middleware for CS Store
 * Implements security best practices and input validation
 */

// Rate limiting configurations
export const createRateLimit = (
  windowMs: number,
  max: number,
  message?: string
) => {
  return rateLimit({
    windowMs,
    max,
    message:
      message || "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests, please try again later.",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Specific rate limits for different endpoints
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  "Too many authentication attempts, please try again later."
);

export const apiRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  "Too many API requests, please try again later."
);

export const paymentRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  3, // 3 payment attempts
  "Too many payment attempts, please try again later."
);

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

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        // Remove potentially dangerous characters
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, "")
          .trim();
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
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
    console.error("RAZORPAY_KEY_SECRET not configured");
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
      console.warn("Invalid Razorpay signature:", {
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
    console.error("Razorpay signature verification error:", error);
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
    console.log(`[SECURITY] ${event}:`, {
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
      "http://localhost:5173",
      "http://localhost:3000",
      "https://cpsstore.com",
      "https://www.cpsstore.com",
    ];

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
