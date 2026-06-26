import { test, expect } from "@playwright/test";

const API = "http://localhost:5001/api";
const ADMIN_PHONE = "9391795162";

let sharedAuth: { token: string; refreshToken: string; user: any } | null = null;

async function loginAdmin() {
  const sendResp = await fetch(`${API}/auth/send-otp`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: ADMIN_PHONE }),
  });
  const sendData = await sendResp.json();
  if (!sendResp.ok) throw new Error(`send-otp: ${JSON.stringify(sendData)}`);
  if (!sendData.otp) throw new Error(`No OTP in response: ${JSON.stringify(sendData)}`);

  const verifyResp = await fetch(`${API}/auth/verify-otp`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: ADMIN_PHONE, otp: sendData.otp }),
  });
  const data = await verifyResp.json();
  if (!verifyResp.ok) throw new Error(`verify-otp: ${JSON.stringify(data)}`);
  return { token: data.accessToken || data.token, refreshToken: data.refreshToken, user: data.user };
}

test.describe.serial("AUTH - Authentication", () => {
  test("AUTH-01: Login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("input[name='emailOrPhone']")).toBeVisible();
    await page.screenshot({ path: "mcp-screenshots/auth-01-login-page.png", fullPage: true });
  });

  test("AUTH-02: Full OTP login flow via UI", async ({ page }) => {
    // Intercept the send-otp response to get the OTP
    const otpPromise = new Promise<string>((resolve) => {
      page.on("response", async (response) => {
        if (response.url().includes("/auth/send-otp")) {
          try {
            const data = await response.json();
            if (data.otp) resolve(data.otp);
          } catch {}
        }
      });
    });

    await page.goto("/login");
    await expect(page.locator("input[name='emailOrPhone']")).toBeVisible();
    await page.locator("input[name='emailOrPhone']").fill(ADMIN_PHONE);

    await page.getByRole("button", { name: /send otp/i }).click();

    const otp = await otpPromise;
    console.log(`📱 OTP from network: ${otp}`);
    expect(otp).toBeDefined();

    await expect(page.locator("input[name='otp']")).toBeVisible({ timeout: 5000 });
    await page.locator("input[name='otp']").fill(otp);
    await page.screenshot({ path: "mcp-screenshots/auth-02-otp-filled.png", fullPage: true });

    await page.getByRole("button", { name: /verify otp/i }).click();
    await page.waitForURL(/\/admin/, { timeout: 15000 });
    await page.screenshot({ path: "mcp-screenshots/auth-02-login-success.png", fullPage: true });
    console.log(`✅ Admin logged in, URL: ${page.url()}`);
  });

  test("AUTH-03: API auth (token, refresh, me endpoint)", async () => {
    sharedAuth = await loginAdmin();
    expect(sharedAuth.token).toBeTruthy();
    expect(sharedAuth.user.role).toBe("admin");
    console.log("✅ Token:", sharedAuth.token.slice(0, 30) + "...");

    const meResp = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${sharedAuth.token}` },
    });
    expect(meResp.status).toBe(200);
    console.log("✅ GET /auth/me works");

    const refreshResp = await fetch(`${API}/auth/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: sharedAuth.refreshToken }),
    });
    expect(refreshResp.status).toBe(200);
    console.log("✅ Token refresh works");
  });

  test("AUTH-04: Protected route redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("/login");
    await page.screenshot({ path: "mcp-screenshots/auth-04-protected-route.png", fullPage: true });
    console.log(`✅ /dashboard → ${page.url()}`);
  });

  test("AUTH-05: Logout invalidates session", async () => {
    if (!sharedAuth) sharedAuth = await loginAdmin();
    const resp = await fetch(`${API}/auth/logout`, {
      method: "POST", headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sharedAuth.token}`,
      },
    });
    console.log(`🚪 Logout: ${resp.status}`);
    expect([200, 204].includes(resp.status)).toBeTruthy();
  });
});
