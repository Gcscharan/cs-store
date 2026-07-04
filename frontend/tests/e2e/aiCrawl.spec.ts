/**
 * AI-DRIVEN LIVE CRAWLER + REPORT DASHBOARD
 * ----------------------------------------------------------------------------
 * For every reachable page it:
 *   1. Snapshots the DOM (headings, forms, inputs, buttons, links)
 *   2. Asks a LOCAL AI (Ollama / qwen3.5) to generate intelligent test cases
 *   3. Executes the SAFE, verifiable test types and records pass/fail with
 *      expected vs actual + a screenshot as evidence
 *   4. Recurses into discovered links (breadth-first) until the site is covered
 *   5. Writes a live HTML dashboard: crawl-report/index.html
 *
 * Watch live:  cd frontend && npx playwright test aiCrawl --headed --project=chromium
 *
 * Requires: frontend (auto-started), backend :5001, Ollama on :11434.
 * SAFE by default: only non-destructive test types are executed. Set
 * CRAWL_DESTRUCTIVE=1 to also allow destructive clicks (NOT recommended live).
 * ----------------------------------------------------------------------------
 */
import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "qwen3.5:latest";
const ADMIN_PHONE = process.env.CRAWL_PHONE || "9391795162";
const MAX_PAGES = Number(process.env.CRAWL_MAX_PAGES || 60);
const ALLOW_DESTRUCTIVE = process.env.CRAWL_DESTRUCTIVE === "1";
const OUT = path.join(process.cwd(), "crawl-report");
const SHOTS = path.join(OUT, "screenshots");

type TCResult = {
  id: string; description: string; type: string;
  expected: string; actual: string; status: "pass" | "fail" | "skipped";
};
type PageReport = {
  index: number; url: string; title: string; depth: number;
  aiModel: string; testCases: TCResult[];
  pass: number; fail: number; skipped: number;
  consoleErrors: string[]; apiErrors: string[]; screenshot: string;
};

// ── DOM snapshot the AI reasons over ──────────────────────────────────────
async function snapshot(page: Page) {
  return await page.evaluate(() => {
    const txt = (el: Element) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);
    const headings = Array.from(document.querySelectorAll("h1,h2,h3")).map(txt).filter(Boolean).slice(0, 15);
    const inputs = Array.from(document.querySelectorAll("input,textarea,select")).slice(0, 25).map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: (el as HTMLInputElement).type || "",
      name: (el as HTMLInputElement).name || "",
      placeholder: (el as HTMLInputElement).placeholder || "",
      required: (el as HTMLInputElement).required || false,
    }));
    const buttons = Array.from(document.querySelectorAll("button,[role=button]")).slice(0, 25).map(txt).filter(Boolean);
    const links = Array.from(document.querySelectorAll("a[href]")).slice(0, 40).map((a) => (a as HTMLAnchorElement).getAttribute("href") || "");
    return { headings, inputs, buttons, links };
  });
}

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 25000);
const ALLOWED_TYPES = [
  "element_present", "input_accepts", "required_validation",
  "search_returns", "no_console_errors", "title_nonempty",
];

// Deterministic fallback: derive sensible test cases from the DOM snapshot
// when the local AI is unavailable or too slow. Keeps the crawl working.
function heuristicGenerate(snap: any): any[] {
  const tc: any[] = [];
  tc.push({ id: "H-title", description: "Page renders with a non-empty title", type: "title_nonempty", expected: "title present" });
  tc.push({ id: "H-noerr", description: "Page loads without console/runtime errors", type: "no_console_errors", expected: "no errors" });
  if (snap.headings?.[0]) tc.push({ id: "H-head", description: `Primary heading "${snap.headings[0]}" is visible`, type: "element_present", target: snap.headings[0], expected: "heading visible" });
  const search = (snap.inputs || []).find((i: any) => i.type === "search" || /search/i.test(i.placeholder + i.name));
  if (search) tc.push({ id: "H-search", description: "Search input returns content", type: "search_returns", target: search.name || search.placeholder, value: "tomato", expected: "results render" });
  const text = (snap.inputs || []).find((i: any) => ["text", "email", "tel"].includes(i.type));
  if (text) tc.push({ id: "H-input", description: `Input "${text.name || text.placeholder}" accepts data`, type: "input_accepts", target: text.name || text.placeholder, value: "QA Test", expected: "value retained" });
  const hasRequired = (snap.inputs || []).some((i: any) => i.required);
  if (hasRequired) tc.push({ id: "H-req", description: "Empty required form shows validation", type: "required_validation", expected: "validation shown" });
  return tc;
}

const NO_AI = process.env.CRAWL_NO_AI === "1";
let aiDisabled = NO_AI; // auto-disables after first failure to avoid wasting time

// This SPA navigates via buttons/<Link>, not raw <a href>, so seed the crawl
// with the known static routes from src/App.tsx (link-scraping still augments).
const SEED_ROUTES = [
  // public
  "/", "/login", "/signup", "/privacy", "/terms", "/cancellation", "/products",
  "/search", "/menu", "/download-app", "/contact-us", "/customer-care",
  "/about-us", "/careers", "/cs-store-stories", "/corporate-information",
  "/categories", "/help-support", "/become-seller",
  // customer (may redirect if role mismatch — recorded honestly)
  "/dashboard", "/cart", "/checkout", "/orders", "/profile", "/addresses",
  "/notification-preferences", "/settings", "/account", "/account/profile",
  "/account/profile/edit", "/account/settings", "/account/notifications",
  // admin
  "/admin", "/admin/products", "/admin/products/new", "/admin/users",
  "/admin/orders", "/admin/routes", "/admin/routes/recent", "/admin/routes/preview",
  "/admin/delivery-boys", "/admin/analytics", "/admin/notifications/analytics",
  "/admin/finance", "/admin/payments", "/admin/ops/payments/recovery",
  "/admin/ops/finance", "/admin/support", "/admin/settings", "/admin-profile",
  // delivery
  "/delivery/signup", "/delivery/login", "/delivery", "/delivery/dashboard",
  "/delivery/profile", "/delivery/earnings-info", "/delivery/refer",
  "/delivery/support", "/delivery/messages", "/delivery/settings",
  "/delivery-selfie", "/delivery-profile", "/delivery/emergency",
  "/delivery/help-center", "/delivery-settings",
  // shared / debug
  "/ways-to-earn", "/refer-and-earn", "/message-center", "/test-otp", "/debug",
];

// ── Local AI test-case generation (Ollama) with timeout + fallback ─────────
async function aiGenerate(url: string, snap: any): Promise<{ cases: any[]; source: string }> {
  const allowed = ALLOWED_TYPES;
  if (aiDisabled) return { cases: heuristicGenerate(snap), source: NO_AI ? "heuristic" : "heuristic(ai-unavailable)" };
  const prompt =
`You are a senior QA engineer. Generate 3-6 ATOMIC UI test cases for this web page.
URL: ${url}
Headings: ${JSON.stringify(snap.headings)}
Inputs: ${JSON.stringify(snap.inputs)}
Buttons: ${JSON.stringify(snap.buttons)}
Return ONLY a JSON array. Each item: {"id","description","type","target","value","expected"}.
"type" MUST be one of: ${allowed.join(", ")}.
- element_present: "target" = visible text or heading expected on page.
- input_accepts: "target" = input name/placeholder, "value" = data to type.
- required_validation: submit empty required form; expect a validation message.
- search_returns: "target" = search input name/placeholder, "value" = a query.
- no_console_errors / title_nonempty: no target needed.
Keep it strictly non-destructive (no delete/pay/cancel). JSON only, no prose.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const resp = await fetch(`${OLLAMA}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, keep_alive: "30m", options: { temperature: 0.3, num_predict: 400 } }),
      signal: controller.signal,
    });
    const data: any = await resp.json();
    let raw = String(data.response || "").trim();
    raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) {
      const arr = JSON.parse(m[0]);
      const cases = Array.isArray(arr) ? arr.filter((t) => allowed.includes(t.type)) : [];
      if (cases.length) return { cases, source: `ai:${MODEL}` };
    }
  } catch {
    aiDisabled = true; // AI too slow/unavailable on this host — stop trying
  }
  finally { clearTimeout(timer); }
  return { cases: heuristicGenerate(snap), source: "heuristic(ai-unavailable)" };
}

// ── Safe executor: runs only non-destructive, verifiable test types ───────
async function runCase(page: Page, tc: any): Promise<TCResult> {
  const base: TCResult = {
    id: String(tc.id || Math.random().toString(36).slice(2, 8)),
    description: String(tc.description || tc.type || "test"),
    type: String(tc.type), expected: String(tc.expected || ""),
    actual: "", status: "skipped",
  };
  try {
    switch (tc.type) {
      case "title_nonempty": {
        const t = await page.title();
        base.expected = base.expected || "page has a non-empty title";
        base.actual = `title="${t}"`;
        base.status = t && t.trim().length > 0 ? "pass" : "fail";
        break;
      }
      case "no_console_errors": {
        base.expected = base.expected || "no runtime console errors";
        base.actual = "(aggregated at page level)";
        base.status = "pass"; // page-level errors captured separately
        break;
      }
      case "element_present": {
        const target = String(tc.target || "");
        const loc = page.getByText(target, { exact: false }).first();
        const visible = await loc.isVisible().catch(() => false);
        base.expected = `"${target}" visible on page`;
        base.actual = visible ? "found & visible" : "not found";
        base.status = visible ? "pass" : "fail";
        break;
      }
      case "input_accepts": {
        const target = String(tc.target || "");
        const val = String(tc.value || "QA Test");
        const el = page.locator(`input[name='${target}'], input[placeholder*='${target}' i], textarea[name='${target}']`).first();
        if (!(await el.count())) { base.actual = "input not found"; base.status = "fail"; break; }
        await el.fill(val, { timeout: 1500 });
        const got = await el.inputValue().catch(() => "");
        base.expected = `input accepts "${val}"`;
        base.actual = `value="${got}"`;
        base.status = got === val ? "pass" : "fail";
        break;
      }
      case "search_returns": {
        const target = String(tc.target || "");
        const val = String(tc.value || "tomato");
        const el = page.locator(`input[name='${target}'], input[type='search'], input[placeholder*='search' i]`).first();
        if (!(await el.count())) { base.actual = "search input not found"; base.status = "fail"; break; }
        await el.fill(val, { timeout: 1500 });
        await el.press("Enter").catch(() => {});
        await page.waitForTimeout(1200);
        const bodyLen = (await page.locator("body").innerText().catch(() => "")).length;
        base.expected = `search "${val}" renders results/content`;
        base.actual = `page content length=${bodyLen}`;
        base.status = bodyLen > 0 ? "pass" : "fail";
        break;
      }
      case "required_validation": {
        const submit = page.getByRole("button", { name: /submit|save|continue|send|verify|add/i }).first();
        if (!(await submit.count())) { base.actual = "no submit button"; base.status = "skipped"; break; }
        await submit.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(600);
        const invalid = await page.locator(":invalid, [aria-invalid='true'], .error, .text-red-500, [class*='error']").count().catch(() => 0);
        base.expected = "empty required form shows validation";
        base.actual = invalid > 0 ? `${invalid} validation indicators` : "no validation shown";
        base.status = invalid > 0 ? "pass" : "fail";
        break;
      }
      default:
        base.status = "skipped";
    }
  } catch (e: any) {
    base.actual = `error: ${String(e?.message || e).slice(0, 120)}`;
    base.status = "fail";
  }
  return base;
}

async function loginUI(page: Page): Promise<boolean> {
  const otpPromise = new Promise<string>((resolve) => {
    page.on("response", async (res) => {
      if (res.url().includes("/auth/send-otp")) {
        try { const d = await res.json(); if (d.otp) resolve(String(d.otp)); } catch {}
      }
    });
  });
  await page.goto("/login").catch(() => {});
  const phone = page.locator("input[name='emailOrPhone']");
  if (!(await phone.isVisible().catch(() => false))) return false;
  await phone.fill(ADMIN_PHONE);
  await page.getByRole("button", { name: /send otp/i }).click().catch(() => {});
  const otp = await Promise.race([
    otpPromise, new Promise<string>((_, r) => setTimeout(() => r(new Error("t")), 15000)),
  ]).catch(() => "");
  if (!otp) return false;
  const otpInput = page.locator("input[name='otp']");
  await otpInput.waitFor({ timeout: 5000 }).catch(() => {});
  await otpInput.fill(otp).catch(() => {});
  await page.getByRole("button", { name: /verify otp/i }).click().catch(() => {});
  await page.waitForTimeout(3000);
  return true;
}

async function collectLinks(page: Page, origin: string): Promise<string[]> {
  const hrefs = await page.locator("a[href]").evaluateAll((els) =>
    els.map((e) => (e as HTMLAnchorElement).href)).catch(() => [] as string[]);
  const out = new Set<string>();
  for (const h of hrefs) {
    try {
      const u = new URL(h);
      if (u.origin !== origin) continue;
      if (/logout|sign-?out/i.test(u.pathname)) continue;
      out.add(u.pathname + u.search);
    } catch {}
  }
  return [...out];
}

test.describe("AI-driven live crawl", () => {
  test("AI generates + runs test cases per page, recursing the whole site", async ({ page }) => {
    test.setTimeout(60 * 60 * 1000); // AI generation is slower; allow up to 1h
    fs.mkdirSync(SHOTS, { recursive: true });

    const origin = "http://localhost:5173";
    const reports: PageReport[] = [];
    const visited = new Set<string>();
    const queue: { url: string; depth: number }[] = [];

    const authed = await loginUI(page).catch(() => false);
    console.log(authed ? "🔐 Logged in as admin" : "🌐 Guest crawl");
    for (const r of SEED_ROUTES) queue.push({ url: r, depth: 0 });

    while (queue.length && visited.size < MAX_PAGES) {
      const { url, depth } = queue.shift()!;
      const key = url.split("#")[0];
      if (visited.has(key)) continue;
      visited.add(key);

      const consoleErrors: string[] = [];
      const apiErrors: string[] = [];
      const onC = (m: any) => { if (m.type() === "error") { const t = m.text(); if (!/preconnect|favicon|ERR_CONNECTION_REFUSED|Failed to load resource/i.test(t)) consoleErrors.push(t); } };
      const onE = (e: any) => consoleErrors.push(String(e?.message || e));
      const onR = (r: any) => { try { if (r.status() >= 500 && r.url().includes("/api/")) apiErrors.push(`${r.status()} ${r.url()}`); } catch {} };
      page.on("console", onC); page.on("pageerror", onE); page.on("response", onR);

      const idx = visited.size;
      const rep: PageReport = {
        index: idx, url: key, title: "", depth, aiModel: MODEL,
        testCases: [], pass: 0, fail: 0, skipped: 0,
        consoleErrors, apiErrors, screenshot: "",
      };
      try {
        console.log(`[${idx}/${MAX_PAGES}] ${key}`);
        await page.goto(key, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(700);
        rep.title = await page.title().catch(() => "");

        const snap = await snapshot(page);
        const gen = await aiGenerate(origin + key, snap);
        rep.aiModel = gen.source;
        console.log(`   🤖 ${gen.source} generated ${gen.cases.length} test cases`);
        for (const tc of gen.cases) {
          const r = await runCase(page, tc);
          rep.testCases.push(r);
          if (r.status === "pass") rep.pass++;
          else if (r.status === "fail") rep.fail++;
          else rep.skipped++;
        }
        // console errors reflect into no_console_errors cases
        rep.testCases.forEach((t) => {
          if (t.type === "no_console_errors") {
            t.actual = consoleErrors.length ? `${consoleErrors.length} console errors` : "none";
            t.status = consoleErrors.length ? "fail" : "pass";
          }
        });
        rep.pass = rep.testCases.filter((t) => t.status === "pass").length;
        rep.fail = rep.testCases.filter((t) => t.status === "fail").length;
        rep.skipped = rep.testCases.filter((t) => t.status === "skipped").length;

        const shot = path.join(SHOTS, `${String(idx).padStart(3, "0")}.png`);
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
        rep.screenshot = path.relative(OUT, shot);

        if (!page.url().includes(key)) await page.goto(key, { timeout: 15000 }).catch(() => {});
        for (const l of await collectLinks(page, origin)) {
          const lk = l.split("#")[0];
          if (!visited.has(lk)) queue.push({ url: l, depth: depth + 1 });
        }
      } catch (e: any) {
        rep.consoleErrors.push(`[nav] ${String(e?.message || e)}`);
      } finally {
        page.off("console", onC); page.off("pageerror", onE); page.off("response", onR);
        reports.push(rep);
        writeDashboard(reports); // live-updating dashboard after every page
      }
    }
    fs.writeFileSync(path.join(OUT, "ai-crawl-results.json"), JSON.stringify(reports, null, 2));
    writeDashboard(reports);
    console.log(`\n📊 Dashboard: ${OUT}/index.html`);
    expect(reports.length).toBeGreaterThan(0);
  });
});

// ── Live HTML dashboard ───────────────────────────────────────────────────
function esc(s: string) { return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)); }

function writeDashboard(reports: PageReport[]) {
  const totalPages = reports.length;
  const totalTC = reports.reduce((a, r) => a + r.testCases.length, 0);
  const totalPass = reports.reduce((a, r) => a + r.pass, 0);
  const totalFail = reports.reduce((a, r) => a + r.fail, 0);
  const totalSkip = reports.reduce((a, r) => a + r.skipped, 0);
  const rate = totalTC ? ((totalPass / totalTC) * 100).toFixed(1) : "0";

  const rows = reports.map((r) => {
    const tcRows = r.testCases.map((t) => `
      <tr class="${t.status}">
        <td>${esc(t.id)}</td>
        <td>${esc(t.description)}</td>
        <td><code>${esc(t.type)}</code></td>
        <td><span class="badge ${t.status}">${t.status.toUpperCase()}</span></td>
        <td>${esc(t.expected)}</td>
        <td>${esc(t.actual)}</td>
      </tr>`).join("");
    const errs = [...r.consoleErrors, ...r.apiErrors].slice(0, 6).map((e) => `<li>${esc(e)}</li>`).join("");
    return `
    <section class="page">
      <div class="phead">
        <h2>#${r.index} · ${esc(r.title) || "(no title)"} <span class="url">${esc(r.url)}</span></h2>
        <div class="pstats">
          <span class="badge pass">${r.pass} pass</span>
          <span class="badge fail">${r.fail} fail</span>
          <span class="badge skipped">${r.skipped} skip</span>
          <span class="ai">🤖 ${esc(r.aiModel)}</span>
        </div>
      </div>
      <div class="pbody">
        <div class="ptests">
          <table>
            <thead><tr><th>ID</th><th>Test Case (AI-generated)</th><th>Type</th><th>Result</th><th>Expected</th><th>Actual</th></tr></thead>
            <tbody>${tcRows || '<tr><td colspan="6"><em>No AI test cases generated</em></td></tr>'}</tbody>
          </table>
          ${errs ? `<div class="errors"><strong>Console/API errors:</strong><ul>${errs}</ul></div>` : ""}
        </div>
        <div class="pevidence">
          ${r.screenshot ? `<a href="${esc(r.screenshot)}" target="_blank"><img src="${esc(r.screenshot)}" loading="lazy"/></a>` : "<em>no screenshot</em>"}
        </div>
      </div>
    </section>`;
  }).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Vyapara Setu — AI Crawl Report</title>
<meta http-equiv="refresh" content="10">
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#0f172a;color:#e2e8f0}
  header{position:sticky;top:0;background:#1e293b;padding:16px 24px;border-bottom:2px solid #334155;z-index:10}
  h1{margin:0 0 8px;font-size:20px}
  .kpis{display:flex;gap:12px;flex-wrap:wrap}
  .kpi{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:10px 16px;min-width:90px}
  .kpi .n{font-size:24px;font-weight:800}.kpi .l{font-size:11px;color:#94a3b8;text-transform:uppercase}
  .kpi.pass .n{color:#4ade80}.kpi.fail .n{color:#f87171}.kpi.rate .n{color:#60a5fa}
  .page{margin:20px 24px;background:#1e293b;border:1px solid #334155;border-radius:10px;overflow:hidden}
  .phead{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:#172033;flex-wrap:wrap;gap:8px}
  .phead h2{font-size:15px;margin:0}.url{color:#64748b;font-weight:400;font-size:12px;margin-left:8px}
  .pbody{display:grid;grid-template-columns:1fr 320px;gap:16px;padding:16px}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #334155;vertical-align:top}
  th{color:#94a3b8;font-size:10px;text-transform:uppercase}
  .badge{padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}
  .badge.pass{background:#064e3b;color:#4ade80}.badge.fail{background:#7f1d1d;color:#fca5a5}.badge.skipped{background:#334155;color:#cbd5e1}
  tr.fail{background:#2d1414}
  .pevidence img{width:100%;border:1px solid #334155;border-radius:6px}
  .errors{margin-top:10px;background:#2d1414;border:1px solid #7f1d1d;border-radius:6px;padding:8px;font-size:11px;color:#fca5a5}
  code{background:#0f172a;padding:1px 5px;border-radius:4px;font-size:11px}
  .ai{color:#a78bfa;font-size:11px}
</style></head>
<body>
<header>
  <h1>🤖 Vyapara Setu — AI-Driven Live Crawl Report <span style="font-size:11px;color:#64748b">(auto-refresh 10s · ${new Date().toLocaleTimeString()})</span></h1>
  <div class="kpis">
    <div class="kpi"><div class="n">${totalPages}</div><div class="l">Pages</div></div>
    <div class="kpi"><div class="n">${totalTC}</div><div class="l">Test Cases</div></div>
    <div class="kpi pass"><div class="n">${totalPass}</div><div class="l">Passed</div></div>
    <div class="kpi fail"><div class="n">${totalFail}</div><div class="l">Failed</div></div>
    <div class="kpi"><div class="n">${totalSkip}</div><div class="l">Skipped</div></div>
    <div class="kpi rate"><div class="n">${rate}%</div><div class="l">Pass Rate</div></div>
  </div>
</header>
${rows}
</body></html>`;
  fs.writeFileSync(path.join(OUT, "index.html"), html);
}
