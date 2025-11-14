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
            return res.status(401).json({ error: "Access token required" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "your-secret-key");
        const user = await User_1.User.findById(decoded.userId).select("-passwordHash");
        if (!user) {
            return res.status(401).json({ error: "Invalid token" });
        }
        req.user = user;
        req.userId = user._id.toString();
        next();
    }
    catch (error) {
        return res.status(403).json({ error: "Invalid or expired token" });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Authentication required" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
};
exports.requireRole = requireRole;
const requireDeliveryRole = (req, res, next) => {
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
exports.requireDeliveryRole = requireDeliveryRole;
//# sourceMappingURL=auth.js.map