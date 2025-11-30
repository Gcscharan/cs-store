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
        }
        catch (redisError) {
            // Redis not available, proceed with token verification
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "your-secret-key");
        const user = await User_1.User.findById(decoded.userId).select("-passwordHash");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        // Check if user account is active
        if (user.status === 'suspended') {
            return res.status(403).json({ message: "Account suspended" });
        }
        // Set both user object and userId for compatibility
        req.user = user;
        req.userId = user._id.toString();
        next();
    }
    catch (error) {
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
        if (!req.user) {
            return res.status(401).json({ message: "Authentication required" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Admin access required" });
        }
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
