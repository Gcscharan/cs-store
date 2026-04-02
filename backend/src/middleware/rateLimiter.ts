/**
 * Rate Limiter Middleware
 * 
 * Protects API endpoints from abuse, DDoS attacks, and cost explosion.
 * 
 * ⚠️ PRODUCTION NOTE:
 * Current implementation uses in-memory store (express-rate-limit default).
 * This will NOT work correctly in multi-instance deployments.
 * 
 * Single instance: ✅ Works correctly
 * Multiple instances behind load balancer: ❌ Broken behavior
 *   - Each instance tracks limits independently
 *   - User can hit Instance A 100x + Instance B 100x = 200 total
 *   - Server restart → rate limit state lost
 * 
 * Phase 2 Migration (MANDATORY before horizontal scaling):
 * Replace with Redis store for shared state across instances:
 * 
 * ```typescript
 * import RedisStore from 'rate-limit-redis';
 * import Redis from 'ioredis';
 * 
 * const redis = new Redis(process.env.REDIS_URL);
 * 
 * export const pincodeRateLimiter = rateLimit({
 *   store: new RedisStore({
 *     client: redis,
 *     prefix: 'rl:pincode:',
 *   }),
 *   windowMs: 60 * 1000,
 *   max: 100,
 *   // ... rest of config
 * });
 * ```
 * 
 * When to migrate: Before deploying multiple instances or behind load balancer
 */

import rateLimit from 'express-rate-limit';
import { logWarn } from '../utils/structuredLogger';

/**
 * Pincode API Rate Limiter
 * 
 * Limits requests to 100 per minute per IP address.
 * Returns HTTP 429 with standard rate limit headers when exceeded.
 */
export const pincodeRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per IP per window

  // Use standard rate limit headers (RateLimit-*)
  standardHeaders: true,
  
  // Disable legacy X-RateLimit-* headers
  legacyHeaders: false,

  // Custom key generator (currently IP, can upgrade to userId || IP later)
  keyGenerator: (req) => req.ip || 'unknown',

  // Custom handler for rate limit exceeded
  handler: (req, res) => {
    // Log rate limit violation with structured logger
    logWarn('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      endpoint: req.originalUrl,
      userAgent: req.get('user-agent'),
      limit: 100,
      window: '60s',
    });

    // Return 429 with error message
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
    });
  },

  // Skip rate limiting for successful requests (only count towards limit)
  skipSuccessfulRequests: false,

  // Skip rate limiting for failed requests (only count towards limit)
  skipFailedRequests: false,
});

/**
 * Strict Rate Limiter (for write operations)
 * 
 * Limits requests to 50 per minute per IP address.
 * Used for POST/PUT/DELETE operations that modify data.
 */
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    logWarn('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      endpoint: req.originalUrl,
      limit: 50,
      window: '60s',
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
    });
  },
});

/**
 * Read Rate Limiter (for read operations)
 * 
 * Limits requests to 200 per minute per IP address.
 * Used for GET operations that only read data.
 */
export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown',
  handler: (req, res) => {
    logWarn('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      endpoint: req.originalUrl,
      limit: 200,
      window: '60s',
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later',
    });
  },
});
