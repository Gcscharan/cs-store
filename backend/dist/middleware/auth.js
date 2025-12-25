"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireDeliveryRole = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const authenticateToken = async (req, res, next) => {
    try {
        console.log('[Auth] authenticateToken - starting');
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(" ")[1];
        console.log('[Auth] authenticateToken - authHeader exists:', !!authHeader);
        console.log('[Auth] authenticateToken - token exists:', !!token);
        if (!token) {
            console.log('[Auth] authenticateToken - no token, returning 401');
            return res.status(401).json({ message: "Authentication required" });
        }
        // Check if token is blacklisted
        try {
            const redisClient = require('../config/redis').default;
            const isBlacklisted = await redisClient.get(`blacklist:access:${token}`);
            if (isBlacklisted) {
                console.log('[Auth] authenticateToken - token blacklisted, returning 401');
                return res.status(401).json({ message: "Token revoked - please login again", code: "TOKEN_REVOKED" });
            }
        }
        catch (redisError) {
            // Redis not available, proceed with token verification
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "your-secret-key");
        console.log('[Auth] authenticateToken - token decoded, userId:', decoded.userId);
        const user = await User_1.User.findById(decoded.userId).select("-passwordHash");
        console.log('[Auth] authenticateToken - user found:', !!user);
        if (user) {
            console.log('[Auth] authenticateToken - user._id:', user._id);
        }
        if (!user) {
            console.log('[Auth] authenticateToken - user not found, returning 404');
            return res.status(404).json({ message: "User not found" });
        }
        // Check if user account is active
        if (user.status === 'suspended') {
            console.log('[Auth] authenticateToken - user suspended, returning 403');
            return res.status(403).json({ message: "Account suspended" });
        }
        // Set both user object and userId for compatibility
        req.user = user;
        req.userId = user._id.toString();
        console.log('[Auth] authenticateToken - req.user set, calling next()');
        next();
    }
    catch (error) {
        console.log('[Auth] authenticateToken - error:', error);
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            if (error.name === 'TokenExpiredError') {
                return res.status(403).json({ message: "Token expired", code: "TOKEN_EXPIRED" });
            }
            else if (error.name === 'JsonWebTokenError') {
                return res.status(403).json({ message: "Invalid token format", code: "INVALID_TOKEN" });
            }
        }
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        console.log('[Auth] requireRole - checking roles:', roles);
        console.log('[Auth] requireRole - req.user exists:', !!req.user);
        if (req.user) {
            console.log('[Auth] requireRole - user role:', req.user.role);
            console.log('[Auth] requireRole - role check:', roles.includes(req.user.role));
        }
        if (!req.user) {
            console.log('[Auth] requireRole - no req.user, returning 401');
            return res.status(401).json({ message: "Authentication required" });
        }
        if (!roles.includes(req.user.role)) {
            console.log('[Auth] requireRole - role not allowed, returning 403');
            return res.status(403).json({ message: "Admin access required" });
        }
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
