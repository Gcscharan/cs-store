#!/usr/bin/env node
/**
 * Mobile Delivery Agent
 * Tests React Native delivery screens via Expo web
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { QAEngine } from "../engine/QAEngine.mjs";
import { ButtonClickExecutor } from "../engine/ButtonClickExecutor.mjs";
import { DataLoadValidator } from "../engine/DataLoadValidator.mjs";
import { FlowCoverage } from "../engine/FlowCoverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function detectExpoUrl() {
  const candidates = [
    process.env.EXPO_WEB_URL,
    "http://localhost:8081",
    "http://localhost:19006",
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status < 500) return url;
    } catch {
      // try next
    }
  }
  return "http://localhost:8081";
}

export class MobileDeliveryAgent {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || null;
    this.headless = options.headless !== false;
    this.fullMode = options.fullMode !== false;
    this.flowCoverage = new FlowCoverage();
    this.results = [];
  }

  loadManifest() {
    const manifestPath = path.join(
      __dirname,
      "..",
      "..",
      "apps",
      "customer-app",
      "delivery-screens-manifest.json"
    );
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  }

  async login(engine, creds) {
    await engine.navigate("/");
    await engine.page.waitForTimeout(2000);

    const emailInput = engine.page.locator('input[placeholder*="email" i], input[type="email"]').first();
    const passwordInput = engine.page.locator('input[type="password"]').first();

    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(creds.email);
      await passwordInput.fill(creds.password);
      const loginBtn = engine.page.getByText(/log in|login|sign in/i).first();
      await loginBtn.click({ timeout: 5000 }).catch(async () => {
        await engine.page.locator('div[role="button"]').filter({ hasText: /log in|login/i }).first().click();
      });
      await engine.page.waitForTimeout(3000);
      return true;
    }

    return false;
  }

  async navigateToScreen(engine, screenRoute) {
    const navigated = await engine.page.evaluate((route) => {
      if (window.__navigate) {
        window.__navigate(route);
        return true;
      }
      return false;
    }, screenRoute);

    if (!navigated) {
      const link = engine.page.getByText(new RegExp(screenRoute.replace("Delivery", ""), "i")).first();
      if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
        await link.click();
        await engine.page.waitForTimeout(1500);
      }
    }
  }

  async run() {
    const manifest = this.loadManifest();
    this.baseUrl = this.baseUrl || (await detectExpoUrl());
    const creds = {
      email: process.env.DELIVERY_EMAIL || manifest.credentials.email,
      password: process.env.DELIVERY_PASSWORD || manifest.credentials.password,
    };

    console.log(`\n📱 Mobile Delivery Agent — ${this.baseUrl}`);

    const engine = new QAEngine({ baseUrl: this.baseUrl, headless: this.headless });
    await engine.launch();

    const loggedIn = await this.login(engine, creds);
    if (loggedIn) {
      this.flowCoverage.markFlowCovered("delivery", "login");
    }

    const validator = new DataLoadValidator(engine.networkMonitor);
    const clickExecutor = new ButtonClickExecutor(engine, { fullMode: this.fullMode });

    for (const screen of manifest.screens) {
      console.log(`   → ${screen.name}`);
      await this.navigateToScreen(engine, screen.route);
      await engine.page.waitForTimeout(2000);

      const navResult = { success: true, status: 200 };
      const loadValidation = await validator.validatePageLoad(
        engine.page,
        "delivery",
        screen.route,
        navResult
      );

      let buttonResults = [];
      if (this.fullMode && loadValidation.ok) {
        buttonResults = await clickExecutor.clickAll(
          this.baseUrl,
          "mobile-delivery",
          screen.name,
          {
            recoverPage: async () => {
              await this.navigateToScreen(engine, screen.route);
            },
          }
        );
      }

      const clicked = buttonResults.filter((r) => r.status === "clicked").length;
      const failed = buttonResults.filter((r) => r.status === "failed").length;

      this.results.push({
        screen: screen.name,
        loadValidation,
        buttonResults,
        status: loadValidation.ok && failed === 0 ? "ok" : loadValidation.ok ? "partial" : "error",
        summary: { buttonsClicked: clicked, buttonsFailed: failed },
      });

      console.log(
        `      ${loadValidation.ok ? "✅" : "❌"} load=${loadValidation.ok} clicks=${clicked} failed=${failed}`
      );
    }

    await engine.close();

    const ok = this.results.filter((r) => r.status === "ok").length;
    return {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      screens: this.results,
      summary: {
        totalScreens: this.results.length,
        totalTests: this.results.length,
        totalSteps: this.results.length,
        passed: ok,
        failed: this.results.length - ok,
        successRate:
          this.results.length > 0 ? Math.round((ok / this.results.length) * 100) : 0,
      },
      coverage: this.flowCoverage.getOverallCoverage(),
    };
  }
}

export default MobileDeliveryAgent;
