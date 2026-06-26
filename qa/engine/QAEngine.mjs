#!/usr/bin/env node
/**
 * Core QA Engine - Playwright wrapper with MCP integration
 * Provides the foundation for autonomous AI QA testing
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { NetworkMonitor } from "./NetworkMonitor.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class QAEngine {
  constructor(options = {}) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.baseUrl = options.baseUrl || "http://localhost:3000";
    this.headless = options.headless !== false;
    this.slowMo = options.slowMo || 0;
    this.viewport = options.viewport || { width: 1280, height: 800 };
    this.storageState = options.storageState || null;
    this.networkMonitor = options.networkMonitor || new NetworkMonitor();
    
    // Monitoring
    this.consoleErrors = [];
    this.networkRequests = [];
    this.networkFailures = [];
    this.socketEvents = [];
    this.pageErrors = [];
    
    // State tracking
    this.currentUrl = "";
    this.currentScreen = "";
    this.lastAction = null;
    this.actionHistory = [];
  }

  async launch() {
    console.log("🚀 Launching QA Engine...");
    this.browser = await chromium.launch({
      headless: this.headless,
      slowMo: this.slowMo,
    });
    
    const contextOptions = {
      viewport: this.viewport,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ignoreHTTPSErrors: true,
    };
    if (this.storageState) {
      contextOptions.storageState = this.storageState;
    }

    this.context = await this.browser.newContext(contextOptions);
    
    this.page = await this.context.newPage();
    this.setupMonitoring();
    this.networkMonitor.setupMonitoring(this.page);
    
    console.log("✅ QA Engine ready");
    return this;
  }

  setupMonitoring() {
    // Console error monitoring
    this.page.on("console", (msg) => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: Date.now(),
      };
      
      if (msg.type() === "error") {
        this.consoleErrors.push(entry);
        console.log(`🔴 Console Error: ${msg.text()}`);
      }
    });

    // Page error monitoring (crashes)
    this.page.on("pageerror", (err) => {
      const entry = {
        message: err.message,
        stack: err.stack,
        timestamp: Date.now(),
      };
      this.pageErrors.push(entry);
      console.log(`💥 Page Error: ${err.message}`);
    });

    // Network request monitoring
    this.page.on("request", (req) => {
      this.networkRequests.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        timestamp: Date.now(),
      });
    });

    // Network failure monitoring
    this.page.on("requestfailed", (req) => {
      const failure = {
        url: req.url(),
        method: req.method(),
        error: req.failure()?.errorText || "Unknown error",
        timestamp: Date.now(),
      };
      this.networkFailures.push(failure);
      console.log(`⚠️  Network Failure: ${req.url()} - ${failure.error}`);
    });

    // Response monitoring
    this.page.on("response", (res) => {
      const status = res.status();
      if (status >= 400) {
        console.log(`⚠️  HTTP ${status}: ${res.url()}`);
      }
    });
  }

  async navigate(url, options = {}) {
    const fullUrl = url.startsWith("http") ? url : `${this.baseUrl}${url}`;
    console.log(`📍 Navigating to: ${fullUrl}`);
    
    try {
      const response = await this.page.goto(fullUrl, {
        waitUntil: options.waitUntil || "networkidle",
        timeout: options.timeout || 15000,
      });
      
      this.currentUrl = fullUrl;
      this.currentScreen = this.extractScreenName(url);
      
      await this.page.waitForTimeout(options.delay || 1000);
      
      return {
        success: true,
        status: response?.status(),
        url: fullUrl,
      };
    } catch (err) {
      console.error(`❌ Navigation failed: ${err.message}`);
      return {
        success: false,
        error: err.message,
        url: fullUrl,
      };
    }
  }

  extractScreenName(url) {
    const path = url.replace(this.baseUrl, "").replace(/^\//, "");
    return path || "home";
  }

  async click(selector, options = {}) {
    console.log(`🖱️  Clicking: ${selector}`);
    
    try {
      await this.page.click(selector, {
        timeout: options.timeout || 5000,
        force: options.force || false,
      });
      
      this.lastAction = {
        type: "click",
        selector,
        timestamp: Date.now(),
      };
      this.actionHistory.push(this.lastAction);
      
      await this.page.waitForTimeout(options.delay || 500);
      
      return { success: true };
    } catch (err) {
      console.error(`❌ Click failed: ${err.message}`);
      return {
        success: false,
        error: err.message,
        selector,
      };
    }
  }

  async fill(selector, value, options = {}) {
    console.log(`⌨️  Filling: ${selector} = "${value}"`);
    
    try {
      await this.page.fill(selector, value);
      
      this.lastAction = {
        type: "fill",
        selector,
        value,
        timestamp: Date.now(),
      };
      this.actionHistory.push(this.lastAction);
      
      await this.page.waitForTimeout(options.delay || 300);
      
      return { success: true };
    } catch (err) {
      console.error(`❌ Fill failed: ${err.message}`);
      return {
        success: false,
        error: err.message,
        selector,
      };
    }
  }

  async waitForSelector(selector, options = {}) {
    try {
      await this.page.waitForSelector(selector, {
        timeout: options.timeout || 5000,
        state: options.state || "visible",
      });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        selector,
      };
    }
  }

  async isVisible(selector) {
    try {
      const element = await this.page.locator(selector).first();
      const visible = await element.isVisible();
      return visible;
    } catch {
      return false;
    }
  }

  async getText(selector) {
    try {
      const text = await this.page.locator(selector).first().textContent();
      return text?.trim() || "";
    } catch {
      return "";
    }
  }

  async screenshot(filename, options = {}) {
    const dir = path.join(__dirname, "..", "screenshots");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const filepath = path.join(dir, filename);
    await this.page.screenshot({
      path: filepath,
      fullPage: options.fullPage || true,
    });
    
    console.log(`📸 Screenshot saved: ${filename}`);
    return filepath;
  }

  async getDOM() {
    return await this.page.content();
  }

  async evaluate(fn) {
    return await this.page.evaluate(fn);
  }

  async discoverElements() {
    const elements = await this.page.evaluate(() => {
      const result = {
        buttons: [],
        links: [],
        inputs: [],
        forms: [],
        headings: [],
      };

      const buildSelector = (el) => {
        const testId = el.getAttribute("data-testid") || el.getAttribute("testid");
        if (testId) return `[data-testid="${testId}"]`;
        const aria = el.getAttribute("aria-label");
        if (aria) return `[aria-label="${aria.replace(/"/g, '\\"')}"]`;
        const name = el.getAttribute("name");
        if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
        const href = el.getAttribute("href");
        if (href && el.tagName === "A") return `a[href="${href}"]`;
        const text = (el.textContent || "").trim().slice(0, 40);
        if (text) return `${el.tagName.toLowerCase()}:has-text("${text}")`;
        return el.tagName.toLowerCase();
      };

      document.querySelectorAll("button, [role='button']").forEach((btn) => {
        result.buttons.push({
          text: btn.textContent?.trim() || btn.getAttribute("aria-label") || "",
          selector: buildSelector(btn),
          testId: btn.getAttribute("data-testid") || btn.getAttribute("testid"),
          disabled: btn.disabled || btn.getAttribute("aria-disabled") === "true",
        });
      });

      document.querySelectorAll("a[href]").forEach((a) => {
        result.links.push({
          text: a.textContent?.trim() || a.getAttribute("aria-label") || "",
          href: a.getAttribute("href"),
          selector: buildSelector(a),
        });
      });

      document.querySelectorAll("input, textarea, select").forEach((input) => {
        result.inputs.push({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name || "",
          placeholder: input.placeholder || "",
          selector: buildSelector(input),
        });
      });

      document.querySelectorAll("form").forEach((form) => {
        result.forms.push({
          action: form.action || "",
          method: form.method || "GET",
          selector: buildSelector(form),
        });
      });

      document.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
        result.headings.push({
          tag: h.tagName,
          text: h.textContent?.trim() || "",
          selector: buildSelector(h),
        });
      });

      return result;
    });

    return elements;
  }

  async screenshotTo(filepath, options = {}) {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await this.page.screenshot({ path: filepath, fullPage: options.fullPage !== false });
    return filepath;
  }

  async getMetrics() {
    return {
      consoleErrors: [...this.consoleErrors],
      networkRequests: [...this.networkRequests],
      networkFailures: [...this.networkFailures],
      pageErrors: [...this.pageErrors],
      actionHistory: [...this.actionHistory],
      currentUrl: this.currentUrl,
      currentScreen: this.currentScreen,
    };
  }

  async resetMetrics() {
    this.consoleErrors = [];
    this.networkRequests = [];
    this.networkFailures = [];
    this.pageErrors = [];
    this.actionHistory = [];
    this.networkMonitor?.reset();
  }

  async close() {
    console.log("🛑 Closing QA Engine...");
    if (this.browser) await this.browser.close();
    console.log("✅ QA Engine closed");
  }

  async healthCheck() {
    const metrics = await this.getMetrics();
    const hasErrors = metrics.consoleErrors.length > 0 || metrics.pageErrors.length > 0;
    const hasNetworkFailures = metrics.networkFailures.length > 0;
    
    return {
      healthy: !hasErrors && !hasNetworkFailures,
      errors: metrics.consoleErrors.length,
      pageErrors: metrics.pageErrors.length,
      networkFailures: metrics.networkFailures.length,
      metrics,
    };
  }
}

export default QAEngine;
