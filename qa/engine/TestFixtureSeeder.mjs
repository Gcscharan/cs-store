#!/usr/bin/env node
/**
 * Test Fixture Seeder
 * Seeds backend state and resolves parameterized manifest routes
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.API_URL || "http://localhost:3000/api";

async function apiRequest(method, apiPath, body, token) {
  const res = await fetch(`${API_URL}${apiPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
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

export class TestFixtureSeeder {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || API_URL;
    this.fixtures = {
      productId: "1",
      orderId: null,
      routeId: null,
      adminOrderId: null,
    };
  }

  async getAdminToken() {
    const phone = process.env.TEST_ADMIN_PHONE || "9999999999";
    const password = process.env.TEST_ADMIN_PASSWORD || "admin123";
    const login = await apiRequest("POST", "/auth/admin/login", { phone, password });
    if (login.ok) return login.data.accessToken || login.data.token;

    await apiRequest("POST", "/auth/send-otp", { phone });
    const verify = await apiRequest("POST", "/auth/verify-otp", {
      phone,
      otp: process.env.TEST_OTP || "123456",
    });
    return verify.data?.accessToken || verify.data?.token || null;
  }

  async seed(manifest) {
    const defaults = manifest.fixtures || {};
    this.fixtures = { ...this.fixtures, ...defaults };

    const products = await apiRequest("GET", "/products?limit=5");
    if (products.ok) {
      const list =
        products.data?.products || products.data?.data || products.data || [];
      if (Array.isArray(list) && list.length > 0) {
        this.fixtures.productId = String(list[0]._id || list[0].id || defaults.productId || "1");
      }
    }

    const adminToken = await this.getAdminToken();
    if (adminToken) {
      const orders = await apiRequest("GET", "/admin/orders?limit=5", null, adminToken);
      if (orders.ok) {
        const list = orders.data?.orders || orders.data?.data || [];
        if (Array.isArray(list) && list.length > 0) {
          const id = list[0]._id || list[0].id;
          this.fixtures.orderId = String(id);
          this.fixtures.adminOrderId = String(id);
        }
      }

      const routes = await apiRequest("GET", "/admin/routes?limit=5", null, adminToken);
      if (routes.ok) {
        const list = routes.data?.routes || routes.data?.data || routes.data || [];
        if (Array.isArray(list) && list.length > 0) {
          this.fixtures.routeId = String(list[0]._id || list[0].id);
        }
      }
    }

    try {
      const scriptPath = path.join(__dirname, "..", "..", "backend", "assign-order-to-delivery.js");
      execSync(`node "${scriptPath}"`, {
        cwd: path.join(__dirname, "..", "..", "backend"),
        stdio: "pipe",
        timeout: 30000,
      });
    } catch {
      // optional — DB may not be available in all environments
    }

    if (!this.fixtures.orderId) {
      const deliveryPhone = process.env.DELIVERY_PHONE || "9391795162";
      await apiRequest("POST", "/delivery/auth/send-otp", { phone: deliveryPhone });
      const verify = await apiRequest("POST", "/delivery/auth/verify-otp", {
        phone: deliveryPhone,
        otp: process.env.TEST_OTP || "123456",
      });
      const token = verify.data?.accessToken || verify.data?.token;
      if (token) {
        const dOrders = await apiRequest("GET", "/delivery/orders", null, token);
        if (dOrders.ok) {
          const list = dOrders.data?.orders || dOrders.data || [];
          if (Array.isArray(list) && list.length > 0) {
            this.fixtures.orderId = String(list[0]._id || list[0].id || list[0].orderId);
          }
        }
      }
    }

    console.log("🌱 Fixtures seeded:", this.fixtures);
    return this.fixtures;
  }

  resolvePath(pagePath) {
    if (!pagePath.includes(":")) return pagePath;

    return pagePath
      .replace(":id", this.fixtures.productId || "1")
      .replace(":orderId", this.fixtures.orderId || this.fixtures.adminOrderId || "1")
      .replace(":routeId", this.fixtures.routeId || "1");
  }

  getFixtures() {
    return { ...this.fixtures };
  }
}

export default TestFixtureSeeder;
