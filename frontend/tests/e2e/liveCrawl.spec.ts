/**
 * LIVE RECURSIVE CRAWLER
 * ----------------------------------------------------------------------------
 * Starts at "/", exercises the page (fills inputs, submits safe forms, clicks
 * safe buttons), discovers all in-app links, then visits each unvisited link
 * and repeats (breadth-first) until the whole reachable site is covered.
 *
 * Watch it live:
 *   cd frontend && npx playwright test liveCrawl --headed --project=chromium
 *
 * Requirements: frontend dev server (auto-started by playwright.config webServer)
 * AND backend API on :5001 (start separately). Login uses dev OTP echo.
 *
 * SAFETY: non-destructive by default. Buttons/links containing delete/remove/
 * cancel/logout/pay/confirm/deactivate/suspend/reject are SKIPPED. Set
 * CRAWL_DESTRUCTIVE=1 to allow them (NOT recommended on real data).
 * ----------------------------------------------------------------------------
 */
import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const API = process.env.CRAWL_API || "http://localhost:5001/api";
const ADMIN_PHONE = process.env.CRAWL_PHONE || "9391795162";
const MAX_PAGES = Number(process.env.CRAWL_MAX_PAGES || 120);
const ALLOW_DESTRUCTIVE = process.env.CRAWL_DESTRUCTIVE === "1";
const OUT_DIR = path.join(process.cwd(), "crawl-report");
const SHOT_DIR = path.join(OUT_DIR, "screenshots");

const DESTRUCTIVE = /delete|remove|cancel|logout|log out|sign out|pay|confirm|deactivate|suspend|reject|approve|delete|clear|reset/i;

type PageResult = {
  url: string; depth: number; title: string;
  consoleErrors: string[]; apiErrors: string[];
  inputsFilled: number; formsSubmitted: number; buttonsClicked: number;
  linksFound: number; status: "ok" | "error"; screenshot: string;
};

function ensureDirs() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

function slug(u: string) {
  return u.replace(/^https?:\/\/[^/]+/, "").replace(/[^a-z0-9]/gi, "_").slice(0, 80) || "root";
}

// UI login via dev OTP echo; establishes persisted session in the browser.
async function loginUI(page: Page) {
  const otpPromise = new Promise<string>((resolve) => {
    page.on("response", async (res) => {
      if (res.url().includes("/auth/send-otp")) {
        try { const d = await res.json(); if (d.otp) resolve(String(d.otp)); } catch {}
      }
    });
  });
  await page.goto("/login");
  const phone = page.locator("input[name='emailOrPhone']");
  if (!(await phone.isVisible().catch(() => false))) return false;
  await phone.fill(ADMIN_PHONE);
  await page.getByRole("button", { name: /send otp/i }).click();
  const otp = await Promise.race([
    otpPromise,
    new Promise<string>((_, rej) => setTimeout(() => rej(new Error("otp timeout")), 15000)),
  ]).catch(() => "");
  if (!otp) return false;
  const otpInput = page.locator("input[name='otp']");
  await otpInput.waitFor({ timeout: 5000 }).catch(() => {});
  await otpInput.fill(otp).catch(() => {});
  await page.getByRole("button", { name: /verify otp/i }).click().catch(() => {});
  await page.waitForTimeout(3000);
  return true;
}

// Fill every input with type-appropriate test data.
async function fillInputs(page: Page): Promise<number> {
  let n = 0;
  const inputs = await page.locator("input:visible, textarea:visible, select:visible").all();
  for (const el of inputs) {
    try {
      const tag = String(await el.evaluate((n) => n.tagName)).toLowerCase();
      if (tag === "select") {
        const opts = await el.locator("option").count();
        if (opts > 1) { await el.selectOption({ index: 1 }).catch(() => {}); n++; }
        continue;
      }
      const type = String(await el.getAttribute("type") || "text").toLowerCase();
      if (["hidden", "file", "submit", "button", "image", "range", "color"].includes(type)) continue;
      if (type === "checkbox" || type === "radio") { await el.check().catch(() => {}); n++; continue; }
      const val =
        type === "email" ? "qa.tester@example.com" :
        type === "tel" ? "9391795162" :
        type === "number" ? "5" :
        type === "password" ? "TestPass123!" :
        type === "date" ? "2026-01-01" :
        type === "search" ? "tomato" : "QA Test Value";
      await el.fill(val, { timeout: 800 }).catch(() => {});
      n++;
    } catch { /* resilient */ }
  }
  return n;
}

// Click safe (non-destructive) buttons and submit safe forms.
async function interact(page: Page): Promise<{ submitted: number; clicked: number }> {
  let submitted = 0, clicked = 0;
  // Submit search/filter forms (safe)
  const searchBtns = await page.getByRole("button", { name: /search|apply|filter|go|find/i }).all();
  for (const b of searchBtns) {
    try {
      if (!(await b.isVisible().catch(() => false))) continue;
      const label = (await b.textContent().catch(() => "")) || "";
      if (!ALLOW_DESTRUCTIVE && DESTRUCTIVE.test(label)) continue;
      await b.click({ timeout: 1000 }).catch(() => {});
      submitted++;
      await page.waitForTimeout(300);
    } catch {}
  }
  // Click other safe buttons
  const btns = await page.locator("button:visible").all();
  for (const b of btns) {
    try {
      const label = (await b.textContent().catch(() => "")) || "";
      const type = String(await b.getAttribute("type") || "").toLowerCase();
      if (type === "submit") continue; // handled above / avoid blind submits
      if (!ALLOW_DESTRUCTIVE && DESTRUCTIVE.test(label)) continue;
      const disabled = (await b.getAttribute("disabled").catch(() => null)) !== null;
      if (disabled) continue;
      await b.click({ timeout: 800 }).catch(() => {});
      clicked++;
      await page.waitForTimeout(150);
      // dismiss any modal by Escape
      await page.keyboard.press("Escape").catch(() => {});
    } catch {}
  }
  return { submitted, clicked };
}

// Collect same-origin in-app links from the current page.
async function collectLinks(page: Page, origin: string): Promise<string[]> {
  const hrefs = await page.locator("a[href]").evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).href)
  ).catch(() => [] as string[]);
  const out = new Set<string>();
  for (const h of hrefs) {
    try {
      const u = new URL(h);
      if (u.origin !== origin) continue;
      if (/logout|sign-out|signout/i.test(u.pathname)) continue;
      out.add(u.pathname + u.search);
    } catch {}
  }
  return [...out];
}

test.describe("Live recursive crawl", () => {
  test("crawl every reachable page, fill+submit+click, recurse into links", async ({ page }) => {
    test.setTimeout(30 * 60 * 1000); // up to 30 min for a full crawl
    ensureDirs();

    const origin = new URL(page.url() || "http://localhost:5173").origin || "http://localhost:5173";
    const results: PageResult[] = [];
    const visited = new Set<string>();
    const queue: { url: string; depth: number }[] = [];

    // Try to authenticate (best-effort); public pages crawl regardless.
    const authed = await loginUI(page).catch(() => false);
    console.log(authed ? "🔐 Logged in" : "🌐 Crawling as guest (login failed/skipped)");

    // Seed
    queue.push({ url: "/", depth: 0 });
    if (authed) queue.push({ url: "/admin", depth: 0 });

    while (queue.length && visited.size < MAX_PAGES) {
      const { url, depth } = queue.shift()!;
      const key = url.split("#")[0];
      if (visited.has(key)) continue;
      visited.add(key);

      const consoleErrors: string[] = [];
      const apiErrors: string[] = [];
      const onConsole = (m: any) => {
        if (m.type() !== "error") return;
        const t = m.text();
        if (/preconnect|localhost:5001|ERR_CONNECTION_REFUSED|favicon|Failed to load resource/i.test(t)) return;
        consoleErrors.push(t);
      };
      const onPageErr = (e: any) => consoleErrors.push(String(e?.message || e));
      const onResp = (r: any) => { try { if (r.status() >= 500 && r.url().includes("/api/")) apiErrors.push(`${r.status()} ${r.url()}`); } catch {} };
      page.on("console", onConsole);
      page.on("pageerror", onPageErr);
      page.on("response", onResp);

      let res: PageResult = {
        url: key, depth, title: "", consoleErrors, apiErrors,
        inputsFilled: 0, formsSubmitted: 0, buttonsClicked: 0,
        linksFound: 0, status: "ok", screenshot: "",
      };

      try {
        console.log(`[${visited.size}/${MAX_PAGES}] depth=${depth}  ${key}`);
        await page.goto(key, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(600);
        res.title = await page.title().catch(() => "");

        res.inputsFilled = await fillInputs(page);
        const acted = await interact(page);
        res.formsSubmitted = acted.submitted;
        res.buttonsClicked = acted.clicked;

        const shot = path.join(SHOT_DIR, `${String(visited.size).padStart(3, "0")}_${slug(key)}.png`);
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
        res.screenshot = path.relative(OUT_DIR, shot);

        // Re-navigate to a clean state before harvesting links (interactions may have navigated away)
        if (!page.url().includes(key)) await page.goto(key, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        const links = await collectLinks(page, origin);
        res.linksFound = links.length;
        for (const l of links) {
          const lk = l.split("#")[0];
          if (!visited.has(lk)) queue.push({ url: l, depth: depth + 1 });
        }
      } catch (e: any) {
        res.status = "error";
        res.consoleErrors.push(`[nav] ${String(e?.message || e)}`);
      } finally {
        page.off("console", onConsole);
        page.off("pageerror", onPageErr);
        page.off("response", onResp);
        results.push(res);
      }
    }

    // Write reports
    fs.writeFileSync(path.join(OUT_DIR, "crawl-results.json"), JSON.stringify(results, null, 2));
    const withErrors = results.filter((r) => r.consoleErrors.length || r.apiErrors.length || r.status === "error");
    const summary = [
      `Crawled: ${results.length} pages`,
      `Pages with errors: ${withErrors.length}`,
      `Total inputs filled: ${results.reduce((a, r) => a + r.inputsFilled, 0)}`,
      `Total buttons/forms exercised: ${results.reduce((a, r) => a + r.buttonsClicked + r.formsSubmitted, 0)}`,
      ``,
      ...withErrors.map((r) => `❌ ${r.url}\n   ${[...r.consoleErrors, ...r.apiErrors].slice(0, 5).join("\n   ")}`),
    ].join("\n");
    fs.writeFileSync(path.join(OUT_DIR, "crawl-summary.txt"), summary);
    console.log("\n" + summary);
    console.log(`\n📄 Report: ${OUT_DIR}/crawl-results.json  +  screenshots/`);

    expect(results.length).toBeGreaterThan(0);
  });
});
