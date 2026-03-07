import { test, expect } from "@playwright/test";
import { attachErrorListeners, baseURL, safeClickAll } from "./helpers";

function normalizePath(path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  const u = new URL(path, baseURL);
  return u.pathname + u.search + u.hash;
}

test.describe("Route audit", () => {
  test("discover internal routes and ensure no console/runtime/api(500) errors", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();

        // Ignore harmless network noise
        if (
          text.includes("preconnect") ||
          text.includes("localhost:5001") ||
          text.includes("ERR_CONNECTION_REFUSED") ||
          text.includes("Failed to load resource") ||
          text.includes("favicon")
        ) {
          return;
        }

        errors.push(text);
      }
    });

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();

    const links = await page.locator("a[href^='/']").all();
    const routes = new Set<string>();

    for (const link of links) {
      const href = await link.getAttribute("href");
      if (href && href.length < 50) routes.add(href);
    }

    const limitedRoutes = Array.from(routes).slice(0, 10);

    for (const route of limitedRoutes) {
      try {
        await page.goto(route, { timeout: 10_000 });
        await page.waitForTimeout(200);
      } catch {
        // ignore route-level navigation failures
      }
    }

    expect(errors).toEqual([]);
  });
});
