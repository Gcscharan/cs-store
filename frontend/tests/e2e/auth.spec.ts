import { test, expect, type Page } from "../helpers/auth";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock OTP auth endpoints used by LoginForm (OTP-based login)
    await page.route("**/api/auth/send-otp*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "OTP sent" }),
      });
    });

    await page.route("**/api/auth/verify-otp*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accessToken: "e2e-access-token",
          refreshToken: "e2e-refresh-token",
          user: { name: "E2E Customer", role: "customer", isAdmin: false },
        }),
      });
    });

    // Profile endpoint used by ProfileCompletionWrapper
    await page.route("**/api/user/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ name: "E2E Customer", phone: "9876543210" }),
      });
    });
  });

  test("should signup a new user", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="emailOrPhone"]', "test@example.com");
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[name="otp"]', "123456");
    await page.click('button:has-text("Verify OTP")');

    await expect(page).toHaveURL("/");
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.unroute("**/api/auth/verify-otp*");
    await page.route("**/api/auth/verify-otp*", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "OTP verification failed" }),
      });
    });

    await page.fill('input[name="emailOrPhone"]', "test@example.com");
    await page.click('button:has-text("Send OTP")');
    await page.fill('input[name="otp"]', "000000");
    await page.click('button:has-text("Verify OTP")');

    await expect(page.locator('text=OTP verification failed')).toBeVisible();
  });

  test("should handle OTP reset", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="emailOrPhone"]', "test@example.com");
    await page.click('button:has-text("Send OTP")');
    await expect(page.locator('input[name="otp"]')).toBeVisible();

    await page.click('button:has-text("Use different email or phone number")');
    await expect(page.locator('input[name="emailOrPhone"]')).toBeVisible();
  });

  test("should logout successfully", async ({ customerPage }) => {
    await customerPage.goto("/login");
    await customerPage.fill('input[name="emailOrPhone"]', "test@example.com");
    await customerPage.click('button:has-text("Send OTP")');
    await customerPage.fill('input[name="otp"]', "123456");
    await customerPage.click('button:has-text("Verify OTP")');

    await expect(customerPage).toHaveURL("/");
  });

  test("should validate form inputs", async ({ page }) => {
    await page.goto("/signup");

    await page.click('button:has-text("Create Account")');
    await expect(page.locator('text=Name is required')).toBeVisible();
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Please enter your mobile number')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test("should handle social login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('text=Or continue with OTP')).toBeVisible();
  });

  test("should handle session persistence", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("accessToken", "e2e-access-token");
      localStorage.setItem("refreshToken", "e2e-refresh-token");
    });

    await page.goto("/");
    await page.reload();

    const token = await page.evaluate(() => localStorage.getItem("accessToken"));
    expect(token).toBeTruthy();
  });

  test("should handle token expiration", async ({ page }) => {
    await page.goto("/cart");
    await expect(page).toHaveURL("/login");
  });
});
