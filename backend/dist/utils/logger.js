"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logBusinessMetric = exports.logPerformance = exports.captureSecurityEvent = exports.captureInventoryError = exports.capturePaymentError = exports.logSecurityEvent = exports.logOrderEvent = exports.logPaymentEvent = exports.logAuthAttempt = exports.sentryMiddleware = exports.initializeSentry = exports.logger = void 0;
const Sentry = __importStar(require("@sentry/node"));
class Logger {
    constructor() {
        this.context = {};
    }
    setContext(context) {
        this.context = { ...this.context, ...context };
    }
    clearContext() {
        this.context = {};
    }
    formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const contextStr = Object.keys(this.context).length > 0
            ? ` [${Object.entries(this.context)
                .map(([k, v]) => `${k}=${v}`)
                .join(", ")}]`
            : "";
        return `[${timestamp}] [${level}]${contextStr} ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ""}`;
    }
    info(message, data) {
        const formattedMessage = this.formatMessage("INFO", message, data);
        console.log(formattedMessage);
        // Send to Sentry with info level
        Sentry.addBreadcrumb({
            message,
            level: "info",
            data: { ...this.context, ...data },
        });
    }
    warn(message, data) {
        const formattedMessage = this.formatMessage("WARN", message, data);
        console.warn(formattedMessage);
        // Send to Sentry with warning level
        Sentry.addBreadcrumb({
            message,
            level: "warning",
            data: { ...this.context, ...data },
        });
    }
    error(message, error, data) {
        const formattedMessage = this.formatMessage("ERROR", message, data);
        console.error(formattedMessage);
        if (error) {
            if (error instanceof Error) {
                console.error("Error stack:", error.stack);
            }
            else {
                console.error("Error:", error);
            }
        }
        // Send to Sentry with error level
        const errorObj = error instanceof Error ? error : new Error(String(error));
        Sentry.captureException(errorObj, {
            level: "error",
            tags: {
                component: "backend",
                ...this.context,
            },
            extra: data,
        });
    }
    debug(message, data) {
        if (process.env.NODE_ENV === "development") {
            const formattedMessage = this.formatMessage("DEBUG", message, data);
            console.debug(formattedMessage);
        }
    }
    // Specialized logging methods
    auth(message, data) {
        this.setContext({ component: "auth" });
        this.info(message, data);
    }
    payment(message, data) {
        this.setContext({ component: "payment" });
        this.info(message, data);
    }
    // Payment error logging with explicit Sentry capture
    paymentError(message, error, data) {
        this.setContext({ component: "payment" });
        this.error(message, error, data);
        const errorObj = error instanceof Error ? error : new Error(String(error));
        Sentry.captureException(errorObj, {
            level: "error",
            tags: {
                component: "payment",
                type: "PAYMENT",
                ...this.context,
            },
            extra: data,
        });
    }
    order(message, data) {
        this.setContext({ component: "order" });
        this.info(message, data);
    }
    // Inventory error logging with explicit Sentry capture
    inventoryError(message, error, data) {
        this.setContext({ component: "inventory" });
        this.error(message, error, data);
        const errorObj = error instanceof Error ? error : new Error(String(error));
        Sentry.captureException(errorObj, {
            level: "error",
            tags: {
                component: "inventory",
                type: "INVENTORY",
                ...this.context,
            },
            extra: data,
        });
    }
    delivery(message, data) {
        this.setContext({ component: "delivery" });
        this.info(message, data);
    }
    admin(message, data) {
        this.setContext({ component: "admin" });
        this.info(message, data);
    }
    // Security logging
    security(message, data) {
        this.setContext({ component: "security" });
        this.warn(message, data);
        // Always send security events to Sentry
        Sentry.captureMessage(message, {
            level: "warning",
            tags: {
                component: "security",
                type: "SECURITY",
                ...this.context,
            },
            extra: data,
        });
    }
    // Performance logging
    performance(operation, duration, data) {
        this.setContext({ component: "performance" });
        this.info(`Performance: ${operation} took ${duration}ms`, data);
        // Send performance data to Sentry
        Sentry.addBreadcrumb({
            message: `Performance: ${operation}`,
            level: "info",
            data: {
                operation,
                duration,
                ...this.context,
                ...data,
            },
        });
    }
    // Business metrics logging
    metrics(event, value, data) {
        this.setContext({ component: "metrics" });
        this.info(`Metrics: ${event} = ${value}`, data);
        // Send metrics to Sentry
        Sentry.addBreadcrumb({
            message: `Metrics: ${event}`,
            level: "info",
            data: {
                event,
                value,
                ...this.context,
                ...data,
            },
        });
    }
}
// Create singleton instance
exports.logger = new Logger();
// Initialize Sentry
const initializeSentry = () => {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        exports.logger.warn("Sentry DSN not configured. Error tracking disabled.");
        return;
    }
    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
        beforeSend(event) {
            // Filter out sensitive data
            if (event.request?.data) {
                const data = event.request.data;
                if (typeof data === "object") {
                    // Remove sensitive fields
                    const sensitiveFields = [
                        "password",
                        "passwordHash",
                        "secret",
                        "token",
                        "key",
                    ];
                    sensitiveFields.forEach((field) => {
                        if (data[field]) {
                            data[field] = "[REDACTED]";
                        }
                    });
                }
            }
            return event;
        },
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.Express({ app: undefined }),
            new Sentry.Integrations.Mongo({ useMongoose: true }),
        ],
    });
    exports.logger.info("Sentry initialized successfully");
};
exports.initializeSentry = initializeSentry;
// Express middleware for Sentry
exports.sentryMiddleware = {
    requestHandler: () => {
        if (!process.env.SENTRY_DSN)
            return (req, res, next) => next();
        return Sentry.Handlers?.requestHandler()
            ? Sentry.Handlers.requestHandler()
            : (req, res, next) => next();
    },
    tracingHandler: () => {
        if (!process.env.SENTRY_DSN)
            return (req, res, next) => next();
        return Sentry.Handlers?.tracingHandler()
            ? Sentry.Handlers.tracingHandler()
            : (req, res, next) => next();
    },
    errorHandler: () => {
        if (!process.env.SENTRY_DSN)
            return (err, req, res, next) => next(err);
        return Sentry.Handlers?.errorHandler()
            ? Sentry.Handlers.errorHandler()
            : (err, req, res, next) => next(err);
    },
};
// Helper functions for common logging patterns
const logAuthAttempt = (email, success, ip) => {
    exports.logger.auth(`Authentication attempt: ${email} - ${success ? "SUCCESS" : "FAILED"}`, {
        email,
        success,
        ip,
        timestamp: new Date().toISOString(),
    });
};
exports.logAuthAttempt = logAuthAttempt;
const logPaymentEvent = (orderId, event, amount, data) => {
    exports.logger.payment(`Payment event: ${event} for order ${orderId}`, {
        orderId,
        event,
        amount,
        timestamp: new Date().toISOString(),
        ...data,
    });
};
exports.logPaymentEvent = logPaymentEvent;
const logOrderEvent = (orderId, event, userId, data) => {
    exports.logger.order(`Order event: ${event} for order ${orderId}`, {
        orderId,
        event,
        userId,
        timestamp: new Date().toISOString(),
        ...data,
    });
};
exports.logOrderEvent = logOrderEvent;
const logSecurityEvent = (event, severity, data) => {
    exports.logger.security(`Security event: ${event} (${severity})`, {
        event,
        severity,
        timestamp: new Date().toISOString(),
        ...data,
    });
};
exports.logSecurityEvent = logSecurityEvent;
// Tagged error capture helpers
const capturePaymentError = (message, error, data) => {
    exports.logger.paymentError(message, error, data);
};
exports.capturePaymentError = capturePaymentError;
const captureInventoryError = (message, error, data) => {
    exports.logger.inventoryError(message, error, data);
};
exports.captureInventoryError = captureInventoryError;
const captureSecurityEvent = (event, severity, data) => {
    exports.logger.security(`Security event: ${event} (${severity})`, {
        event,
        severity,
        timestamp: new Date().toISOString(),
        ...data,
    });
};
exports.captureSecurityEvent = captureSecurityEvent;
const logPerformance = (operation, startTime, data) => {
    const duration = Date.now() - startTime;
    exports.logger.performance(operation, duration, data);
};
exports.logPerformance = logPerformance;
const logBusinessMetric = (metric, value, data) => {
    exports.logger.metrics(metric, value, data);
};
exports.logBusinessMetric = logBusinessMetric;
exports.default = exports.logger;
