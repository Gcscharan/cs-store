#!/usr/bin/env node
/**
 * Main QA Runner
 * Entry point for autonomous AI QA testing
 */

import { QAEngine } from "./engine/QAEngine.mjs";
import { WorkflowDiscovery } from "./engine/WorkflowDiscovery.mjs";
import { PageInteractionRunner } from "./engine/PageInteractionRunner.mjs";
import { Reporter } from "./engine/Reporter.mjs";
import { DeliveryAgent } from "./agents/DeliveryAgent.mjs";
import { MobileDeliveryAgent } from "./agents/MobileDeliveryAgent.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(__dirname, "..", "mcp-pages-manifest.json");

function getArgFlag(args, flag) {
  return args.includes(flag);
}

function getArgValue(args, flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";
  const useAI = args.includes("--ai");
  const category = getArgValue(args, "--category");
  const headless = !getArgFlag(args, "--headed");

  console.log("🤖 AI QA Testing System");
  console.log("=".repeat(60) + "\n");

  switch (command) {
    case "delivery":
      await runDeliveryTest(useAI);
      break;
    case "discover":
      await runDiscovery();
      break;
    case "full":
      await runFullTest(useAI);
      break;
    case "pages":
      await runPageInteraction({ fullMode: false, category, headless });
      break;
    case "pages:full":
      await runPageInteraction({ fullMode: true, category, headless });
      break;
    case "customer":
      await runPageInteraction({ fullMode: true, category: "customer", headless });
      break;
    case "admin":
      await runPageInteraction({ fullMode: true, category: "admin", headless });
      break;
    case "mobile:delivery":
      await runMobileDelivery({ headless });
      break;
    case "audit":
      await runAudit({ category, headless });
      break;
    case "help":
      printHelp();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      printHelp();
  }
}

async function runPageInteraction({ fullMode, category, headless }) {
  console.log(`🌐 Running Page Interaction (${fullMode ? "full clicks" : "load only"})\n`);

  const runner = new PageInteractionRunner({
    baseUrl: process.env.FRONTEND_URL || "http://localhost:3000",
    headless,
    fullMode,
    category,
  });

  const report = await runner.run(MANIFEST_PATH);
  const resultsPath = path.join(__dirname, "results", "interaction-results.json");
  runner.saveResults(resultsPath, report);

  const reporter = new Reporter();
  const markdown = reporter.generateMarkdownReport(report);
  reporter.saveReport(markdown, "full-interaction-report.md");

  const launchReport = reporter.generateLaunchReadinessReport(report);
  reporter.saveReport(launchReport, "full-launch-readiness.md");

  console.log("\n" + "=".repeat(60));
  console.log("📊 Page Interaction Complete");
  console.log("=".repeat(60));
  console.log(`Pages: ${report.summary.totalPages}`);
  console.log(`Success Rate: ${report.summary.successRate}%`);
  console.log(`Button Clicks: ${report.summary.totalClicks} (${report.summary.failedClicks} failed)`);
}

async function runMobileDelivery({ headless }) {
  console.log("📱 Running Mobile Delivery Agent\n");

  const agent = new MobileDeliveryAgent({ headless, fullMode: true });
  const report = await agent.run();

  const resultsPath = path.join(__dirname, "results", "mobile-delivery-results.json");
  const dir = path.dirname(resultsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(resultsPath, JSON.stringify(report, null, 2));

  const reporter = new Reporter();
  reporter.saveReport(
    reporter.generateMarkdownReport({ ...report, pages: report.screens }),
    "mobile-delivery-report.md"
  );

  console.log("\n" + "=".repeat(60));
  console.log("📊 Mobile Delivery Test Complete");
  console.log("=".repeat(60));
  console.log(`Screens: ${report.summary.totalScreens}`);
  console.log(`Success Rate: ${report.summary.successRate}%`);
}

async function runAudit({ category, headless }) {
  console.log("🔬 Running Full Audit (web + mobile)\n");

  await runPageInteraction({ fullMode: true, category, headless });

  try {
    await runMobileDelivery({ headless });
  } catch (err) {
    console.log(`⚠️  Mobile delivery skipped: ${err.message}`);
  }

  console.log("\n✅ Full audit complete — see qa/reports/");
}

async function runDeliveryTest(useAI) {
  console.log("🚚 Running Delivery Workflow Test\n");

  const agent = new DeliveryAgent({
    baseUrl: "http://localhost:3000",
    headless: false,
    slowMo: 1000,
    ollama: useAI ? {} : null,
  });

  const report = await agent.runFullFlow();
  await agent.saveReport("./qa/results/delivery-test.json");

  const reporter = new Reporter();
  const markdown = reporter.generateMarkdownReport(report);
  reporter.saveReport(markdown, "delivery-test-report.md");

  const launchReport = reporter.generateLaunchReadinessReport(report);
  reporter.saveReport(launchReport, "delivery-launch-readiness.md");

  console.log("\n" + "=".repeat(60));
  console.log("📊 Delivery Test Complete");
  console.log("=".repeat(60));
  console.log(`Success Rate: ${report.summary.successRate}%`);
  console.log(`Health Score: ${report.healthScore}/100`);
  console.log(`Failed Steps: ${report.summary.failed}`);
}

async function runDiscovery() {
  console.log("🔍 Running Workflow Discovery\n");

  const engine = new QAEngine({ baseUrl: "http://localhost:3000", headless: true });
  await engine.launch();

  const discovery = new WorkflowDiscovery(engine);

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("❌ Manifest not found:", MANIFEST_PATH);
    await engine.close();
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  await discovery.discoverAllScreens(manifest);
  await discovery.generateWorkflowMap("./qa/datasets/WORKFLOW_MAP.json");

  await engine.close();
}

async function runFullTest(useAI) {
  console.log("🧪 Running Full Test Suite\n");

  const reporter = new Reporter();
  const allResults = [];

  console.log("\n--- Delivery Workflow ---");
  const deliveryAgent = new DeliveryAgent({
    baseUrl: "http://localhost:3000",
    headless: true,
    ollama: useAI ? {} : null,
  });
  const deliveryReport = await deliveryAgent.runFullFlow();
  allResults.push({ type: "delivery", data: deliveryReport });
  await deliveryAgent.saveReport("./qa/results/delivery-test.json");

  console.log("\n--- Page Interaction ---");
  const runner = new PageInteractionRunner({ headless: true, fullMode: true });
  const pageReport = await runner.run(MANIFEST_PATH);
  allResults.push({ type: "pages", data: pageReport });

  const combinedReport = {
    timestamp: new Date().toISOString(),
    tests: allResults,
    summary: {
      totalTests: 2,
      totalSteps: 2,
      passed: allResults.filter((r) => r.data.summary?.successRate >= 50).length,
      failed: allResults.filter((r) => r.data.summary?.successRate < 50).length,
      successRate: Math.round(
        allResults.reduce((s, r) => s + (r.data.summary?.successRate || 0), 0) /
          allResults.length
      ),
    },
    pages: pageReport.pages,
    healthScore: deliveryReport.healthScore,
  };

  const markdown = reporter.generateMarkdownReport(combinedReport);
  reporter.saveReport(markdown, "full-test-report.md");

  const launchReport = reporter.generateLaunchReadinessReport(combinedReport);
  reporter.saveReport(launchReport, "full-launch-readiness.md");

  console.log("\n" + "=".repeat(60));
  console.log("📊 Full Test Suite Complete");
  console.log("=".repeat(60));
}

function printHelp() {
  console.log(`
Usage: node qa/run-qa.mjs <command> [options]

Commands:
  delivery          Run delivery workflow test
  discover          Run workflow discovery
  full              Run delivery + page interaction suite
  pages             Load-only validation for all manifest pages
  pages:full        Full button click audit for all pages
  customer          Customer pages full audit
  admin             Admin pages full audit
  mobile:delivery   Expo web mobile delivery screens audit
  audit             Web pages:full + mobile:delivery
  help              Show this help message

Options:
  --ai              Enable AI validation (requires Ollama)
  --category <name> Limit to manifest category (public, customer, admin, delivery, shared, debug)
  --headed          Run browser in headed mode (default: headless)

Examples:
  node qa/run-qa.mjs pages:full
  node qa/run-qa.mjs pages:full --category public
  node qa/run-qa.mjs audit --headed
  npm run qa:audit
  `);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
