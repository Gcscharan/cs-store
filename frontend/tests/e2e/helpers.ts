import type { Page, Response } from "@playwright/test";

export const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173";

export function attachErrorListeners(page: Page) {
  const errors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    const lower = text.toLowerCase();
    if (lower.includes("preconnect")) return;
    if (lower.includes("localhost:5001")) return;
    errors.push(`[console] ${text}`);
  });

  page.on("pageerror", (error) => {
    errors.push(`[pageerror] ${String((error as any)?.message || error)}`);
  });

  page.on("response", (res: Response) => {
    try {
      const url = res.url();
      const status = res.status();
      if (status >= 500 && url.includes("/api/")) {
        errors.push(`[api ${status}] ${url}`);
      }
    } catch {
      // ignore
    }
  });

  return errors;
}

function isSkippableHref(href: string | null): boolean {
  const h = String(href || "").trim();
  if (!h) return true;
  if (h.startsWith("mailto:")) return true;
  if (h.startsWith("tel:")) return true;
  if (h.startsWith("javascript:")) return true;
  if (h.startsWith("#")) return true;
  if (h.toLowerCase().includes("logout")) return true;
  return false;
}

export async function safeClickAll(page: Page) {
  const locators = await page.locator("button, a").all();

  for (const el of locators) {
    try {
      if (!(await el.isVisible().catch(() => false))) continue;

      const tagName = String(await el.evaluate((n: Element) => n.tagName).catch(() => "")).toLowerCase();
      const disabledAttr = await el.getAttribute("disabled").catch(() => null);
      const ariaDisabled = await el.getAttribute("aria-disabled").catch(() => null);
      const role = await el.getAttribute("role").catch(() => null);
      const type = await el.getAttribute("type").catch(() => null);

      const isDisabled = disabledAttr !== null || String(ariaDisabled || "").toLowerCase() === "true";
      if (isDisabled) continue;

      if (tagName === "button" || role === "button") {
        const t = String(type || "").toLowerCase();
        if (t === "submit") continue;
      }

      if (tagName === "a") {
        const href = await el.getAttribute("href").catch(() => null);
        if (isSkippableHref(href)) continue;
      }

      await el.click({ timeout: 1000 }).catch((e: any) => {
        const msg = String(e?.message || e);
        if (msg.toLowerCase().includes("detached") || msg.toLowerCase().includes("not attached")) return;
        if (msg.toLowerCase().includes("intercept")) return;
        if (msg.toLowerCase().includes("timeout")) return;
        throw e;
      });

      await page.waitForTimeout(100);
    } catch {
      // keep audit resilient: clicking should not itself fail the whole test
    }
  }
}
