"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = exports.requestSizeLimit = exports.securityLogger = exports.productValidationRules = exports.addressValidationRules = exports.userValidationRules = exports.validateInput = exports.verifyRazorpaySignature = exports.sanitizeInput = exports.securityHeaders = exports.paymentRateLimit = exports.apiRateLimit = exports.authRateLimit = exports.createRateLimit = exports.apiLimiter = void 0;
const crypto_1 = __importDefault(require("crypto"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const express_validator_1 = require("express-validator");
// Global API rate limiter
exports.apiLimiter = (0, express_rate_limit_1.default)({
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
const createRateLimit = (windowMs, max, message) => {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        message: message || "Too many requests from this IP, please try again later.",
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
exports.createRateLimit = createRateLimit;
// Specific rate limits for different endpoints
exports.authRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, // 15 minutes
5, // 5 attempts
"Too many authentication attempts, please try again later.");
exports.apiRateLimit = (0, exports.createRateLimit)(15 * 60 * 1000, // 15 minutes
100, // 100 requests
"Too many API requests, please try again later.");
exports.paymentRateLimit = (0, exports.createRateLimit)(5 * 60 * 1000, // 5 minutes
3, // 3 payment attempts
"Too many payment attempts, please try again later.");
// Security headers middleware
exports.securityHeaders = (0, helmet_1.default)({
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
const sanitizeInput = (req, res, next) => {
    const sanitizeObject = (obj) => {
        if (typeof obj !== "object" || obj === null) {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "string") {
                // Remove potentially dangerous characters
                sanitized[key] = value
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
                    .replace(/javascript:/gi, "")
                    .replace(/on\w+\s*=/gi, "")
                    .trim();
            }
            else {
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
exports.sanitizeInput = sanitizeInput;
// Razorpay signature verification
const verifyRazorpaySignature = (req, res, next) => {
    const { razorpay_signature, razorpay_payment_id, razorpay_order_id } = req.body;
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
        const expectedSignature = crypto_1.default
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
    }
    catch (error) {
        console.error("Razorpay signature verification error:", error);
        res.status(500).json({
            error: "Payment verification failed",
        });
    }
};
exports.verifyRazorpaySignature = verifyRazorpaySignature;
// Input validation middleware
const validateInput = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: "Validation failed",
            details: errors.array(),
        });
    }
    next();
};
exports.validateInput = validateInput;
// Common validation rules
exports.userValidationRules = [
    (0, express_validator_1.body)("name")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("Name must be between 2 and 50 characters")
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage("Name can only contain letters and spaces"),
    (0, express_validator_1.body)("email").isEmail().normalizeEmail().withMessage("Invalid email format"),
    (0, express_validator_1.body)("phone")
        .isMobilePhone("en-IN")
        .withMessage("Invalid phone number format"),
    (0, express_validator_1.body)("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage("Password must contain at least one lowercase letter, one uppercase letter, and one number"),
];
exports.addressValidationRules = [
    (0, express_validator_1.body)("addresses.*.pincode")
        .isPostalCode("IN")
        .withMessage("Invalid pincode format"),
    (0, express_validator_1.body)("addresses.*.city")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("City must be between 2 and 50 characters"),
    (0, express_validator_1.body)("addresses.*.state")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("State must be between 2 and 50 characters"),
    (0, express_validator_1.body)("addresses.*.addressLine")
        .trim()
        .isLength({ min: 10, max: 200 })
        .withMessage("Address must be between 10 and 200 characters"),
];
exports.productValidationRules = [
    (0, express_validator_1.body)("name")
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("Product name must be between 2 and 100 characters"),
    (0, express_validator_1.body)("price")
        .isNumeric()
        .isFloat({ min: 0 })
        .withMessage("Price must be a positive number"),
    (0, express_validator_1.body)("stock")
        .isInt({ min: 0 })
        .withMessage("Stock must be a non-negative integer"),
    (0, express_validator_1.body)("category")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("Category must be between 2 and 50 characters"),
];
// Security logging middleware
const securityLogger = (req, res, next) => {
    const startTime = Date.now();
    // Log security-relevant events
    const logSecurityEvent = (event, details) => {
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
    res.json = function (body) {
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
                userId: req.user?._id,
                action: req.method,
                duration,
            });
        }
        return originalJson.call(this, body);
    };
    next();
};
exports.securityLogger = securityLogger;
// Request size limiter
const requestSizeLimit = (limit = "10mb") => {
    return (req, res, next) => {
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
exports.requestSizeLimit = requestSizeLimit;
// CORS configuration
exports.corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://cpsstore.com",
            "https://www.cpsstore.com",
        ];
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
};
exports.default = {
    createRateLimit: exports.createRateLimit,
    authRateLimit: exports.authRateLimit,
    apiRateLimit: exports.apiRateLimit,
    paymentRateLimit: exports.paymentRateLimit,
    securityHeaders: exports.securityHeaders,
    sanitizeInput: exports.sanitizeInput,
    verifyRazorpaySignature: exports.verifyRazorpaySignature,
    validateInput: exports.validateInput,
    userValidationRules: exports.userValidationRules,
    addressValidationRules: exports.addressValidationRules,
    productValidationRules: exports.productValidationRules,
    securityLogger: exports.securityLogger,
    requestSizeLimit: exports.requestSizeLimit,
    corsOptions: exports.corsOptions,
};
