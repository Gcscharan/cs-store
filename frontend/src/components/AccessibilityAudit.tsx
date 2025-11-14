import React, { useEffect, useState } from "react";

interface AccessibilityIssue {
  type: "error" | "warning" | "info";
  message: string;
  element?: HTMLElement;
  fix?: string;
}

const AccessibilityAudit: React.FC = () => {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);

  const auditAccessibility = () => {
    setIsAuditing(true);
    const foundIssues: AccessibilityIssue[] = [];

    // Check for missing alt text on images
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.alt && !img.getAttribute("aria-label")) {
        foundIssues.push({
          type: "error",
          message: "Image missing alt text",
          element: img as HTMLElement,
          fix: "Add alt attribute or aria-label",
        });
      }
    });

    // Check for missing form labels
    const inputs = document.querySelectorAll("input, select, textarea");
    inputs.forEach((input) => {
      const id = input.getAttribute("id");
      const ariaLabel = input.getAttribute("aria-label");
      const ariaLabelledBy = input.getAttribute("aria-labelledby");

      if (!id && !ariaLabel && !ariaLabelledBy) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (!label) {
          foundIssues.push({
            type: "error",
            message: "Form input missing label",
            element: input as HTMLElement,
            fix: "Add label element or aria-label attribute",
          });
        }
      }
    });

    // Check for missing heading hierarchy
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    let previousLevel = 0;
    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > previousLevel + 1) {
        foundIssues.push({
          type: "warning",
          message: `Heading hierarchy skipped from h${previousLevel} to h${level}`,
          element: heading as HTMLElement,
          fix: "Use proper heading hierarchy (h1, h2, h3, etc.)",
        });
      }
      previousLevel = level;
    });

    // Check for missing focus indicators
    const focusableElements = document.querySelectorAll(
      "button, input, select, textarea, a[href], [tabindex]"
    );
    focusableElements.forEach((element) => {
      const computedStyle = window.getComputedStyle(element);
      const outline = computedStyle.outline;
      const boxShadow = computedStyle.boxShadow;

      if (outline === "none" && !boxShadow.includes("0 0 0")) {
        foundIssues.push({
          type: "warning",
          message: "Element may lack visible focus indicator",
          element: element as HTMLElement,
          fix: "Add focus styles for keyboard navigation",
        });
      }
    });

    // Check for color contrast (simplified)
    const textElements = document.querySelectorAll(
      "p, span, div, h1, h2, h3, h4, h5, h6"
    );
    textElements.forEach((element) => {
      const computedStyle = window.getComputedStyle(element);
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;

      // This is a simplified check - in a real audit, you'd use a proper contrast ratio calculator
      if (color === backgroundColor) {
        foundIssues.push({
          type: "error",
          message: "Text and background colors may be identical",
          element: element as HTMLElement,
          fix: "Ensure sufficient color contrast (4.5:1 for normal text)",
        });
      }
    });

    // Check for missing ARIA labels on interactive elements
    const interactiveElements = document.querySelectorAll(
      "button, input, select, textarea, [role='button'], [role='link']"
    );
    interactiveElements.forEach((element) => {
      const hasAriaLabel = element.getAttribute("aria-label");
      const hasAriaLabelledBy = element.getAttribute("aria-labelledby");
      const hasTextContent = element.textContent?.trim();

      if (!hasAriaLabel && !hasAriaLabelledBy && !hasTextContent) {
        foundIssues.push({
          type: "warning",
          message: "Interactive element may lack accessible name",
          element: element as HTMLElement,
          fix: "Add aria-label, aria-labelledby, or visible text content",
        });
      }
    });

    // Check for missing landmark roles
    const hasMain = document.querySelector("main, [role='main']");
    const hasNavigation = document.querySelector("nav, [role='navigation']");
    const hasBanner = document.querySelector("header, [role='banner']");
    const hasContentInfo = document.querySelector(
      "footer, [role='contentinfo']"
    );

    if (!hasMain) {
      foundIssues.push({
        type: "error",
        message: "Missing main landmark",
        fix: "Add <main> element or role='main'",
      });
    }

    if (!hasNavigation) {
      foundIssues.push({
        type: "warning",
        message: "Missing navigation landmark",
        fix: "Add <nav> element or role='navigation'",
      });
    }

    if (!hasBanner) {
      foundIssues.push({
        type: "warning",
        message: "Missing banner landmark",
        fix: "Add <header> element or role='banner'",
      });
    }

    if (!hasContentInfo) {
      foundIssues.push({
        type: "warning",
        message: "Missing contentinfo landmark",
        fix: "Add <footer> element or role='contentinfo'",
      });
    }

    setIssues(foundIssues);
    setIsAuditing(false);
  };

  useEffect(() => {
    // Run audit on component mount
    auditAccessibility();
  }, []);

  const getIssueIcon = (type: AccessibilityIssue["type"]) => {
    switch (type) {
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "info":
        return "ℹ️";
      default:
        return "ℹ️";
    }
  };

  const getIssueColor = (type: AccessibilityIssue["type"]) => {
    switch (type) {
      case "error":
        return "text-error-600 bg-error-50 border-error-200";
      case "warning":
        return "text-warning-600 bg-warning-50 border-warning-200";
      case "info":
        return "text-info-600 bg-info-50 border-info-200";
      default:
        return "text-secondary-600 bg-secondary-50 border-secondary-200";
    }
  };

  if (process.env.NODE_ENV === "production") {
    return null; // Don't show in production
  }

  return (
    <div className="fixed bottom-4 right-4 z-tooltip max-w-md">
      <div className="bg-white rounded-lg shadow-lg border border-secondary-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-secondary-900">
            Accessibility Audit
          </h3>
          <button
            onClick={auditAccessibility}
            disabled={isAuditing}
            className="btn btn-sm btn-primary"
          >
            {isAuditing ? "Auditing..." : "Refresh"}
          </button>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {issues.length === 0 ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">✅</div>
              <p className="text-sm text-success-600">
                No accessibility issues found!
              </p>
            </div>
          ) : (
            issues.map((issue, index) => (
              <div
                key={index}
                className={`p-3 rounded-md border ${getIssueColor(issue.type)}`}
              >
                <div className="flex items-start space-x-2">
                  <span className="text-sm">{getIssueIcon(issue.type)}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{issue.message}</p>
                    {issue.fix && (
                      <p className="text-xs mt-1 opacity-75">
                        Fix: {issue.fix}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-secondary-200">
          <div className="flex justify-between text-xs text-secondary-500">
            <span>Issues: {issues.length}</span>
            <span>
              Errors: {issues.filter((i) => i.type === "error").length} |
              Warnings: {issues.filter((i) => i.type === "warning").length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccessibilityAudit;
