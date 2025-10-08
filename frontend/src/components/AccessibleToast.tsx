import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";

export interface ToastProps {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  action,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose(id), 300); // Wait for animation to complete
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, id, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(id), 300);
  };

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          bg: "bg-success-50",
          border: "border-success-200",
          icon: "text-success-600",
          iconBg: "bg-success-100",
        };
      case "error":
        return {
          bg: "bg-error-50",
          border: "border-error-200",
          icon: "text-error-600",
          iconBg: "bg-error-100",
        };
      case "warning":
        return {
          bg: "bg-warning-50",
          border: "border-warning-200",
          icon: "text-warning-600",
          iconBg: "bg-warning-100",
        };
      case "info":
        return {
          bg: "bg-info-50",
          border: "border-info-200",
          icon: "text-info-600",
          iconBg: "bg-info-100",
        };
      default:
        return {
          bg: "bg-secondary-50",
          border: "border-secondary-200",
          icon: "text-secondary-600",
          iconBg: "bg-secondary-100",
        };
    }
  };

  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      case "warning":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
      case "info":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const styles = getTypeStyles();

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`
        max-w-sm w-full ${styles.bg} ${styles.border} border rounded-lg shadow-lg
        pointer-events-auto overflow-hidden
      `}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className={`flex-shrink-0 ${styles.iconBg} rounded-full p-1`}>
            <div className={styles.icon}>{getIcon()}</div>
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-medium text-gray-900">{title}</p>
            {message && <p className="mt-1 text-sm text-gray-500">{message}</p>}
            {action && (
              <div className="mt-3">
                <button
                  onClick={action.onClick}
                  className="text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none focus:underline"
                >
                  {action.label}
                </button>
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={handleClose}
              className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              aria-label="Close notification"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Toast Container
interface ToastContainerProps {
  toasts: ToastProps[];
  onClose: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div
      className="fixed top-4 right-4 z-toast space-y-4"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Toast Hook
interface ToastOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = (
    type: ToastProps["type"],
    title: string,
    message?: string,
    options?: ToastOptions
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ToastProps = {
      id,
      type,
      title,
      message,
      duration: options?.duration,
      action: options?.action,
      onClose: (id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      },
    };

    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const success = (title: string, message?: string, options?: ToastOptions) =>
    addToast("success", title, message, options);
  const error = (title: string, message?: string, options?: ToastOptions) =>
    addToast("error", title, message, options);
  const warning = (title: string, message?: string, options?: ToastOptions) =>
    addToast("warning", title, message, options);
  const info = (title: string, message?: string, options?: ToastOptions) =>
    addToast("info", title, message, options);

  return {
    toasts,
    success,
    error,
    warning,
    info,
    removeToast,
  };
};

// Toast Provider Component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { toasts, removeToast } = useToast();

  return (
    <>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <ToastContainer toasts={toasts} onClose={removeToast} />,
          document.body
        )}
    </>
  );
};

export default Toast;
