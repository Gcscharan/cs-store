/**
 * MCP Page Crawler
 *
 * Usage:
 *   npx ts-node scripts/mcp-crawl-pages.ts [category]
 *
 * Examples:
 *   npx ts-node scripts/mcp-crawl-pages.ts public
 *   npx ts-node scripts/mcp-crawl-pages.ts admin
 *   npx ts-node scripts/mcp-crawl-pages.ts all
 */

import { chromium, Browser, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

const MANIFEST_PATH = path.join(__dirname, "..", "mcp-pages-manifest.json");
const SCREENSHOT_DIR = path.join(__dirname, "..", "mcp-screenshots");

interface PageEntry {
  path: string;
  name: string;
  description: string;
}

interface Manifest {
  baseUrl: string;
  categories: Record<
    string,
    {
      description: string;
      credentials?: { email: string; password: string };
      pages: PageEntry[];
    }
  >;
}

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function login(page: Page, baseUrl: string, email: string, password: string) {
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[type="email"], input[name="email"], #email', email).catch(() => {});
  await page.fill('input[type="password"], input[name="password"], #password', password).catch(() => {});
  await page.click('button[type="submit"]').catch(() => {});
  await page.waitForTimeout(2000);
}

async function crawlCategory(
  browser: Browser,
  baseUrl: string,
  categoryKey: string,
  category: Manifest["categories"][string]
) {
  console.log(`\n📂 Category: ${categoryKey} — ${category.description}`);

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Login if credentials provided
  if (category.credentials) {
    console.log(`   🔑 Logging in as ${category.credentials.email}`);
    await login(page, baseUrl, category.credentials.email, category.credentials.password);
  }

  const results: { page: string; status: "ok" | "error"; url: string; error?: string }[] = [];

  for (const entry of category.pages) {
    // Skip parameterized routes for automated crawling
    if (entry.path.includes(":")) {
      console.log(`   ⏭️  Skipping parameterized route: ${entry.path}`);
      continue;
    }

    const url = `${baseUrl}${entry.path}`;
    const safeName = entry.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const screenshotPath = path.join(SCREENSHOT_DIR, categoryKey, `${safeName}.png`);

    try {
      console.log(`   🌐 ${entry.name} — ${url}`);
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
      const status = response?.status() ?? 0;

      // Wait a bit for lazy-loaded content
      await page.waitForTimeout(1000);

      // Take screenshot
      await ensureDir(path.dirname(screenshotPath));
      await page.screenshot({ path: screenshotPath, fullPage: true });

      if (status >= 400) {
        results.push({ page: entry.name, status: "error", url, error: `HTTP ${status}` });
        console.log(`   ❌ HTTP ${status}`);
      } else {
        results.push({ page: entry.name, status: "ok", url });
        console.log(`   ✅ OK`);
      }
    } catch (err: any) {
      results.push({ page: entry.name, status: "error", url, error: err.message });
      console.log(`   ❌ ${err.message}`);
    }
  }

  await context.close();
  return results;
}

async function main() {
  const categoryArg = process.argv[2] || "public";

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("❌ Manifest not found:", MANIFEST_PATH);
    process.exit(1);
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const baseUrl = manifest.baseUrl;

  console.log(`🚀 MCP Page Crawler`);
  console.log(`   Base URL: ${baseUrl}`);
  console.log(`   Category: ${categoryArg}`);

  const browser = await chromium.launch({ headless: true });

  type CrawlResult = { page: string; status: "ok" | "error"; url: string; error?: string };
  let allResults: CrawlResult[] = [];

  if (categoryArg === "all") {
    for (const [key, cat] of Object.entries(manifest.categories)) {
      const results = await crawlCategory(browser, baseUrl, key, cat);
      allResults.push(...results);
    }
  } else if (manifest.categories[categoryArg]) {
    const results = await crawlCategory(browser, baseUrl, categoryArg, manifest.categories[categoryArg]);
    allResults.push(...results);
  } else {
    console.error(`❌ Unknown category: ${categoryArg}`);
    console.error(`   Available: ${Object.keys(manifest.categories).join(", ")}, all`);
    await browser.close();
    process.exit(1);
  }

  await browser.close();

  // Summary
  const ok = allResults.filter((r) => r.status === "ok").length;
  const errors = allResults.filter((r) => r.status === "error").length;

  console.log(`\n📊 Summary`);
  console.log(`   ✅ OK: ${ok}`);
  console.log(`   ❌ Errors: ${errors}`);

  if (errors > 0) {
    console.log(`\n🚨 Failed pages:`);
    for (const r of allResults.filter((r) => r.status === "error")) {
      console.log(`   • ${r.page}: ${r.error}`);
    }
  }

  console.log(`\n📸 Screenshots saved to: ${SCREENSHOT_DIR}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
