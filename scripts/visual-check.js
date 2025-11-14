#!/usr/bin/env node

/**
 * Visual Check Script for CS Store
 * Checks for UI overlaps and accessibility issues
 */

const fs = require("fs");
const path = require("path");

console.log("🔍 CS Store Visual Check");
console.log("========================");

// Check for common UI overlap issues
const checkUIOverlaps = () => {
  console.log("\n📱 Checking for UI overlaps...");

  const issues = [];

  // Check frontend components for potential overlaps
  const componentFiles = [
    "frontend/src/components/TopNav.tsx",
    "frontend/src/components/BottomNav.tsx",
    "frontend/src/components/FloatingCartCTA.tsx",
    "frontend/src/pages/HomePage.tsx",
    "frontend/src/pages/ProductsPage.tsx",
    "frontend/src/pages/CartPage.tsx",
    "frontend/src/pages/CheckoutPage.tsx",
  ];

  componentFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");

      // Check for fixed positioning that might overlap
      if (content.includes("fixed") && content.includes("z-index")) {
        const zIndexMatches = content.match(/z-index:\s*(\d+)/g);
        if (zIndexMatches && zIndexMatches.length > 1) {
          const zIndexes = zIndexMatches.map((match) =>
            parseInt(match.split(":")[1].trim())
          );
          const duplicates = zIndexes.filter(
            (item, index) => zIndexes.indexOf(item) !== index
          );
          if (duplicates.length > 0) {
            issues.push(
              `⚠️  Duplicate z-index values in ${file}: ${duplicates.join(
                ", "
              )}`
            );
          }
        }
      }

      // Check for overlapping elements
      if (content.includes("absolute") && content.includes("fixed")) {
        issues.push(
          `⚠️  Mixed positioning (absolute + fixed) in ${file} may cause overlaps`
        );
      }

      // Check for missing responsive breakpoints
      if (
        content.includes("hidden") &&
        !content.includes("md:") &&
        !content.includes("lg:")
      ) {
        issues.push(
          `⚠️  Hidden elements without responsive variants in ${file}`
        );
      }
    }
  });

  return issues;
};

// Check accessibility issues
const checkAccessibility = () => {
  console.log("\n♿ Checking accessibility...");

  const issues = [];

  const componentFiles = [
    "frontend/src/components/TopNav.tsx",
    "frontend/src/components/BottomNav.tsx",
    "frontend/src/components/FloatingCartCTA.tsx",
    "frontend/src/pages/HomePage.tsx",
    "frontend/src/pages/ProductsPage.tsx",
    "frontend/src/pages/CartPage.tsx",
    "frontend/src/pages/CheckoutPage.tsx",
    "frontend/src/pages/OrderTrackingPage.tsx",
    "frontend/src/pages/OrdersPage.tsx",
    "frontend/src/pages/ProfilePage.tsx",
    "frontend/src/pages/MenuPage.tsx",
    "frontend/src/pages/AdminDashboard.tsx",
    "frontend/src/pages/AdminDeliveryMap.tsx",
    "frontend/src/pages/DeliveryDashboard.tsx",
    "frontend/src/pages/LoginPage.tsx",
    "frontend/src/pages/SignupPage.tsx",
  ];

  componentFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");

      // Check for missing ARIA labels
      const buttons = content.match(/<button[^>]*>/g) || [];
      const inputs = content.match(/<input[^>]*>/g) || [];
      const links = content.match(/<a[^>]*>/g) || [];

      buttons.forEach((button) => {
        if (
          !button.includes("aria-label") &&
          !button.includes("aria-labelledby") &&
          !button.includes("children")
        ) {
          issues.push(`⚠️  Button missing ARIA label in ${file}: ${button}`);
        }
      });

      inputs.forEach((input) => {
        if (
          !input.includes("aria-label") &&
          !input.includes("aria-labelledby") &&
          !input.includes("placeholder")
        ) {
          issues.push(`⚠️  Input missing ARIA label in ${file}: ${input}`);
        }
      });

      // Check for missing focus states
      if (
        content.includes("onClick") &&
        !content.includes("onKeyDown") &&
        !content.includes("onKeyPress")
      ) {
        issues.push(
          `⚠️  Interactive elements missing keyboard handlers in ${file}`
        );
      }

      // Check for missing alt text on images
      const images = content.match(/<img[^>]*>/g) || [];
      images.forEach((img) => {
        if (!img.includes("alt=")) {
          issues.push(`⚠️  Image missing alt text in ${file}: ${img}`);
        }
      });

      // Check for proper heading hierarchy
      const headings = content.match(/<h[1-6][^>]*>/g) || [];
      if (headings.length > 0) {
        const h1Count = headings.filter((h) => h.startsWith("<h1")).length;
        if (h1Count === 0) {
          issues.push(`⚠️  Page missing H1 heading in ${file}`);
        }
        if (h1Count > 1) {
          issues.push(`⚠️  Multiple H1 headings in ${file} (${h1Count})`);
        }
      }
    }
  });

  return issues;
};

// Check performance optimizations
const checkPerformance = () => {
  console.log("\n⚡ Checking performance optimizations...");

  const issues = [];

  // Check for lazy loading implementation
  const lazyLoadFiles = [
    "frontend/src/components/ProductCard.tsx",
    "frontend/src/pages/ProductsPage.tsx",
    "frontend/src/pages/HomePage.tsx",
  ];

  lazyLoadFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");

      // Check for lazy loading
      if (
        content.includes("img") &&
        !content.includes('loading="lazy"') &&
        !content.includes("IntersectionObserver")
      ) {
        issues.push(`⚠️  Images not lazy loaded in ${file}`);
      }

      // Check for code splitting
      if (content.includes("import(") && !content.includes("React.lazy")) {
        issues.push(`⚠️  Dynamic imports without React.lazy in ${file}`);
      }
    }
  });

  // Check bundle optimization
  const packageJson = JSON.parse(
    fs.readFileSync("frontend/package.json", "utf8")
  );
  if (
    packageJson.dependencies &&
    Object.keys(packageJson.dependencies).length > 50
  ) {
    issues.push(
      `⚠️  Large number of dependencies (${
        Object.keys(packageJson.dependencies).length
      })`
    );
  }

  return issues;
};

// Check security implementations
const checkSecurity = () => {
  console.log("\n🔒 Checking security implementations...");

  const issues = [];

  // Check backend for security issues
  const backendFiles = [
    "backend/src/controllers/authController.ts",
    "backend/src/controllers/orderController.ts",
    "backend/src/controllers/paymentController.ts",
    "backend/src/controllers/webhookController.ts",
  ];

  backendFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");

      // Check for secret logging
      if (
        content.includes("console.log") &&
        (content.includes("password") ||
          content.includes("secret") ||
          content.includes("token"))
      ) {
        issues.push(`⚠️  Potential secret logging in ${file}`);
      }

      // Check for input validation
      if (
        content.includes("req.body") &&
        !content.includes("validate") &&
        !content.includes("sanitize")
      ) {
        issues.push(`⚠️  Missing input validation in ${file}`);
      }

      // Check for Razorpay signature verification
      if (
        content.includes("razorpay") &&
        !content.includes("signature") &&
        !content.includes("verify")
      ) {
        issues.push(`⚠️  Missing Razorpay signature verification in ${file}`);
      }
    }
  });

  return issues;
};

// Check logging and monitoring
const checkLogging = () => {
  console.log("\n📊 Checking logging and monitoring...");

  const issues = [];

  // Check for Sentry integration
  const frontendPackageJson = JSON.parse(
    fs.readFileSync("frontend/package.json", "utf8")
  );
  const backendPackageJson = JSON.parse(
    fs.readFileSync("backend/package.json", "utf8")
  );

  if (
    !frontendPackageJson.dependencies["@sentry/react"] &&
    !frontendPackageJson.dependencies["@sentry/browser"]
  ) {
    issues.push(`⚠️  Sentry not integrated in frontend`);
  }

  if (!backendPackageJson.dependencies["@sentry/node"]) {
    issues.push(`⚠️  Sentry not integrated in backend`);
  }

  // Check for proper error logging
  const backendFiles = [
    "backend/src/controllers/authController.ts",
    "backend/src/controllers/orderController.ts",
    "backend/src/controllers/paymentController.ts",
    "backend/src/controllers/webhookController.ts",
  ];

  backendFiles.forEach((file) => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf8");

      if (
        content.includes("catch") &&
        !content.includes("console.error") &&
        !content.includes("logger")
      ) {
        issues.push(`⚠️  Missing error logging in ${file}`);
      }
    }
  });

  return issues;
};

// Run all checks
const runChecks = () => {
  const uiIssues = checkUIOverlaps();
  const accessibilityIssues = checkAccessibility();
  const performanceIssues = checkPerformance();
  const securityIssues = checkSecurity();
  const loggingIssues = checkLogging();

  const allIssues = [
    ...uiIssues,
    ...accessibilityIssues,
    ...performanceIssues,
    ...securityIssues,
    ...loggingIssues,
  ];

  console.log("\n📋 Summary");
  console.log("==========");

  if (allIssues.length === 0) {
    console.log("✅ All checks passed! No issues found.");
  } else {
    console.log(`❌ Found ${allIssues.length} issues:`);
    allIssues.forEach((issue) => console.log(issue));
  }

  return allIssues.length === 0;
};

// Export for testing
module.exports = {
  checkUIOverlaps,
  checkAccessibility,
  checkPerformance,
  checkSecurity,
  checkLogging,
  runChecks,
};

// Run if called directly
if (require.main === module) {
  const success = runChecks();
  process.exit(success ? 0 : 1);
}
