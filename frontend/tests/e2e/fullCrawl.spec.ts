/**
 * FULL-COVERAGE MULTI-ROLE CRAWLER (Chromium)
 * ----------------------------------------------------------------------------
 * Covers the ENTIRE web app by minting real sessions (admin / customer /
 * delivery) via the API and injecting them into the browser, then crawling
 * every role-appropriate page — including dynamic :id routes expanded with
 * real IDs — and generating an ATOMIC test case for EVERY element on each page
 * (title, console, each input, each button, each link). Produces a live HTML
 * dashboard: crawl-report/index.html.
 *
 * Run (all roles):  cd frontend && npx playwright test fullCrawl --headed --project=chromium
 * One role:         CRAWL_ROLE=admin npx playwright test fullCrawl --project=chromium
 *
 * Requires backend :5001 + frontend :5173 (auto). Non-destructive: only fills
 * inputs & asserts presence/state; never clicks delete/pay/submit-destructive.
 * ----------------------------------------------------------------------------
 */
import { test, expect, Browser, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const API = process.env.CRAWL_API || "http://localhost:5001/api";
const ORIGIN = "http://localhost:5173";
const ROLE_FILTER = (process.env.CRAWL_ROLE || "all").toLowerCase();
const MAX_PER_ROLE = Number(process.env.CRAWL_MAX_PAGES || 200);
const OUT = path.join(process.cwd(), "crawl-report");
const SHOTS = path.join(OUT, "screenshots");

type TC = { id: string; description: string; type: string; expected: string; actual: string; status: "pass" | "fail" | "skipped" };
type PageRep = {
  index: number; role: string; url: string; title: string;
  testCases: TC[]; pass: number; fail: number; skipped: number;
  consoleErrors: string[]; apiErrors: string[]; screenshot: string;
};

const reports: PageRep[] = [];
let counter = 0;

// ── Session minting via API ───────────────────────────────────────────────
async function otpLogin(phone: string) {
  const s = await (await fetch(`${API}/auth/send-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) })).json();
  const v = await (await fetch(`${API}/auth/verify-otp`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, otp: s.otp }) })).json();
  return { accessToken: v.accessToken || v.token, refreshToken: v.refreshToken, user: v.user };
}
async function deliveryLogin() {
  const d = await (await fetch(`${API}/delivery/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "qa.delivery@example.com", password: "Qa@123456" }) })).json();
  return { accessToken: d.tokens?.accessToken || d.accessToken, refreshToken: d.tokens?.refreshToken || d.refreshToken, user: d.user };
}

// Fetch real IDs to expand dynamic routes
async function fetchIds(adminToken: string) {
  const h = { Authorization: `Bearer ${adminToken}` };
  const out: any = { products: [], orders: [], routes: [], deliveryBoys: [] };
  try { const p = await (await fetch(`${API}/products?limit=5`)).json(); out.products = (p.products || p.data || p.items || []).map((x: any) => x._id || x.id).filter(Boolean); } catch {}
  try { const o = await (await fetch(`${API}/admin/orders`, { headers: h })).json(); const l = o.orders || o.data || (Array.isArray(o) ? o : []); out.orders = l.slice(0, 5).map((x: any) => x._id || x.id).filter(Boolean); } catch {}
  try { const r = await (await fetch(`${API}/admin/routes`, { headers: h })).json(); out.routes = (r.routes || []).slice(0, 5).map((x: any) => x.routeId || x._id).filter(Boolean); } catch {}
  return out;
}

// Inject session into localStorage before app scripts run
async function makeContext(browser: Browser, sess: { accessToken: string; refreshToken?: string; user: any }) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((s) => {
    try {
      localStorage.setItem("accessToken", s.accessToken);
      if (s.refreshToken) localStorage.setItem("refreshToken", s.refreshToken);
      localStorage.setItem("authUser", JSON.stringify(s.user));
      localStorage.setItem("authState", "ACTIVE");
    } catch {}
  }, sess as any);
  return ctx;
}

// ── Route sets per role ───────────────────────────────────────────────────
const PUBLIC = ["/", "/login", "/signup", "/privacy", "/terms", "/cancellation",
  "/products", "/search", "/menu", "/download-app", "/contact-us", "/customer-care",
  "/about-us", "/careers", "/cs-store-stories", "/corporate-information",
  "/categories", "/help-support", "/become-seller"];
const CUSTOMER = ["/dashboard", "/cart", "/checkout", "/orders", "/profile", "/addresses",
  "/notification-preferences", "/settings", "/account", "/account/profile",
  "/account/profile/edit", "/account/settings", "/account/notifications",
  "/ways-to-earn", "/refer-and-earn", "/message-center"];
const ADMIN = ["/admin", "/admin/products", "/admin/products/new", "/admin/users",
  "/admin/orders", "/admin/routes", "/admin/routes/recent", "/admin/routes/preview",
  "/admin/delivery-boys", "/admin/analytics", "/admin/notifications/analytics",
  "/admin/finance", "/admin/payments", "/admin/ops/payments/recovery",
  "/admin/ops/finance", "/admin/support", "/admin/settings", "/admin-profile"];
const DELIVERY = ["/delivery", "/delivery/dashboard", "/delivery/profile",
  "/delivery/earnings-info", "/delivery/refer", "/delivery/support",
  "/delivery/messages", "/delivery/settings", "/delivery-selfie",
  "/delivery-profile", "/delivery/emergency", "/delivery/help-center",
  "/delivery-settings", "/ways-to-earn", "/refer-and-earn", "/message-center"];

function routesForRole(role: string, ids: any): string[] {
  const set = new Set<string>(PUBLIC);
  if (role === "admin") {
    ADMIN.forEach((r) => set.add(r));
    ids.orders.forEach((id: string) => set.add(`/admin/orders/${id}`));
    ids.routes.forEach((id: string) => { set.add(`/admin/routes/${id}`); set.add(`/admin/routes/${id}/map`); });
    ids.products.forEach((id: string) => set.add(`/product/${id}`));
  } else if (role === "customer") {
    CUSTOMER.forEach((r) => set.add(r));
    ids.products.forEach((id: string) => set.add(`/product/${id}`));
    ids.orders.forEach((id: string) => { set.add(`/orders/${id}`); set.add(`/order/${id}`); });
  } else if (role === "delivery") {
    DELIVERY.forEach((r) => set.add(r));
  }
  return [...set];
}

// ── Atomic per-element test generation + execution ────────────────────────
async function testPage(page: Page, role: string, url: string, consoleErrors: string[], apiErrors: string[]): Promise<TC[]> {
  const cases: TC[] = [];
  const push = (id: string, description: string, type: string, expected: string, actual: string, status: TC["status"]) =>
    cases.push({ id, description, type, expected, actual, status });

  // page-level
  const title = await page.title().catch(() => "");
  push("TITLE", "Page has a non-empty <title>", "title_nonempty", "non-empty title", `"${title}"`, title.trim() ? "pass" : "fail");
  const bodyLen = (await page.locator("body").innerText().catch(() => "")).length;
  push("BODY", "Page renders visible content", "body_nonempty", "content > 0 chars", `${bodyLen} chars`, bodyLen > 0 ? "pass" : "fail");
  push("REDIRECT", "URL stays on requested route (no auth redirect)", "no_redirect", url, page.url().replace(ORIGIN, ""), page.url().includes(url.split("?")[0]) || url === "/" ? "pass" : "fail");

  // inputs
  const inputs = await page.locator("input:visible, textarea:visible, select:visible").all();
  for (let i = 0; i < Math.min(inputs.length, 40); i++) {
    const el = inputs[i];
    try {
      const tag = String(await el.evaluate((n) => n.tagName)).toLowerCase();
      const type = String(await el.getAttribute("type") || "text").toLowerCase();
      const name = (await el.getAttribute("name")) || (await el.getAttribute("placeholder")) || `${tag}#${i}`;
      if (tag === "select") {
        const opts = await el.locator("option").count();
        push(`SEL-${i}`, `Select "${name}" has options`, "select_has_options", ">=1 option", `${opts} options`, opts >= 1 ? "pass" : "fail");
        continue;
      }
      if (["hidden", "file", "submit", "button", "image", "checkbox", "radio", "range", "color"].includes(type)) {
        push(`INP-${i}`, `Input "${name}" (${type}) is present`, "element_present", "present", "present", "pass");
        continue;
      }
      const val = type === "email" ? "qa@example.com" : type === "tel" ? "9391795162" : type === "number" ? "5" : type === "password" ? "Test123!" : "QA Test";
      await el.fill(val, { timeout: 800 });
      const got = await el.inputValue().catch(() => "");
      push(`INP-${i}`, `Input "${name}" accepts input`, "input_accepts", `value="${val}"`, `value="${got}"`, got === val ? "pass" : "fail");
    } catch (e: any) {
      push(`INP-${i}`, `Input #${i} interaction`, "input_accepts", "fillable", `error: ${String(e?.message || e).slice(0, 40)}`, "fail");
    }
  }

  // buttons
  const btns = await page.locator("button:visible, [role=button]:visible").all();
  for (let i = 0; i < Math.min(btns.length, 60); i++) {
    try {
      const label = ((await btns[i].textContent().catch(() => "")) || "").trim().replace(/\s+/g, " ").slice(0, 40) || `button#${i}`;
      const disabled = (await btns[i].getAttribute("disabled").catch(() => null)) !== null;
      push(`BTN-${i}`, `Button "${label}" is present`, "element_present", "present", disabled ? "present (disabled)" : "present (enabled)", "pass");
    } catch { /* skip */ }
  }

  // links
  const links = await page.locator("a[href]:visible").all();
  for (let i = 0; i < Math.min(links.length, 80); i++) {
    try {
      const href = (await links[i].getAttribute("href")) || "";
      const label = ((await links[i].textContent().catch(() => "")) || "").trim().slice(0, 30) || href;
      push(`LNK-${i}`, `Link "${label}" → ${href}`, "link_present", "has href", href || "(empty)", href ? "pass" : "fail");
    } catch { /* skip */ }
  }

  // console errors
  push("CONSOLE", "No runtime console errors", "no_console_errors", "0 errors", consoleErrors.length ? `${consoleErrors.length}` : "0", consoleErrors.length ? "fail" : "pass");
  push("API5XX", "No API 5xx responses", "no_api_5xx", "0", apiErrors.length ? `${apiErrors.length}` : "0", apiErrors.length ? "fail" : "pass");

  return cases;
}

async function crawlRole(browser: Browser, role: string, sess: any, ids: any) {
  const ctx = await makeContext(browser, sess);
  const page = await ctx.newPage();
  const seeds = routesForRole(role, ids);
  const visited = new Set<string>();
  const queue = [...seeds];
  console.log(`\n=== ROLE: ${role} — ${seeds.length} seed routes ===`);

  while (queue.length && visited.size < MAX_PER_ROLE) {
    const url = queue.shift()!;
    const key = `${role} ${url.split("#")[0]}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const consoleErrors: string[] = [];
    const apiErrors: string[] = [];
    const onC = (m: any) => { if (m.type() === "error") { const t = m.text(); if (!/preconnect|favicon|ERR_CONNECTION_REFUSED|Failed to load resource/i.test(t)) consoleErrors.push(t); } };
    const onE = (e: any) => consoleErrors.push(String(e?.message || e));
    const onR = (r: any) => { try { if (r.status() >= 500 && r.url().includes("/api/")) apiErrors.push(`${r.status()} ${r.url()}`); } catch {} };
    page.on("console", onC); page.on("pageerror", onE); page.on("response", onR);

    counter++;
    const rep: PageRep = { index: counter, role, url, title: "", testCases: [], pass: 0, fail: 0, skipped: 0, consoleErrors, apiErrors, screenshot: "" };
    try {
      console.log(`[${counter}] (${role}) ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(600);
      rep.title = await page.title().catch(() => "");
      rep.testCases = await testPage(page, role, url, consoleErrors, apiErrors);
      rep.pass = rep.testCases.filter((t) => t.status === "pass").length;
      rep.fail = rep.testCases.filter((t) => t.status === "fail").length;
      rep.skipped = rep.testCases.filter((t) => t.status === "skipped").length;
      const shot = path.join(SHOTS, `${String(counter).padStart(4, "0")}_${role}.png`);
      await page.screenshot({ path: shot }).catch(() => {});
      rep.screenshot = path.relative(OUT, shot);
      // discover new same-origin links to recurse
      const hrefs = await page.locator("a[href]").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href)).catch(() => []);
      for (const h of hrefs) {
        try { const u = new URL(h); if (u.origin === ORIGIN && !/logout|sign-?out/i.test(u.pathname)) { const p = u.pathname + u.search; if (!visited.has(`${role} ${p.split("#")[0]}`)) queue.push(p); } } catch {}
      }
    } catch (e: any) {
      rep.consoleErrors.push(`[nav] ${String(e?.message || e).slice(0, 80)}`);
    } finally {
      page.off("console", onC); page.off("pageerror", onE); page.off("response", onR);
      reports.push(rep);
      writeDashboard(reports);
    }
  }
  await ctx.close();
}

test.describe("Full multi-role crawl", () => {
  test("crawl entire app across roles with atomic per-element test cases", async ({ browser }) => {
    test.setTimeout(3 * 60 * 60 * 1000); // up to 3h for full coverage
    fs.mkdirSync(SHOTS, { recursive: true });

    const admin = await otpLogin("9391795162");
    const ids = await fetchIds(admin.accessToken);
    console.log("IDs:", { products: ids.products.length, orders: ids.orders.length, routes: ids.routes.length });

    const roles: Array<[string, any]> = [];
    if (["all", "admin"].includes(ROLE_FILTER)) roles.push(["admin", admin]);
    if (["all", "customer"].includes(ROLE_FILTER)) roles.push(["customer", await otpLogin("9000000007")]);
    if (["all", "delivery"].includes(ROLE_FILTER)) roles.push(["delivery", await deliveryLogin()]);

    for (const [role, sess] of roles) {
      if (!sess.accessToken) { console.log(`⚠️ no session for ${role}, skipping`); continue; }
      await crawlRole(browser, role, sess, ids);
    }

    fs.writeFileSync(path.join(OUT, "full-crawl-results.json"), JSON.stringify(reports, null, 2));
    writeDashboard(reports);
    const tc = reports.reduce((a, r) => a + r.testCases.length, 0);
    console.log(`\n📊 Dashboard: ${OUT}/index.html — ${reports.length} pages, ${tc} test cases`);
    expect(reports.length).toBeGreaterThan(0);
  });
});

// ── Live HTML dashboard ───────────────────────────────────────────────────
function esc(s: string) { return String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)); }

function writeDashboard(reps: PageRep[]) {
  const pages = reps.length;
  const tc = reps.reduce((a, r) => a + r.testCases.length, 0);
  const pass = reps.reduce((a, r) => a + r.pass, 0);
  const fail = reps.reduce((a, r) => a + r.fail, 0);
  const skip = reps.reduce((a, r) => a + r.skipped, 0);
  const rate = tc ? ((pass / tc) * 100).toFixed(1) : "0";
  const byRole: Record<string, number> = {};
  reps.forEach((r) => { byRole[r.role] = (byRole[r.role] || 0) + 1; });

  const rows = reps.map((r) => {
    const trs = r.testCases.map((t) => `<tr class="${t.status}"><td>${esc(t.id)}</td><td>${esc(t.description)}</td><td><code>${esc(t.type)}</code></td><td><span class="badge ${t.status}">${t.status.toUpperCase()}</span></td><td>${esc(t.expected)}</td><td>${esc(t.actual)}</td></tr>`).join("");
    const errs = [...r.consoleErrors, ...r.apiErrors].slice(0, 6).map((e) => `<li>${esc(e)}</li>`).join("");
    return `<section class="page"><div class="phead"><h2><span class="role ${esc(r.role)}">${esc(r.role)}</span> #${r.index} · ${esc(r.title) || "(no title)"} <span class="url">${esc(r.url)}</span></h2><div class="pstats"><span class="badge pass">${r.pass}</span><span class="badge fail">${r.fail}</span><span class="badge skipped">${r.skipped}</span></div></div><div class="pbody"><div class="ptests"><table><thead><tr><th>ID</th><th>Test Case</th><th>Type</th><th>Result</th><th>Expected</th><th>Actual</th></tr></thead><tbody>${trs}</tbody></table>${errs ? `<div class="errors"><strong>Errors:</strong><ul>${errs}</ul></div>` : ""}</div><div class="pevidence">${r.screenshot ? `<a href="${esc(r.screenshot)}" target="_blank"><img src="${esc(r.screenshot)}" loading="lazy"/></a>` : ""}</div></div></section>`;
  }).join("");

  const roleKpis = Object.entries(byRole).map(([k, v]) => `<div class="kpi"><div class="n">${v}</div><div class="l">${esc(k)} pages</div></div>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Vyapara Setu — Full Crawl Report</title><meta http-equiv="refresh" content="12"><style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#0f172a;color:#e2e8f0}
header{position:sticky;top:0;background:#1e293b;padding:14px 22px;border-bottom:2px solid #334155;z-index:10}
h1{margin:0 0 8px;font-size:19px}.kpis{display:flex;gap:10px;flex-wrap:wrap}
.kpi{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:8px 14px;min-width:80px}
.kpi .n{font-size:22px;font-weight:800}.kpi .l{font-size:10px;color:#94a3b8;text-transform:uppercase}
.kpi.pass .n{color:#4ade80}.kpi.fail .n{color:#f87171}.kpi.rate .n{color:#60a5fa}
.page{margin:16px 22px;background:#1e293b;border:1px solid #334155;border-radius:10px;overflow:hidden}
.phead{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#172033;gap:8px;flex-wrap:wrap}
.phead h2{font-size:14px;margin:0}.url{color:#64748b;font-weight:400;font-size:11px;margin-left:6px}
.role{font-size:10px;padding:2px 8px;border-radius:10px;text-transform:uppercase;font-weight:800}
.role.admin{background:#7c2d12;color:#fdba74}.role.customer{background:#164e63;color:#67e8f9}.role.delivery{background:#3730a3;color:#c7d2fe}
.pbody{display:grid;grid-template-columns:1fr 300px;gap:14px;padding:14px}
table{width:100%;border-collapse:collapse;font-size:11px}th,td{text-align:left;padding:5px 7px;border-bottom:1px solid #334155;vertical-align:top}
th{color:#94a3b8;font-size:10px;text-transform:uppercase}
.badge{padding:2px 7px;border-radius:10px;font-size:10px;font-weight:700}
.badge.pass{background:#064e3b;color:#4ade80}.badge.fail{background:#7f1d1d;color:#fca5a5}.badge.skipped{background:#334155;color:#cbd5e1}
tr.fail{background:#2d1414}.pevidence img{width:100%;border:1px solid #334155;border-radius:6px}
.errors{margin-top:8px;background:#2d1414;border:1px solid #7f1d1d;border-radius:6px;padding:8px;font-size:11px;color:#fca5a5}
code{background:#0f172a;padding:1px 5px;border-radius:4px;font-size:10px}
</style></head><body><header><h1>🕸️ Vyapara Setu — Full Multi-Role Crawl <span style="font-size:11px;color:#64748b">(auto-refresh · ${new Date().toLocaleTimeString()})</span></h1>
<div class="kpis"><div class="kpi"><div class="n">${pages}</div><div class="l">Pages</div></div><div class="kpi"><div class="n">${tc}</div><div class="l">Test Cases</div></div><div class="kpi pass"><div class="n">${pass}</div><div class="l">Passed</div></div><div class="kpi fail"><div class="n">${fail}</div><div class="l">Failed</div></div><div class="kpi"><div class="n">${skip}</div><div class="l">Skipped</div></div><div class="kpi rate"><div class="n">${rate}%</div><div class="l">Pass Rate</div></div>${roleKpis}</div></header>${rows}</body></html>`;
  fs.writeFileSync(path.join(OUT, "index.html"), html);
}
