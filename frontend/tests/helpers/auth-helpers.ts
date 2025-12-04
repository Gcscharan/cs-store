import { Page, expect } from "@playwright/test";
import { TEST_USERS, SELECTORS, API_ENDPOINTS } from "./test-data";

export class AuthHelpers {
  constructor(private page: Page) {}

  async register(userData: typeof TEST_USERS.CUSTOMER) {
    await this.page.goto("/register");
    
    // Fill registration form
    await this.page.fill(SELECTORS.EMAIL_INPUT, userData.email);
    await this.page.fill(SELECTORS.PASSWORD_INPUT, userData.password);
    await this.page.fill(SELECTORS.PHONE_INPUT, userData.phone);
    
    // Submit form
    await this.page.click("[data-testid='register-btn']");
    
    // Wait for OTP screen
    await expect(this.page.locator(SELECTORS.OTP_INPUT)).toBeVisible();
    
    // Enter mock OTP (assuming OTP is mocked in tests)
    await this.page.fill(SELECTORS.OTP_INPUT, "123456");
    await this.page.click("[data-testid='verify-otp-btn']");
    
    // Wait for successful registration
    await expect(this.page.locator(SELECTORS.SUCCESS_MESSAGE)).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.page.goto("/login");
    
    // Fill login form
    await this.page.fill(SELECTORS.EMAIL_INPUT, email);
    await this.page.fill(SELECTORS.PASSWORD_INPUT, password);
    
    // Submit form
    await this.page.click("[data-testid='login-btn']");
    
    // Wait for successful login
    await expect(this.page.locator(SELECTORS.NAV_BAR)).toBeVisible();
  }

  async loginAsCustomer() {
    await this.login(TEST_USERS.CUSTOMER.email, TEST_USERS.CUSTOMER.password);
  }

  async loginAsAdmin() {
    await this.login(TEST_USERS.ADMIN.email, TEST_USERS.ADMIN.password);
  }

  async logout() {
    await this.page.click(SELECTORS.LOGOUT_BTN);
    await expect(this.page.locator(SELECTORS.LOGIN_FORM)).toBeVisible();
  }

  async verifyLoggedIn() {
    await expect(this.page.locator(SELECTORS.NAV_BAR)).toBeVisible();
    await expect(this.page.locator("[data-testid='user-menu']")).toBeVisible();
  }

  async verifyLoggedOut() {
    await expect(this.page.locator(SELECTORS.LOGIN_FORM)).toBeVisible();
  }

  async sendOTP(phone: string) {
    await this.page.goto("/login");
    await this.page.click("[data-testid='login-with-phone-btn']");
    await this.page.fill(SELECTORS.PHONE_INPUT, phone);
    await this.page.click("[data-testid='send-otp-btn']");
    
    // Wait for OTP input to appear
    await expect(this.page.locator(SELECTORS.OTP_INPUT)).toBeVisible();
  }

  async verifyOTP(otp: string = "123456") {
    await this.page.fill(SELECTORS.OTP_INPUT, otp);
    await this.page.click("[data-testid='verify-otp-btn']");
    
    // Wait for successful verification
    await expect(this.page.locator(SELECTORS.NAV_BAR)).toBeVisible();
  }

  // Mock API responses for auth
  async mockAuthAPIs() {
    await this.page.route(API_ENDPOINTS.AUTH.LOGIN, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          user: TEST_USERS.CUSTOMER,
          token: "mock-jwt-token",
          refreshToken: "mock-refresh-token",
        }),
      });
    });

    await this.page.route(API_ENDPOINTS.AUTH.REGISTER, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "User registered successfully",
          user: TEST_USERS.CUSTOMER,
        }),
      });
    });

    await this.page.route(API_ENDPOINTS.AUTH.VERIFY_OTP, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "OTP verified successfully",
        }),
      });
    });

    await this.page.route(API_ENDPOINTS.AUTH.SEND_OTP, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "OTP sent successfully",
        }),
      });
    });
  }
}
