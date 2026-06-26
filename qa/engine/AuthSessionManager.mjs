#!/usr/bin/env node
/**
 * Auth Session Manager
 * API-based login + Playwright storageState for category-scoped sessions
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, "..", ".auth");

const API_URL = process.env.API_URL || "http://localhost:3000/api";

async function apiRequest(method, apiPath, body, token) {
  const url = `${API_URL}${apiPath}`;
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { ok: res.ok, status: res.status, data };
}

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

export class AuthSessionManager {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || "http://localhost:3000";
    this.apiUrl = options.apiUrl || API_URL;
    this.sessions = new Map();
  }

  getCredentials(category, manifest) {
    const cat = manifest?.categories?.[category];
    const creds = cat?.credentials || {};

    if (category === "customer" || category === "shared") {
      return {
        phone: process.env.TEST_CUSTOMER_PHONE || creds.phone || "9000000001",
        email: creds.email || "test@example.com",
        otp: process.env.TEST_OTP || "123456",
        type: "otp",
      };
    }

    if (category === "admin") {
      return {
        phone: process.env.TEST_ADMIN_PHONE || creds.phone || "9999999999",
        email: creds.email || "admin@vyaparasetu.com",
        password: process.env.TEST_ADMIN_PASSWORD || creds.password || "admin123",
        type: "admin",
      };
    }

    if (category === "delivery") {
      return {
        email: process.env.DELIVERY_EMAIL || creds.email || "delivery@test.com",
        password: process.env.DELIVERY_PASSWORD || creds.password || "delivery123",
        phone: process.env.DELIVERY_PHONE || "9391795162",
        otp: process.env.TEST_OTP || "123456",
        type: "delivery",
      };
    }

    return null;
  }

  async loginViaApi(category, manifest) {
    const creds = this.getCredentials(category, manifest);
    if (!creds) return null;

    if (creds.type === "otp") {
      const payload = creds.phone ? { phone: creds.phone } : { email: creds.email };
      await apiRequest("POST", "/auth/send-otp", payload);
      const verify = await apiRequest("POST", "/auth/verify-otp", {
        ...payload,
        otp: creds.otp,
      });
      if (!verify.ok) return null;
      return {
        accessToken: verify.data.accessToken || verify.data.token,
        refreshToken: verify.data.refreshToken,
        user: verify.data.user,
      };
    }

    if (creds.type === "admin") {
      const login = await apiRequest("POST", "/auth/admin/login", {
        phone: creds.phone,
        password: creds.password,
      });
      if (!login.ok) {
        const otpPayload = { phone: creds.phone };
        await apiRequest("POST", "/auth/send-otp", otpPayload);
        const verify = await apiRequest("POST", "/auth/verify-otp", {
          ...otpPayload,
          otp: creds.otp || "123456",
        });
        if (!verify.ok) return null;
        return {
          accessToken: verify.data.accessToken || verify.data.token,
          refreshToken: verify.data.refreshToken,
          user: verify.data.user,
        };
      }
      return {
        accessToken: login.data.accessToken || login.data.token,
        refreshToken: login.data.refreshToken,
        user: login.data.user,
      };
    }

    if (creds.type === "delivery") {
      const login = await apiRequest("POST", "/delivery/auth/login", {
        email: creds.email,
        password: creds.password,
      });
      if (login.ok) {
        return {
          accessToken: login.data.tokens?.accessToken || login.data.accessToken,
          refreshToken: login.data.tokens?.refreshToken || login.data.refreshToken,
          user: login.data.user,
        };
      }

      const otpPayload = { phone: creds.phone };
      await apiRequest("POST", "/delivery/auth/send-otp", otpPayload);
      const verify = await apiRequest("POST", "/delivery/auth/verify-otp", {
        ...otpPayload,
        otp: creds.otp,
      });
      if (!verify.ok) return null;
      return {
        accessToken: verify.data.accessToken || verify.data.token,
        refreshToken: verify.data.refreshToken,
        user: verify.data.user,
      };
    }

    return null;
  }

  async injectSession(page, session) {
    if (!session?.accessToken) return false;

    await page.goto(this.baseUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.evaluate(
      ({ accessToken, refreshToken, user }) => {
        localStorage.setItem("accessToken", accessToken);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
        localStorage.setItem("authState", "ACTIVE");
        if (user) localStorage.setItem("user", JSON.stringify(user));
      },
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user: session.user,
      }
    );

    return true;
  }

  storagePath(category) {
    ensureAuthDir();
    return path.join(AUTH_DIR, `${category}.json`);
  }

  async getOrCreateSession(category, manifest, browser) {
    if (this.sessions.has(category)) {
      return this.sessions.get(category);
    }

    const storagePath = this.storagePath(category);
    if (fs.existsSync(storagePath)) {
      try {
        const state = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
        if (state.origins?.[0]?.localStorage?.length) {
          this.sessions.set(category, { storageState: state });
          return this.sessions.get(category);
        }
      } catch {
        // regenerate below
      }
    }

    const apiSession = await this.loginViaApi(category, manifest);
    if (!apiSession) {
      console.log(`⚠️  API login failed for category: ${category}`);
      return null;
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    await this.injectSession(page, apiSession);
    await context.storageState({ path: storagePath });
    await context.close();

    const session = { storageState: storagePath, apiSession };
    this.sessions.set(category, session);
    console.log(`✅ Auth session ready: ${category}`);
    return session;
  }

  async applyToContext(context, category, manifest, browser) {
    const session = await this.getOrCreateSession(category, manifest, browser);
    if (!session) return false;

    if (typeof session.storageState === "string") {
      await context.addCookies(
        (JSON.parse(fs.readFileSync(session.storageState, "utf-8")).cookies || [])
      );
    }
    return true;
  }

  async refreshSession(engine, category, manifest) {
    const storagePath = this.storagePath(category);
    if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
    this.sessions.delete(category);

    const apiSession = await this.loginViaApi(category, manifest);
    if (!apiSession) return false;

    await this.injectSession(engine.page, apiSession);
    await engine.context.storageState({ path: storagePath });
    this.sessions.set(category, { storageState: storagePath, apiSession });
    return true;
  }

  needsAuth(category) {
    return ["customer", "admin", "delivery", "shared"].includes(category);
  }

  resolveAuthCategory(category) {
    if (category === "shared") return "customer";
    return category;
  }
}

export default AuthSessionManager;
