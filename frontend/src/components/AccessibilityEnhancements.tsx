import React, { useEffect, useRef } from "react";

/**
 * Accessibility Enhancements Component
 * Provides ARIA labels, focus management, and keyboard navigation
 */

interface AccessibilityEnhancementsProps {
  children: React.ReactNode;
  skipToContent?: boolean;
  announceChanges?: boolean;
}

export const AccessibilityEnhancements: React.FC<
  AccessibilityEnhancementsProps
> = ({ children, skipToContent = true, announceChanges = true }) => {
  const mainContentRef = useRef<HTMLElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Skip to content functionality
  useEffect(() => {
    const handleSkipToContent = (e: KeyboardEvent) => {
      if (
        e.key === "Tab" &&
        !e.shiftKey &&
        document.activeElement === document.body
      ) {
        const skipLink = document.querySelector(
          "[data-skip-to-content]"
        ) as HTMLElement;
        if (skipLink) {
          skipLink.focus();
        }
      }
    };

    document.addEventListener("keydown", handleSkipToContent);
    return () => document.removeEventListener("keydown", handleSkipToContent);
  }, []);

  // Announce changes to screen readers
  const announceToScreenReader = (message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = "";
        }
      }, 1000);
    }
  };

  // Expose announce function globally for use in other components
  useEffect(() => {
    (window as any).announceToScreenReader = announceToScreenReader;
    return () => {
      delete (window as any).announceToScreenReader;
    };
  }, []);

  return (
    <>
      {/* Skip to content link */}
      {skipToContent && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-md focus:shadow-lg"
          data-skip-to-content
          onFocus={() => {
            // Scroll to main content when skip link is activated
            if (mainContentRef.current) {
              mainContentRef.current.scrollIntoView({ behavior: "smooth" });
              mainContentRef.current.focus();
            }
          }}
        >
          Skip to main content
        </a>
      )}

      {/* Live region for announcements */}
      {announceChanges && (
        <div
          ref={liveRegionRef}
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        />
      )}

      {/* Main content wrapper */}
      <main
        ref={mainContentRef}
        id="main-content"
        tabIndex={-1}
        role="main"
        aria-label="Main content"
      >
        {children}
      </main>
    </>
  );
};

/**
 * Focus trap for modals and dropdowns
 */
export const FocusTrap: React.FC<{
  children: React.ReactNode;
  isActive: boolean;
  onEscape?: () => void;
}> = ({ children, isActive, onEscape }) => {
  const trapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onEscape) {
        onEscape();
        return;
      }

      if (e.key === "Tab") {
        const focusableElements = trapRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;

        if (!focusableElements.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onEscape]);

  return (
    <div ref={trapRef} className={isActive ? "focus-trap" : ""}>
      {children}
    </div>
  );
};

/**
 * Accessible button component with proper ARIA attributes
 */
export const AccessibleButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}> = ({
  children,
  onClick,
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
  variant = "primary",
  size = "md",
  className = "",
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";

  const variantClasses = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-gray-400",
    secondary:
      "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 disabled:bg-gray-100",
    danger:
      "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-gray-400",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      type="button"
    >
      {children}
    </button>
  );
};

/**
 * Accessible input component with proper labeling
 */
export const AccessibleInput: React.FC<{
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  ariaDescribedBy?: string;
  className?: string;
}> = ({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  required = false,
  placeholder,
  ariaDescribedBy,
  className = "",
}) => {
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={describedBy}
        className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          error ? "border-red-500" : "border-gray-300"
        } ${className}`}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * Screen reader only text
 */
export const ScreenReaderOnly: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => <span className="sr-only">{children}</span>;

/**
 * Accessible loading spinner
 */
export const AccessibleSpinner: React.FC<{
  size?: "sm" | "md" | "lg";
  label?: string;
}> = ({ size = "md", label = "Loading..." }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
  };

  return (
    <div
      className="flex items-center justify-center"
      role="status"
      aria-label={label}
    >
      <div
        className={`animate-spin rounded-full border-2 border-gray-300 border-t-blue-600 ${sizeClasses[size]}`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
};

export default AccessibilityEnhancements;
