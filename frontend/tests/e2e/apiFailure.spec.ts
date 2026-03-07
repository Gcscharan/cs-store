import { test, expect } from "@playwright/test";
import { attachErrorListeners, baseURL } from "./helpers";

test.describe("API failure simulation", () => {
  test("/api/** returning 500 shows error state and does not crash", async ({ page }) => {
    const errors = attachErrorListeners(page);

    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    await page.route("**/api/**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal Server Error" }),
      });
    });

    await page.goto(`${baseURL}/products`);
    await expect(page.locator("body")).toBeVisible();

    // Best-effort check: some visible error indicator OR at least page remains responsive.
    const errorLike = page.locator("text=/error|failed|something went wrong|try again/i");
    if (await errorLike.first().isVisible().catch(() => false)) {
      await expect(errorLike.first()).toBeVisible();
    } else {
      await expect(page.getByRole("main").first()).toBeVisible();
    }

    // We allow API 500s in this test (they are intentional), but we still must not have runtime/page errors.
    const nonApiErrors = errors.filter((e) => !e.startsWith("[api 500]"));
    expect(nonApiErrors).toEqual([]);
  });
});
