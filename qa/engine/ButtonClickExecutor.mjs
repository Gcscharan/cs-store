#!/usr/bin/env node
/**
 * Button Click Executor
 * Discovers and clicks interactive elements in full mode
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DESTRUCTIVE_PATTERNS = [
  /logout/i,
  /log out/i,
  /sign out/i,
  /delete/i,
  /remove/i,
  /place order/i,
  /cancel order/i,
  /submit payment/i,
  /confirm payment/i,
];

export class ButtonClickExecutor {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.screenshotDir =
      options.screenshotDir ||
      path.join(__dirname, "..", "screenshots", "interaction");
    this.fullMode = options.fullMode !== false;
  }

  isDestructive(label) {
    return DESTRUCTIVE_PATTERNS.some((p) => p.test(label || ""));
  }

  async discoverClickables() {
    return await this.engine.page.evaluate(() => {
      const items = [];
      const seen = new Set();

      const add = (el, type) => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;
        if (el.disabled || el.getAttribute("aria-disabled") === "true") return;

        const text = (
          el.getAttribute("aria-label") ||
          el.getAttribute("title") ||
          el.textContent ||
          ""
        )
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 80);

        const testId = el.getAttribute("data-testid") || el.getAttribute("testid");
        const href = el.getAttribute("href");
        const key = `${type}:${testId || text || href || el.tagName}`;
        if (seen.has(key) || (!text && !testId && !href)) return;
        seen.add(key);

        items.push({
          type,
          text,
          testId,
          href,
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role"),
        });
      };

      document.querySelectorAll("button").forEach((el) => add(el, "button"));
      document
        .querySelectorAll('[role="button"], [role="tab"], input[type="submit"], input[type="button"]')
        .forEach((el) => add(el, "role-button"));
      document.querySelectorAll("a[href]").forEach((el) => {
        const href = el.getAttribute("href") || "";
        if (href.startsWith("#") || href === "") return;
        add(el, "link");
      });

      return items;
    });
  }

  buildLocator(item) {
    const page = this.engine.page;
    if (item.testId) {
      return page.getByTestId(item.testId).first();
    }
    if (item.type === "link" && item.href) {
      return page.locator(`a[href="${item.href}"]`).first();
    }
    if (item.text) {
      if (item.type === "link") {
        return page.getByRole("link", { name: item.text, exact: false }).first();
      }
      return page.getByRole("button", { name: item.text, exact: false }).first();
    }
    return null;
  }

  async screenshotOnFailure(category, pageName, item, suffix) {
    const safePage = pageName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const safeBtn = (item.text || item.testId || "element")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase()
      .slice(0, 40);
    const dir = path.join(this.screenshotDir, category, safePage);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, `${safeBtn}_${suffix}.png`);
    await this.engine.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  getMetricsSnapshot() {
    return {
      url: this.engine.page.url(),
      consoleErrors: this.engine.consoleErrors.length,
      pageErrors: this.engine.pageErrors.length,
    };
  }

  async clickAll(pageUrl, category, pageName, options = {}) {
    const results = [];
    const clickables = await this.discoverClickables();

    for (let i = 0; i < clickables.length; i++) {
      const item = clickables[i];
      const label = item.text || item.testId || item.href || `element-${i}`;
      const destructive = this.isDestructive(label);

      const locator = this.buildLocator(item);
      if (!locator) {
        results.push({
          label,
          status: "skipped",
          reason: "No locator",
          destructive,
        });
        continue;
      }

      const before = this.getMetricsSnapshot();

      try {
        const visible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
        if (!visible) {
          results.push({ label, status: "skipped", reason: "Not visible", destructive });
          continue;
        }

        await locator.click({ timeout: 5000 });
        await this.engine.page.waitForTimeout(1500);

        const after = this.getMetricsSnapshot();
        const urlLeftPage = !after.url.includes(pageUrl.replace(this.engine.baseUrl, ""));

        results.push({
          label,
          status: "clicked",
          destructive,
          urlChanged: before.url !== after.url,
          urlLeftPage,
          newErrors: after.consoleErrors - before.consoleErrors,
        });

        if (urlLeftPage && options.recoverPage) {
          await options.recoverPage();
        } else if (urlLeftPage) {
          await this.engine.page.goBack({ timeout: 5000 }).catch(() => null);
          await this.engine.page.waitForTimeout(1000);
        }
      } catch (err) {
        const screenshot = await this.screenshotOnFailure(category, pageName, item, "fail");
        results.push({
          label,
          status: "failed",
          error: err.message,
          destructive,
          screenshot,
        });

        if (options.recoverPage) {
          await options.recoverPage();
        }
      }
    }

    return results;
  }
}

export default ButtonClickExecutor;
