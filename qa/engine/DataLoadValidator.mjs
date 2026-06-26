#!/usr/bin/env node
/**
 * Data Load Validator
 * Validates page content, API responses, and runtime health per category
 */

const IGNORE_CONSOLE = [
  "favicon",
  "analytics",
  "ANDROID_HOME",
  "Failed to load resource",
  "ResizeObserver",
];

export class DataLoadValidator {
  constructor(networkMonitor) {
    this.networkMonitor = networkMonitor;
  }

  isCriticalConsoleError(text) {
    if (!text) return false;
    return !IGNORE_CONSOLE.some((s) => text.includes(s));
  }

  async validatePageLoad(page, category, pagePath, navResult) {
    const issues = [];
    const checks = [];

    if (!navResult?.success && navResult?.status >= 400) {
      issues.push(`HTTP ${navResult.status}`);
    }

    const bodyLength = await page.evaluate(() => document.body?.innerText?.length || 0);
    checks.push({ name: "bodyContent", ok: bodyLength > 50, detail: `${bodyLength} chars` });
    if (bodyLength <= 50) issues.push("Page has insufficient content");

    const pageErrors = await page.evaluate(() => {
      return window.__qaPageErrors || 0;
    });

    const categoryChecks = await this.runCategoryHeuristics(page, category, pagePath);
    checks.push(...categoryChecks);

    for (const c of categoryChecks) {
      if (!c.ok) issues.push(c.detail || c.name);
    }

    let apiFailures = [];
    if (this.networkMonitor) {
      apiFailures = this.networkMonitor
        .getFailedRequests()
        .filter((r) => r.url.includes("/api/") && r.status >= 500);
      if (apiFailures.length > 0) {
        issues.push(`${apiFailures.length} API 5xx responses`);
      }
    }

    return {
      ok: issues.length === 0,
      issues,
      checks,
      bodyLength,
      apiFailures: apiFailures.slice(0, 5),
      pageErrors,
    };
  }

  async runCategoryHeuristics(page, category, pagePath) {
    const checks = [];

    if (category === "public" || pagePath.includes("/products")) {
      const count = await page.evaluate(() => {
        return document.querySelectorAll(
          'a[href*="/product"], [class*="product"], .bg-white.rounded-lg'
        ).length;
      });
      checks.push({
        name: "productsOrCards",
        ok: count > 0 || pagePath.includes("/login") || pagePath.includes("/signup"),
        detail: count > 0 ? `${count} product elements` : "No product elements found",
      });
    }

    if (category === "customer" && pagePath.includes("/orders")) {
      const hasOrders = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return (
          document.querySelectorAll("table tr, [class*='order']").length > 0 ||
          text.includes("no orders") ||
          text.includes("order history")
        );
      });
      checks.push({
        name: "ordersContent",
        ok: hasOrders,
        detail: hasOrders ? "Orders UI present" : "No orders UI or empty state",
      });
    }

    if (category === "admin") {
      const hasAdmin = await page.evaluate(() => {
        return (
          document.querySelectorAll("table, [class*='admin'], h1, h2").length > 0 ||
          document.body.innerText.toLowerCase().includes("admin")
        );
      });
      checks.push({
        name: "adminContent",
        ok: hasAdmin,
        detail: hasAdmin ? "Admin UI present" : "No admin content detected",
      });
    }

    if (category === "delivery") {
      const hasDelivery = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return (
          text.includes("delivery") ||
          text.includes("online") ||
          text.includes("offline") ||
          text.includes("login") ||
          text.includes("dashboard")
        );
      });
      checks.push({
        name: "deliveryContent",
        ok: hasDelivery,
        detail: hasDelivery ? "Delivery UI present" : "No delivery content detected",
      });
    }

    return checks;
  }

  validatePostClick(before, after) {
    const issues = [];
    const newConsoleErrors = after.consoleErrors - before.consoleErrors;
    const newPageErrors = after.pageErrors - before.pageErrors;

    if (newPageErrors > 0) issues.push(`${newPageErrors} new page errors`);
    if (newConsoleErrors > 3) issues.push(`${newConsoleErrors} new console errors`);

    return {
      ok: issues.length === 0,
      issues,
      urlChanged: before.url !== after.url,
      newConsoleErrors,
      newPageErrors,
    };
  }
}

export default DataLoadValidator;
