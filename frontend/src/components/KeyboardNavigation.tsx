import React, { useEffect, useRef, useState } from "react";

interface KeyboardNavigationProps {
  children: React.ReactNode;
  className?: string;
  onKeyDown?: (event: KeyboardEvent) => void;
  trapFocus?: boolean;
  initialFocus?: boolean;
}

const KeyboardNavigation: React.FC<KeyboardNavigationProps> = ({
  children,
  className = "",
  onKeyDown,
  trapFocus = false,
  initialFocus = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Get all focusable elements
  const getFocusableElements = () => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(", ");

    return Array.from(
      containerRef.current.querySelectorAll(focusableSelectors)
    ) as HTMLElement[];
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!containerRef.current) return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      let newIndex = focusedIndex;

      switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          newIndex =
            focusedIndex < focusableElements.length - 1 ? focusedIndex + 1 : 0;
          break;
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          newIndex =
            focusedIndex > 0 ? focusedIndex - 1 : focusableElements.length - 1;
          break;
        case "Home":
          event.preventDefault();
          newIndex = 0;
          break;
        case "End":
          event.preventDefault();
          newIndex = focusableElements.length - 1;
          break;
        case "Tab":
          if (trapFocus) {
            event.preventDefault();
            newIndex =
              focusedIndex < focusableElements.length - 1
                ? focusedIndex + 1
                : 0;
          }
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < focusableElements.length) {
            focusableElements[focusedIndex].click();
          }
          break;
        case "Escape":
          // Let the parent handle escape
          break;
        default:
          return;
      }

      if (
        newIndex !== focusedIndex &&
        newIndex >= 0 &&
        newIndex < focusableElements.length
      ) {
        setFocusedIndex(newIndex);
        focusableElements[newIndex].focus();
      }

      // Call custom key handler
      if (onKeyDown) {
        onKeyDown(event);
      }
    };

    const container = containerRef.current;
    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [focusedIndex, onKeyDown, trapFocus]);

  // Set initial focus
  useEffect(() => {
    if (initialFocus && containerRef.current) {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        setFocusedIndex(0);
        focusableElements[0].focus();
      }
    }
  }, [initialFocus]);

  return (
    <div
      ref={containerRef}
      className={`focus:outline-none ${className}`}
      tabIndex={-1}
    >
      {children}
    </div>
  );
};

// Focus Trap Component
interface FocusTrapProps {
  children: React.ReactNode;
  isActive: boolean;
  className?: string;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({
  children,
  isActive,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the first focusable element in the trap
    const focusableElements = containerRef.current?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Handle tab key to cycle through elements
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        containerRef.current?.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        ) || []
      ) as HTMLElement[];

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey) {
        // Shift + Tab: move backwards
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: move forwards
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("keydown", handleTabKey);

      // Restore focus to the previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive]);

  if (!isActive) return <>{children}</>;

  return (
    <div ref={containerRef} className={className} tabIndex={-1}>
      {children}
    </div>
  );
};

// Skip Link Component
interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({
  href,
  children,
  className = "",
}) => {
  return (
    <a
      href={href}
      className={`
        sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
        bg-primary-600 text-white px-4 py-2 rounded-md z-skipLink
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
        ${className}
      `}
    >
      {children}
    </a>
  );
};

// Accessible Button Component
interface AccessibleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  ...props
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case "primary":
        return "bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500";
      case "secondary":
        return "bg-secondary-600 hover:bg-secondary-700 text-white focus:ring-secondary-500";
      case "danger":
        return "bg-error-600 hover:bg-error-700 text-white focus:ring-error-500";
      case "ghost":
        return "bg-transparent hover:bg-secondary-100 text-secondary-700 focus:ring-secondary-500";
      default:
        return "bg-primary-600 hover:bg-primary-700 text-white focus:ring-primary-500";
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "px-3 py-1.5 text-sm";
      case "md":
        return "px-4 py-2 text-base";
      case "lg":
        return "px-6 py-3 text-lg";
      default:
        return "px-4 py-2 text-base";
    }
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium rounded-md
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-200
        ${getVariantClasses()}
        ${getSizeClasses()}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
      {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
    </button>
  );
};

export default KeyboardNavigation;
