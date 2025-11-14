import * as Sentry from "@sentry/node";

/**
 * Enhanced Logging Utility with Sentry Integration
 */

interface LogContext {
  userId?: string;
  orderId?: string;
  paymentId?: string;
  requestId?: string;
  [key: string]: any;
}

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr =
      Object.keys(this.context).length > 0
        ? ` [${Object.entries(this.context)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}]`
        : "";

    return `[${timestamp}] [${level}]${contextStr} ${message}${
      data ? ` | Data: ${JSON.stringify(data)}` : ""
    }`;
  }

  info(message: string, data?: any) {
    const formattedMessage = this.formatMessage("INFO", message, data);
    console.log(formattedMessage);

    // Send to Sentry with info level
    Sentry.addBreadcrumb({
      message,
      level: "info",
      data: { ...this.context, ...data },
    });
  }

  warn(message: string, data?: any) {
    const formattedMessage = this.formatMessage("WARN", message, data);
    console.warn(formattedMessage);

    // Send to Sentry with warning level
    Sentry.addBreadcrumb({
      message,
      level: "warning",
      data: { ...this.context, ...data },
    });
  }

  error(message: string, error?: Error, data?: any) {
    const formattedMessage = this.formatMessage("ERROR", message, data);
    console.error(formattedMessage);
    if (error) {
      console.error("Error stack:", error.stack);
    }

    // Send to Sentry with error level
    Sentry.captureException(error || new Error(message), {
      level: "error",
      tags: {
        component: "backend",
        ...this.context,
      },
      extra: data,
    });
  }

  debug(message: string, data?: any) {
    if (process.env.NODE_ENV === "development") {
      const formattedMessage = this.formatMessage("DEBUG", message, data);
      console.debug(formattedMessage);
    }
  }

  // Specialized logging methods
  auth(message: string, data?: any) {
    this.setContext({ component: "auth" });
    this.info(message, data);
  }

  payment(message: string, data?: any) {
    this.setContext({ component: "payment" });
    this.info(message, data);
  }

  order(message: string, data?: any) {
    this.setContext({ component: "order" });
    this.info(message, data);
  }

  delivery(message: string, data?: any) {
    this.setContext({ component: "delivery" });
    this.info(message, data);
  }

  admin(message: string, data?: any) {
    this.setContext({ component: "admin" });
    this.info(message, data);
  }

  // Security logging
  security(message: string, data?: any) {
    this.setContext({ component: "security" });
    this.warn(message, data);

    // Always send security events to Sentry
    Sentry.captureMessage(message, {
      level: "warning",
      tags: {
        component: "security",
        ...this.context,
      },
      extra: data,
    });
  }

  // Performance logging
  performance(operation: string, duration: number, data?: any) {
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
  metrics(event: string, value: number, data?: any) {
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
export const logger = new Logger();

// Initialize Sentry
export const initializeSentry = () => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.warn("Sentry DSN not configured. Error tracking disabled.");
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

  logger.info("Sentry initialized successfully");
};

// Express middleware for Sentry
export const sentryMiddleware = {
  requestHandler: () => (req: any, res: any, next: any) => next(),
  tracingHandler: () => (req: any, res: any, next: any) => next(),
  errorHandler: () => (err: any, req: any, res: any, next: any) => next(err),
};

// Helper functions for common logging patterns
export const logAuthAttempt = (email: string, success: boolean, ip: string) => {
  logger.auth(
    `Authentication attempt: ${email} - ${success ? "SUCCESS" : "FAILED"}`,
    {
      email,
      success,
      ip,
      timestamp: new Date().toISOString(),
    }
  );
};

export const logPaymentEvent = (
  orderId: string,
  event: string,
  amount: number,
  data?: any
) => {
  logger.payment(`Payment event: ${event} for order ${orderId}`, {
    orderId,
    event,
    amount,
    timestamp: new Date().toISOString(),
    ...data,
  });
};

export const logOrderEvent = (
  orderId: string,
  event: string,
  userId: string,
  data?: any
) => {
  logger.order(`Order event: ${event} for order ${orderId}`, {
    orderId,
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...data,
  });
};

export const logSecurityEvent = (
  event: string,
  severity: "low" | "medium" | "high",
  data?: any
) => {
  logger.security(`Security event: ${event} (${severity})`, {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...data,
  });
};

export const logPerformance = (
  operation: string,
  startTime: number,
  data?: any
) => {
  const duration = Date.now() - startTime;
  logger.performance(operation, duration, data);
};

export const logBusinessMetric = (
  metric: string,
  value: number,
  data?: any
) => {
  logger.metrics(metric, value, data);
};

export default logger;
