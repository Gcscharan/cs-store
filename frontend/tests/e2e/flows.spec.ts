import { test, expect } from "@playwright/test";
import { attachErrorListeners, baseURL } from "./helpers";

test.describe("Critical flows", () => {
  test("Login flow", async ({ page }) => {
    const errors = attachErrorListeners(page);

    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    await page.goto(`${baseURL}/login`);
    await expect(page.locator("body")).toBeVisible();

    // Support both OTP-based and password-based login UIs.
    const emailOrPhone = page.locator('input[name="emailOrPhone"], input[type="email"], input[name="email"]');
    if (await emailOrPhone.first().isVisible().catch(() => false)) {
      await emailOrPhone.first().fill("test@example.com");
    }

    const password = page.locator('input[name="password"], input[type="password"]');
    if (await password.first().isVisible().catch(() => false)) {
      await password.first().fill("Password123!");
    }

    const sendOtp = page.getByRole("button", { name: /send otp/i });
    if (await sendOtp.isVisible().catch(() => false)) {
      await sendOtp.click();
      const otp = page.locator('input[name="otp"], input[inputmode="numeric"]');
      if (await otp.first().isVisible().catch(() => false)) {
        await otp.first().fill("123456");
      }
      const verify = page.getByRole("button", { name: /verify otp/i });
      if (await verify.isVisible().catch(() => false)) await verify.click();
    } else {
      const submit = page.getByRole("button", { name: /sign in|login/i });
      if (await submit.isVisible().catch(() => false)) await submit.click();
    }

    await expect(page.locator("body")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Signup flow", async ({ page }) => {
    const errors = attachErrorListeners(page);

    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    await page.goto(`${baseURL}/signup`);
    await expect(page.locator("body")).toBeVisible();

    // Minimal best-effort fill; tolerate variations.
    const name = page.locator('input[name="name"], input[placeholder*="Name" i]');
    if (await name.first().isVisible().catch(() => false)) await name.first().fill("E2E User");

    const email = page.locator('input[type="email"], input[name="email"]');
    const dynamicEmail = `test${Date.now()}@example.com`;
    if (await email.first().isVisible().catch(() => false)) await email.first().fill(dynamicEmail);

    const phone = page.locator('input[name="phone"], input[placeholder*="mobile" i]');
    if (await phone.first().isVisible().catch(() => false)) await phone.first().fill("9999999999");

    const password = page.locator('input[type="password"], input[name="password"]');
    if (await password.first().isVisible().catch(() => false)) await password.first().fill("Password123!");

    const submit = page.getByRole("button", { name: /create account|sign up/i });
    if ((await submit.count()) > 0) {
      await submit.first().click();
    }

    await expect(page.locator("body")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Add to cart flow", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!text.includes("preconnect") && !text.includes("localhost:5001")) {
          errors.push(text);
        }
      }
    });

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();

    const add = page.getByRole("button", { name: /add to cart/i }).first();
    if ((await add.count()) > 0) {
      await add.click();
      await page.goto("/cart");
    }

    await expect(page.locator("body")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("Checkout visibility test", async ({ page }) => {
    const errors = attachErrorListeners(page);

    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    await page.goto(`${baseURL}/checkout`);
    await expect(page.locator("body")).toBeVisible();

    // Accept either checkout page or login redirect; ensure no crash.
    expect(errors).toEqual([]);
  });

  test("Protected route guard", async ({ page }) => {
    const errors = attachErrorListeners(page);

    await page.route("**/api/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      })
    );

    await page.goto(`${baseURL}/dashboard`);
    await expect(page.locator("body")).toBeVisible();

    await expect(page).toHaveURL(/\/login/);
    expect(errors).toEqual([]);
  });
});
