import React, { Suspense, lazy, ComponentType } from "react";
import AccessibleSpinner from "./AccessibilityEnhancements";

/**
 * Code Splitting Utilities for Performance Optimization
 */

// Loading fallback component
const LoadingFallback: React.FC<{ message?: string }> = ({
  message = "Loading...",
}) => (
  <div className="flex items-center justify-center p-8">
    <AccessibleSpinner>{message}</AccessibleSpinner>
    <span className="ml-2 text-gray-600">{message}</span>
  </div>
);

/**
 * Higher-order component for code splitting
 */
export const withCodeSplitting = <P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  fallbackMessage?: string
) => {
  const LazyComponent = lazy(importFunc);

  return (props: P) => (
    <Suspense fallback={<LoadingFallback message={fallbackMessage} />}>
      <LazyComponent {...(props as any)} />
    </Suspense>
  );
};

/**
 * Lazy load components with error boundaries
 */
export const LazyComponent: React.FC<{
  importFunc: () => Promise<{ default: ComponentType<any> }>;
  fallbackMessage?: string;
  errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  [key: string]: any;
}> = ({
  importFunc,
  fallbackMessage,
  errorFallback: ErrorFallback,
  ...props
}) => {
  const LazyComponent = lazy(importFunc);

  return (
    <ErrorBoundary fallback={ErrorFallback}>
      <Suspense fallback={<LoadingFallback message={fallbackMessage} />}>
        <LazyComponent {...(props as any)} />
      </Suspense>
    </ErrorBoundary>
  );
};

/**
 * Error boundary for lazy components
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error: Error; retry: () => void }>;
  },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Lazy component error:", error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        const FallbackComponent = this.props.fallback;
        return (
          <FallbackComponent error={this.state.error} retry={this.retry} />
        );
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-4">
            <svg
              className="w-12 h-12 text-red-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Something went wrong
          </h3>
          <p className="text-gray-600 mb-4">Failed to load component</p>
          <button
            onClick={this.retry}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Preload components for better performance
 */
export const preloadComponent = (importFunc: () => Promise<any>) => {
  // Start loading the component in the background
  importFunc().catch((error) => {
    console.warn("Failed to preload component:", error);
  });
};

/**
 * Route-based code splitting
 */
export const createLazyRoute = (
  importFunc: () => Promise<{ default: ComponentType<any> }>
) => {
  return withCodeSplitting(importFunc, "Loading page...");
};

// Pre-configured lazy components for common use cases
export const LazyProductCard = withCodeSplitting(
  () => import("./ProductCard"),
  "Loading product..."
);

export const LazyProductDetail = withCodeSplitting(
  () => import("../pages/ProductDetailPage"),
  "Loading product details..."
);

export const LazyCartPage = withCodeSplitting(
  () => import("../pages/CartPage"),
  "Loading cart..."
);

export const LazyCheckoutPage = withCodeSplitting(
  () => import("../pages/CheckoutPage"),
  "Loading checkout..."
);

export const LazyOrderTracking = withCodeSplitting(
  () => import("../pages/OrderTrackingPage"),
  "Loading order tracking..."
);

export const LazyAdminDashboard = withCodeSplitting(
  () => import("../pages/AdminDashboard"),
  "Loading admin dashboard..."
);

export const LazyDeliveryDashboard = withCodeSplitting(
  () => import("../pages/DeliveryDashboard"),
  "Loading delivery dashboard..."
);

export default LazyComponent;
