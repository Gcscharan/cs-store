#!/usr/bin/env node
/**
 * Automated Page Testing - Tests all pages without manual intervention
 * Uses Playwright to systematically verify every route works
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MANIFEST_PATH = path.join(__dirname, "..", "mcp-pages-manifest.json");
const SCREENSHOT_DIR = path.join(__dirname, "..", "mcp-screenshots", "auto-test");
const REPORT_PATH = path.join(__dirname, "..", "all-pages-test-report.json");

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function testPage(browser, baseUrl, pageInfo, category) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });
  const page = await context.newPage();
  await page.bringToFront();

  const consoleErrors = [];
  const networkFailures = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().substring(0, 200));
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(err.message.substring(0, 200));
  });
  page.on("requestfailed", (req) => {
    const url = req.url();
    if (!url.includes("google") && !url.includes("analytics")) {
      networkFailures.push(`${url}: ${req.failure()?.errorText || "failed"}`);
    }
  });

  const safeName = `${category}_${pageInfo.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
  const screenshotPath = path.join(SCREENSHOT_DIR, `${safeName}.png`);

  const startTime = Date.now();

  try {
    if (pageInfo.path.includes(":")) {
      await context.close();
      return {
        path: pageInfo.path,
        name: pageInfo.name,
        category,
        status: "skipped",
        url: `${baseUrl}${pageInfo.path}`,
        loadTimeMs: 0,
        consoleErrors: [],
        networkFailures: [],
        screenshot: "",
        hasContent: false,
        hasImages: false,
        hasLinks: false,
        error: "Parameterized route - skipped",
      };
    }

    const url = `${baseUrl}${pageInfo.path}`;
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 15000,
    });

    const loadTimeMs = Date.now() - startTime;
    const httpStatus = response?.status() ?? 0;

    const hasContent = await page.evaluate(() => document.body.innerText.length > 100);
    const hasImages = await page.evaluate(() => document.querySelectorAll("img").length > 0);
    const hasLinks = await page.evaluate(() => document.querySelectorAll("a").length > 0);

    await page.waitForTimeout(1500);

    await ensureDir(SCREENSHOT_DIR);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await context.close();

    let status = "ok";
    let error = undefined;

    if (httpStatus >= 400) {
      status = "error";
      error = `HTTP ${httpStatus}`;
    } else if (!hasContent) {
      status = "error";
      error = "Page has no content";
    } else if (consoleErrors.length > 5) {
      status = "error";
      error = `Too many console errors (${consoleErrors.length})`;
    }

    return {
      path: pageInfo.path,
      name: pageInfo.name,
      category,
      status,
      url,
      loadTimeMs,
      httpStatus,
      consoleErrors: consoleErrors.slice(0, 5),
      networkFailures: networkFailures.slice(0, 5),
      screenshot: screenshotPath,
      hasContent,
      hasImages,
      hasLinks,
      error,
    };
  } catch (err) {
    await context.close();
    return {
      path: pageInfo.path,
      name: pageInfo.name,
      category,
      status: "error",
      url: `${baseUrl}${pageInfo.path}`,
      loadTimeMs: Date.now() - startTime,
      consoleErrors: consoleErrors.slice(0, 5),
      networkFailures: networkFailures.slice(0, 5),
      screenshot: "",
      hasContent: false,
      hasImages: false,
      hasLinks: false,
      error: err.message,
    };
  }
}

async function main() {
  console.log("🤖 Automated Page Testing - All Pages\n");

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("❌ Manifest not found:", MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  console.log(`🌐 Testing: ${baseUrl}\n`);

  // Check frontend
  try {
    const res = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch {
    console.error(`❌ Frontend not responding at ${baseUrl}`);
    console.log("   Start: cd frontend && npm run dev -- --port 3000");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const allResults = [];
  const summaryByCategory = {};

  for (const [catKey, catData] of Object.entries(manifest.categories)) {
    console.log(`\n📂 ${catKey.toUpperCase()}: ${catData.description}`);
    console.log(`   ${catData.pages.length} pages`);

    summaryByCategory[catKey] = { total: 0, passed: 0, failed: 0 };

    for (const pageInfo of catData.pages) {
      process.stdout.write(`   Testing ${pageInfo.name}... `);

      const result = await testPage(browser, baseUrl, pageInfo, catKey);
      allResults.push(result);

      summaryByCategory[catKey].total++;
      if (result.status === "ok") {
        summaryByCategory[catKey].passed++;
        process.stdout.write(`✅ ${result.loadTimeMs}ms\n`);
      } else if (result.status === "skipped") {
        process.stdout.write(`⏭️  skipped\n`);
      } else {
        summaryByCategory[catKey].failed++;
        process.stdout.write(`❌ ${result.error?.substring(0, 50)}\n`);
      }
    }
  }

  await browser.close();

  const passed = allResults.filter((r) => r.status === "ok").length;
  const failed = allResults.filter((r) => r.status === "error").length;
  const skipped = allResults.filter((r) => r.status === "skipped").length;

  const report = {
    timestamp: new Date().toISOString(),
    baseUrl,
    totalPages: allResults.length,
    passed,
    failed,
    skipped,
    results: allResults,
    summaryByCategory,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\n${"=".repeat(50)}`);
  console.log("📊 TEST SUMMARY");
  console.log(`${"=".repeat(50)}`);
  console.log(`   Total Pages: ${report.totalPages}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log();

  console.log("📁 By Category:");
  for (const [cat, stats] of Object.entries(summaryByCategory)) {
    const icon = stats.failed === 0 ? "✅" : "⚠️";
    console.log(`   ${icon} ${cat}: ${stats.passed}/${stats.total} passed`);
  }

  console.log(`\n📄 Report: ${REPORT_PATH}`);
  console.log(`📸 Screenshots: ${SCREENSHOT_DIR}/`);

  if (failed > 0) {
    console.log(`\n❌ FAILED PAGES:`);
    for (const r of allResults.filter((r) => r.status === "error")) {
      console.log(`   • [${r.category}] ${r.name}`);
      console.log(`     ${r.error}`);
      if (r.consoleErrors.length > 0) {
        console.log(`     Console: ${r.consoleErrors[0].substring(0, 60)}...`);
      }
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(failed === 0 ? "✅ ALL PAGES WORKING!" : `⚠️  ${failed} PAGES NEED ATTENTION`);
  console.log(`${"=".repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
