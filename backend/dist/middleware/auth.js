"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDeliveryRole = exports.requireRole = exports.authenticateToken = exports.authenticateGoogleAuthOnly = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const authenticateGoogleAuthOnly = async (req, res, next) => {
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
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        if (decoded?.authState !== "GOOGLE_AUTH_ONLY" || !decoded?.email) {
            return res.status(403).json({ message: "Invalid onboarding session" });
        }
        req.googleAuthOnly = decoded;
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json({ message: "Invalid or expired token" });
        }
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
exports.authenticateGoogleAuthOnly = authenticateGoogleAuthOnly;
const authenticateToken = async (req, res, next) => {
    try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ message: "Server misconfigured" });
        }
        const debug = process.env.NODE_ENV !== "production";
        if (debug)
            console.log('[Auth] authenticateToken - starting');
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];
        if (debug)
            console.log('[Auth] authenticateToken - authHeader exists:', !!authHeader);
        if (debug)
            console.log('[Auth] authenticateToken - token exists:', !!token);
        if (!token) {
            if (debug)
                console.log('[Auth] authenticateToken - no token, returning 401');
            return res.status(401).json({ message: "Authentication required" });
        }
        // Check if token is blacklisted
        try {
            const redisClient = require('../config/redis').default;
            const isBlacklisted = await redisClient.get(`blacklist:access:${token}`);
            if (isBlacklisted) {
                if (debug)
                    console.log('[Auth] authenticateToken - token blacklisted, returning 401');
                return res.status(401).json({ message: "Token revoked - please login again", code: "TOKEN_REVOKED" });
            }
        }
        catch (redisError) {
            // Redis not available, proceed with token verification
        }
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        if (debug)
            console.log('[Auth] authenticateToken - token decoded, userId:', decoded.userId);
        const user = await User_1.User.findById(decoded.userId).select("-passwordHash");
        if (debug)
            console.log('[Auth] authenticateToken - user found:', !!user);
        if (debug && user) {
            console.log('[Auth] authenticateToken - user._id:', user._id);
        }
        if (!user) {
            if (debug)
                console.log('[Auth] authenticateToken - user not found, returning 404');
            return res.status(404).json({ message: "User not found" });
        }
        // Check if user account is active
        if (user.status === 'suspended') {
            if (debug)
                console.log('[Auth] authenticateToken - user suspended, returning 403');
            return res.status(403).json({ message: "Account suspended" });
        }
        // Set both user object and userId for compatibility
        req.user = user;
        req.userId = user._id.toString();
        if (debug)
            console.log('[Auth] authenticateToken - req.user set, calling next()');
        next();
    }
    catch (error) {
        if (process.env.NODE_ENV !== "production") {
            console.log('[Auth] authenticateToken - error:', error);
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
            }
            else if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: "Invalid token format", code: "INVALID_TOKEN" });
            }
        }
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        const debug = process.env.NODE_ENV !== "production";
        if (debug)
            console.log('[Auth] requireRole - checking roles:', roles);
        if (debug)
            console.log('[Auth] requireRole - req.user exists:', !!req.user);
        if (debug && req.user) {
            console.log('[Auth] requireRole - user role:', req.user.role);
            console.log('[Auth] requireRole - role check:', roles.includes(req.user.role));
        }
        if (!req.user) {
            if (debug)
                console.log('[Auth] requireRole - no req.user, returning 401');
            return res.status(401).json({ message: "Authentication required" });
        }
        if (!roles.includes(req.user.role)) {
            if (debug)
                console.log('[Auth] requireRole - role not allowed, returning 403');
            return res.status(403).json({ message: "Admin access required" });
        }
        if (debug)
            console.log('[Auth] requireRole - role check passed, calling next()');
        next();
    };
};
exports.requireRole = requireRole;
// Specific middleware for delivery role
const requireDeliveryRole = (req, res, next) => {
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
exports.requireDeliveryRole = requireDeliveryRole;
