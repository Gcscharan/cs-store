"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Auth-specific rate limiter: 5 requests per 30 seconds per IP
exports.authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 30 * 1000, // 30 seconds
    max: 5, // 5 requests per window
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: 30
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Store in memory (no Redis required as specified)
    store: undefined,
});
