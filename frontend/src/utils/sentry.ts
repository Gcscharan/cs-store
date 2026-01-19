import * as Sentry from "@sentry/react";

/**
 * Sentry Configuration for Frontend
 */

export const initializeSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn("Sentry DSN not configured. Error tracking disabled.");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || "development",
    tracesSampleRate: 0.0,
    beforeSend(event: any) {
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
    beforeBreadcrumb(breadcrumb: any) {
      // Filter out sensitive breadcrumbs
      if (
        breadcrumb.category === "xhr" &&
        breadcrumb.data?.url?.includes("/auth")
      ) {
        return null;
      }
      return breadcrumb;
    },
  });

  console.log("Sentry initialized successfully");
};

// Error boundary component
export const SentryErrorBoundary = Sentry.withErrorBoundary;

// Performance monitoring
export const startTransaction = (name: string, op: string) => {
  return Sentry.startTransaction({ name, op });
};

// User context
export const setUserContext = (user: {
  id: string;
  email: string;
  role: string;
}) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  });
};

// Clear user context
export const clearUserContext = () => {
  Sentry.setUser(null);
};

// Custom error reporting
export const reportError = (error: Error, context?: Record<string, any>) => {
  Sentry.captureException(error, {
    tags: {
      component: "frontend",
      ...context,
    },
  });
};

// Performance monitoring helpers
export const measurePerformance = async <T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> => {
  const transaction = startTransaction(name, "custom");

  try {
    const result = await operation();
    transaction.setStatus("ok");
    return result;
  } catch (error) {
    transaction.setStatus("internal_error");
    throw error;
  } finally {
    transaction.finish();
  }
};

// Business metrics
export const trackBusinessMetric = (
  metric: string,
  value: number,
  data?: Record<string, any>
) => {
  Sentry.addBreadcrumb({
    message: `Business metric: ${metric}`,
    level: "info",
    data: {
      metric,
      value,
      ...data,
    },
  });
};

// User actions tracking
export const trackUserAction = (action: string, data?: Record<string, any>) => {
  Sentry.addBreadcrumb({
    message: `User action: ${action}`,
    level: "info",
    data: {
      action,
      timestamp: new Date().toISOString(),
      ...data,
    },
  });
};

// API call monitoring
export const trackApiCall = (
  url: string,
  method: string,
  status: number,
  duration: number
) => {
  Sentry.addBreadcrumb({
    message: `API call: ${method} ${url}`,
    level: "info",
    data: {
      url,
      method,
      status,
      duration,
      timestamp: new Date().toISOString(),
    },
  });
};

export default Sentry;
