#!/usr/bin/env node
/**
 * Page Interaction Runner
 * Visits every manifest page, validates data load, clicks all buttons
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { QAEngine } from "./QAEngine.mjs";
import { AuthSessionManager } from "./AuthSessionManager.mjs";
import { TestFixtureSeeder } from "./TestFixtureSeeder.mjs";
import { DataLoadValidator } from "./DataLoadValidator.mjs";
import { ButtonClickExecutor } from "./ButtonClickExecutor.mjs";
import { WorkflowDiscovery } from "./WorkflowDiscovery.mjs";
import { FlowCoverage } from "./FlowCoverage.mjs";
import { ConsoleMonitor } from "./ConsoleMonitor.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class PageInteractionRunner {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "http://localhost:3000";
    this.headless = options.headless !== false;
    this.fullMode = options.fullMode !== false;
    this.categoryFilter = options.category || null;
    this.results = [];
    this.authManager = new AuthSessionManager({ baseUrl: this.baseUrl });
    this.seeder = new TestFixtureSeeder();
    this.flowCoverage = new FlowCoverage();
    this.consoleMonitor = new ConsoleMonitor();
  }

  loadManifest(manifestPath) {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  }

  async run(manifestPath) {
    const manifest = this.loadManifest(manifestPath);
    const fixtures = await this.seeder.seed(manifest);
    manifest.fixtures = { ...manifest.fixtures, ...fixtures };

    const categories = Object.keys(manifest.categories).filter(
      (c) => !this.categoryFilter || c === this.categoryFilter
    );

    console.log(`\n🔎 Page Interaction Runner — ${this.fullMode ? "FULL" : "LOAD"} mode`);
    console.log(`   Categories: ${categories.join(", ")}\n`);

    for (const category of categories) {
      await this.runCategory(category, manifest);
    }

    const summary = this.buildSummary();
    return {
      timestamp: new Date().toISOString(),
      mode: this.fullMode ? "full" : "load",
      fixtures: manifest.fixtures,
      pages: this.results,
      summary,
      coverage: this.flowCoverage.getOverallCoverage(),
      healthScore: this.consoleMonitor.getHealthScore?.() || 100,
    };
  }

  async runCategory(category, manifest) {
    const authCategory = this.authManager.resolveAuthCategory(category);
    let storageState = null;

    if (this.authManager.needsAuth(category)) {
      const browser = await (await import("playwright")).chromium.launch({ headless: true });
      const session = await this.authManager.getOrCreateSession(authCategory, manifest, browser);
      await browser.close();
      if (session?.storageState) {
        storageState =
          typeof session.storageState === "string"
            ? session.storageState
            : session.storageState;
      }
    }

    const engine = new QAEngine({
      baseUrl: this.baseUrl,
      headless: this.headless,
      storageState,
    });
    await engine.launch();
    this.consoleMonitor.setupMonitoring(engine.page);

    const validator = new DataLoadValidator(engine.networkMonitor);
    const clickExecutor = new ButtonClickExecutor(engine, { fullMode: this.fullMode });
    const discovery = new WorkflowDiscovery(engine);

    const pages = manifest.categories[category].pages;
    console.log(`\n📂 ${category.toUpperCase()} (${pages.length} pages)`);

    for (const pageInfo of pages) {
      const resolvedPath = this.seeder.resolvePath(pageInfo.path);
      const screenName = `${category}_${pageInfo.name.replace(/\s+/g, "_").toLowerCase()}`;

      const recoverPage = async () => {
        if (this.authManager.needsAuth(category)) {
          await this.authManager.refreshSession(engine, authCategory, manifest);
        }
        await engine.navigate(resolvedPath);
        await engine.resetMetrics();
      };

      console.log(`   → ${pageInfo.name} (${resolvedPath})`);

      const navResult = await engine.navigate(resolvedPath);
      await engine.resetMetrics();

      const loadValidation = await validator.validatePageLoad(
        engine.page,
        category,
        resolvedPath,
        navResult
      );

      let buttonResults = [];
      let discovered = null;

      if (loadValidation.ok) {
        this.flowCoverage.markFlowCovered(
          category === "delivery" ? "delivery" : category === "admin" ? "admin" : "customer",
          category === "public" ? "browse" : "dashboard"
        );
      }

      discovered = await discovery.discoverScreen(screenName, resolvedPath);
      await discovery.discoverButtonActions(screenName);

      if (this.fullMode && loadValidation.ok) {
        buttonResults = await clickExecutor.clickAll(
          `${this.baseUrl}${resolvedPath}`,
          category,
          pageInfo.name,
          { recoverPage }
        );
      }

      const clicked = buttonResults.filter((r) => r.status === "clicked").length;
      const failed = buttonResults.filter((r) => r.status === "failed").length;

      if (clicked > 0) {
        this.flowCoverage.markFlowCovered("customer", "browse");
      }

      const pageResult = {
        category,
        name: pageInfo.name,
        path: resolvedPath,
        originalPath: pageInfo.path,
        loadValidation,
        discovered: {
          buttons: discovered?.buttons?.length || 0,
          links: discovered?.links?.length || 0,
        },
        buttonResults,
        status: loadValidation.ok && failed === 0 ? "ok" : loadValidation.ok ? "partial" : "error",
        summary: {
          loadOk: loadValidation.ok,
          buttonsClicked: clicked,
          buttonsFailed: failed,
          buttonsSkipped: buttonResults.filter((r) => r.status === "skipped").length,
        },
      };

      if (!loadValidation.ok || failed > 0) {
        const ssDir = path.join(__dirname, "..", "screenshots", "interaction", category);
        pageResult.screenshot = await engine.screenshotTo(
          path.join(
            ssDir,
            `${pageInfo.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_page.png`
          )
        );
      }

      this.results.push(pageResult);
      console.log(
        `      ${pageResult.status === "ok" ? "✅" : pageResult.status === "partial" ? "⚠️" : "❌"} load=${loadValidation.ok} clicks=${clicked} failed=${failed}`
      );
    }

    await engine.close();
  }

  buildSummary() {
    const total = this.results.length;
    const ok = this.results.filter((r) => r.status === "ok").length;
    const partial = this.results.filter((r) => r.status === "partial").length;
    const error = this.results.filter((r) => r.status === "error").length;
    const totalClicks = this.results.reduce((s, r) => s + (r.summary?.buttonsClicked || 0), 0);
    const failedClicks = this.results.reduce((s, r) => s + (r.summary?.buttonsFailed || 0), 0);

    return {
      totalPages: total,
      totalTests: total,
      totalSteps: total,
      passed: ok,
      partial,
      failed: error + partial,
      errors: error,
      successRate: total > 0 ? Math.round((ok / total) * 100) : 0,
      totalClicks,
      failedClicks,
    };
  }

  saveResults(outputPath, report) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

    const coveragePath = path.join(dir, "coverage-report.json");
    fs.writeFileSync(
      coveragePath,
      JSON.stringify(report.coverage, null, 2)
    );

    console.log(`\n💾 Results: ${outputPath}`);
    console.log(`💾 Coverage: ${coveragePath}`);
  }
}

export default PageInteractionRunner;
