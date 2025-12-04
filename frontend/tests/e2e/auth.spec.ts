import { test, expect, type Page } from "../helpers/auth";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock external services
    await page.addInitScript(() => {
      // Mock OTP generation
      (window as any).fetch = new Proxy((window as any).fetch, {
        apply(target, thisArg, args) {
          const [url, options] = args;
          if (url.includes("/api/otp") && options?.method === "POST") {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                message: "OTP sent successfully (mock)",
                mock: true,
                otp: "123456",
                expiresIn: 600,
              }),
            });
          }
          return target.apply(thisArg, args as any);
        },
      });
    });
  });

  test("should signup a new user", async ({ page }) => {
    await page.goto("/signup");

    // Fill signup form
    await page.fill('[data-testid="name-input"]', "Test User");
    await page.fill('[data-testid="email-input"]', "newuser@example.com");
    await page.fill('[data-testid="phone-input"]', "9876543210");
    await page.fill('[data-testid="password-input"]', "password123");
    await page.fill('[data-testid="confirm-password-input"]', "password123");

    // Submit form
    await page.click('[data-testid="signup-button"]');

    // Should redirect to OTP verification
    await expect(page).toHaveURL("**/verify-otp");
    await expect(page.locator('[data-testid="otp-input"]')).toBeVisible();

    // Enter mock OTP
    await page.fill('[data-testid="otp-input"]', "123456");
    await page.click('[data-testid="verify-otp-button"]');

    // Should redirect to onboarding or dashboard
    await expect(page).toHaveURL("**/onboarding/**");
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill login form
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "password123");

    // Submit form
    await page.click('[data-testid="login-button"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL("**/dashboard");
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill invalid credentials
    await page.fill('[data-testid="email-input"]', "invalid@example.com");
    await page.fill('[data-testid="password-input"]', "wrongpassword");

    // Submit form
    await page.click('[data-testid="login-button"]');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText("Invalid credentials");
  });

  test("should complete onboarding flow", async ({ page }) => {
    // First login as a new user
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "password123");
    await page.click('[data-testid="login-button"]');

    // Should redirect to onboarding
    await expect(page).toHaveURL("**/onboarding/**");

    // Complete profile
    await page.fill('[data-testid="profile-name"]', "Test User");
    await page.fill('[data-testid="profile-phone"]', "9876543210");
    await page.click('[data-testid="complete-profile-button"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL("**/dashboard");
  });

  test("should handle OTP verification flow", async ({ page }) => {
    await page.goto("/login");

    // Click on login with OTP
    await page.click('[data-testid="login-with-otp"]');

    // Enter phone number
    await page.fill('[data-testid="phone-input"]', "9876543210");
    await page.click('[data-testid="send-otp-button"]');

    // Should show OTP input
    await expect(page.locator('[data-testid="otp-input"]')).toBeVisible();

    // Enter mock OTP
    await page.fill('[data-testid="otp-input"]', "123456");
    await page.click('[data-testid="verify-otp-button"]');

    // Should login successfully
    await expect(page).toHaveURL("**/dashboard");
  });

  test("should handle OTP resend", async ({ page }) => {
    await page.goto("/login");
    await page.click('[data-testid="login-with-otp"]');
    await page.fill('[data-testid="phone-input"]', "9876543210");
    await page.click('[data-testid="send-otp-button"]');

    // Wait for OTP input
    await expect(page.locator('[data-testid="otp-input"]')).toBeVisible();

    // Click resend OTP
    await page.click('[data-testid="resend-otp-button"]');

    // Should show message about OTP resent
    await expect(page.locator('[data-testid="otp-resent-message"]')).toBeVisible();
  });

  test("should logout successfully", async ({ customerPage }) => {
    // Click on user menu
    await customerPage.click('[data-testid="user-menu"]');

    // Click logout
    await customerPage.click('[data-testid="logout-button"]');

    // Should redirect to login
    await expect(customerPage).toHaveURL("**/login");
  });

  test("should handle password reset flow", async ({ page }) => {
    await page.goto("/login");

    // Click forgot password
    await page.click('[data-testid="forgot-password"]');

    // Should show password reset form
    await expect(page).toHaveURL("**/forgot-password");

    // Enter email
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.click('[data-testid="reset-password-button"]');

    // Should show success message
    await expect(page.locator('[data-testid="reset-success"]')).toBeVisible();
  });

  test("should validate form inputs", async ({ page }) => {
    await page.goto("/signup");

    // Try to submit empty form
    await page.click('[data-testid="signup-button"]');

    // Should show validation errors
    await expect(page.locator('[data-testid="name-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible();

    // Test email validation
    await page.fill('[data-testid="email-input"]', "invalid-email");
    await page.click('[data-testid="signup-button"]');
    await expect(page.locator('[data-testid="email-error"]')).toContainText("Invalid email");

    // Test password confirmation
    await page.fill('[data-testid="password-input"]', "password123");
    await page.fill('[data-testid="confirm-password-input"]', "different");
    await page.click('[data-testid="signup-button"]');
    await expect(page.locator('[data-testid="confirm-password-error"]')).toContainText("Passwords do not match");
  });

  test("should handle social login", async ({ page }) => {
    await page.goto("/login");

    // Mock Google OAuth
    await page.addInitScript(() => {
      (window as any).google = {
        accounts: {
          id: {
            initialize: () => {},
            prompt: () => {
              // Mock successful Google login
              window.postMessage({
                type: "GOOGLE_LOGIN_SUCCESS",
                user: {
                  email: "google@example.com",
                  name: "Google User",
                },
              }, "*");
            },
          },
        },
      };
    });

    // Click Google login
    await page.click('[data-testid="google-login-button"]');

    // Should handle Google login (mocked)
    await expect(page).toHaveURL("**/dashboard");
  });

  test("should handle session persistence", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "test@example.com');
    await page.fill('[data-testid="password-input"]', "password123");
    await page.click('[data-testid="login-button"]');

    // Should be logged in
    await expect(page).toHaveURL("**/dashboard");

    // Simulate page reload
    await page.reload();

    // Should still be logged in
    await expect(page).toHaveURL("**/dashboard");
    await expect(page.locator('[data-testid="user-profile"]')).toBeVisible();
  });

  test("should handle token expiration", async ({ page }) => {
    // Mock expired token
    await page.addInitScript(() => {
      const originalFetch = window.fetch;
      (window as any).fetch = function(url: string, options?: any) {
        if (url.includes("/api/auth/me") && options?.headers?.Authorization) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ message: "Token expired" }),
          });
        }
        return originalFetch.call(this, ...arguments as any);
      };
    });

    // Try to access protected route
    await page.goto("/dashboard");

    // Should redirect to login due to expired token
    await expect(page).toHaveURL("**/login");
  });
});
