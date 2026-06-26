#!/usr/bin/env node
/**
 * Ollama + Playwright Automated Page Testing
 * Uses local LLM to intelligently navigate and verify all pages
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MANIFEST_PATH = path.join(__dirname, "..", "mcp-pages-manifest.json");
const SCREENSHOT_DIR = path.join(__dirname, "..", "mcp-screenshots", "ollama-test");
const REPORT_PATH = path.join(__dirname, "..", "ollama-test-report.json");

// Ollama configuration
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

// Check if Ollama is available
async function checkOllama() {
  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_HOST}/api/tags`, { timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Ask Ollama to analyze page content
async function analyzePageWithOllama(pageName, pageContent, consoleErrors, networkErrors) {
  const prompt = `You are a web testing expert. Analyze this webpage and determine if it is working correctly.

Page: ${pageName}
Console Errors: ${consoleErrors.length > 0 ? consoleErrors.slice(0, 3).join("\n") : "None"}
Network Errors: ${networkErrors.length > 0 ? networkErrors.slice(0, 3).join("\n") : "None"}

Page Content (truncated):
${pageContent.substring(0, 2000)}

Give a brief 1-2 sentence analysis. Is this page working correctly? Any critical issues?`;

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
    });

    const req = http.request(
      `${OLLAMA_HOST}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const response = JSON.parse(data);
            resolve(response.response?.substring(0, 200) || "No analysis");
          } catch {
            resolve("Analysis failed");
          }
        });
      }
    );

    req.on("error", () => resolve("AI unavailable"));
    req.on("timeout", () => {
      req.destroy();
      resolve("AI timeout");
    });

    req.write(postData);
    req.end();
  });
}

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function testPage(browser, baseUrl, pageInfo, category, useAI) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const networkErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().substring(0, 200));
  });
  page.on("requestfailed", (req) => {
    networkErrors.push(`${req.url()}: ${req.failure()?.errorText || "failed"}`);
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
        networkErrors: [],
        screenshot: "",
        aiAnalysis: "Skipped parameterized route",
      };
    }

    const url = `${baseUrl}${pageInfo.path}`;
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const loadTimeMs = Date.now() - startTime;
    const httpStatus = response?.status() ?? 0;

    await page.waitForTimeout(2000);
    await ensureDir(SCREENSHOT_DIR);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    let status = "ok";
    let error = undefined;

    if (httpStatus >= 400) {
      status = "error";
      error = `HTTP ${httpStatus}`;
    }

    // AI Analysis
    let aiAnalysis = undefined;
    if (useAI && status !== "error") {
      const pageContent = await page.content();
      aiAnalysis = await analyzePageWithOllama(pageInfo.name, pageContent, consoleErrors, networkErrors);
    }

    await context.close();

    return {
      path: pageInfo.path,
      name: pageInfo.name,
      category,
      status,
      url,
      loadTimeMs,
      httpStatus,
      consoleErrors: consoleErrors.slice(0, 5),
      networkErrors: networkErrors.slice(0, 5),
      screenshot: screenshotPath,
      aiAnalysis,
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
      networkErrors: networkErrors.slice(0, 5),
      screenshot: "",
      error: err.message,
    };
  }
}

async function main() {
  const categoryArg = process.argv[2] || "all";
  const useAI = process.argv.includes("--ai") || process.argv.includes("-a");

  console.log("🧠 Ollama + Playwright Automated Testing\n");

  // Check Ollama
  const ollamaAvailable = await checkOllama();
  if (useAI && !ollamaAvailable) {
    console.log("⚠️  Ollama not available at", OLLAMA_HOST);
    console.log("   Install: https://ollama.com/download");
    console.log("   Then: ollama pull llama3.2\n");
  } else if (ollamaAvailable && useAI) {
    console.log("✅ Ollama connected:", OLLAMA_HOST);
    console.log("   Model:", OLLAMA_MODEL, "\n");
  }

  // Load manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("❌ Manifest not found");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  console.log(`🌐 Target: ${baseUrl}`);
  console.log(`📁 Category: ${categoryArg}\n`);

  // Check frontend
  try {
    const res = await fetch(baseUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error("Not responding");
  } catch {
    console.error(`❌ Frontend not at ${baseUrl}`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const allResults = [];

  const categories = categoryArg === "all"
    ? Object.entries(manifest.categories)
    : [[categoryArg, manifest.categories[categoryArg]]].filter(([k]) => k);

  if (categories.length === 0) {
    console.error(`❌ Unknown category: ${categoryArg}`);
    await browser.close();
    process.exit(1);
  }

  for (const [catKey, catData] of categories) {
    console.log(`\n📂 ${catKey}: ${catData.description}`);
    console.log(`   ${catData.pages.length} pages\n`);

    for (const pageInfo of catData.pages) {
      const result = await testPage(browser, baseUrl, pageInfo, catKey, ollamaAvailable && useAI);
      allResults.push(result);

      const icon = result.status === "ok" ? "✅" : result.status === "skipped" ? "⏭️" : "❌";
      console.log(`   ${icon} ${pageInfo.name} (${result.loadTimeMs}ms)`);

      if (result.aiAnalysis) {
        console.log(`      AI: ${result.aiAnalysis.substring(0, 60)}...`);
      }
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    }
  }

  await browser.close();

  // Generate report
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl,
    totalPages: allResults.length,
    passed: allResults.filter((r) => r.status === "ok").length,
    failed: allResults.filter((r) => r.status === "error").length,
    skipped: allResults.filter((r) => r.status === "skipped").length,
    results: allResults,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`\n📊 Summary: ${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped`);
  console.log(`📄 Report: ${REPORT_PATH}`);
  console.log(`📸 Screenshots: ${SCREENSHOT_DIR}/`);

  process.exit(report.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
